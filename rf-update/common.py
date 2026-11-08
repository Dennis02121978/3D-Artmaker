"""Gemeinsame Hilfen fuer Update-Ablauf und Webseite."""
import configparser
import json
import os
import pwd
import re
import shlex
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request

BASE = "/usr/lib/rf-update"
FILES = BASE + "/files"
STATE_DIR = "/var/lib/rf-update"
STATUS_FILE = STATE_DIR + "/status.json"
REQUEST_FILE = STATE_DIR + "/request.json"  # Gewaehlter Drucker, schreibt die Webseite
LOG_FILE = STATE_DIR + "/update.log"
CONFIG = "/etc/rf-update/config"
TEST_ENV = "/etc/rf-update/test.env"
UNIT = "rf-update.service"
DEFAULT_PORT = 7125
SUPPORTED_MCU = "atmega2560"


def _klipper_user():
    """Das Paket traegt den Klipper-Benutzer bei der Installation hier ein."""
    with open(CONFIG) as f:
        for line in f:
            if line.startswith("KLIPPER_USER="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("KLIPPER_USER fehlt in " + CONFIG)


USER = _klipper_user()
HOME = pwd.getpwnam(USER).pw_dir
KLIPPER = HOME + "/klipper"
WEB_DIR = HOME + "/rf-update"  # Nur die Webseite, wird von Moonraker aktualisiert
SEED_DIR = "/usr/share/rf-update"


def test_cfg():
    """Nur fuer Probelaeufe: root-eigene Datei, im Normalbetrieb nicht vorhanden."""
    cfg = {}
    try:
        with open(TEST_ENV) as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    cfg[k] = v
    except OSError:
        pass
    return cfg


def boot_id():
    with open("/proc/sys/kernel/random/boot_id") as f:
        return f.read().strip()


def moonraker(path, port=DEFAULT_PORT, data=None, timeout=3):
    """Liefert (erreichbar, JSON oder None). Mit data wird ein POST gesendet."""
    try:
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=data)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return True, json.load(r)
    except urllib.error.HTTPError:
        return True, None
    except (OSError, ValueError):
        return False, None


def gcode(port, script, timeout=10):
    """Sendet G-Code an Klipper ueber Moonraker. True, wenn Klipper ihn ausgefuehrt hat."""
    ok, data = moonraker("/printer/gcode/script?script=" + urllib.parse.quote(script),
                         port, data=b"", timeout=timeout)
    return bool(ok and data and data.get("result") == "ok")


# ---------------------------------------------------------------------------
# Mehrere Drucker an einem Rechner: jede Klipper-Instanz hat einen eigenen Dienst
# (klipper.service, klipper-<Name>.service), eigene printer_data und eigenen
# Moonraker-Port. Alles wird aus den Dienst- und Config-Dateien gelesen.
# ---------------------------------------------------------------------------

def _klipper_units():
    units = set()
    for cmd in (["systemctl", "list-unit-files", "--type=service", "--no-legend", "--plain", "klipper*.service"],
                ["systemctl", "list-units", "--all", "--type=service", "--no-legend", "--plain", "klipper*.service"]):
        r = subprocess.run(cmd, capture_output=True, text=True)
        for line in r.stdout.splitlines():
            name = line.split()[0] if line.split() else ""
            if re.fullmatch(r"klipper(-[A-Za-z0-9_.-]+)?\.service", name) and "@" not in name:
                units.add(name[:-len(".service")])
    return sorted(units, key=lambda u: (u != "klipper", u))


def _unit_config(unit):
    """Pfad der printer.cfg einer Klipper-Instanz aus ihrer EnvironmentFile."""
    r = subprocess.run(["systemctl", "show", "-p", "EnvironmentFiles", "-p", "Environment", "--value", unit],
                       capture_output=True, text=True)
    args = ""
    for token in r.stdout.split():
        if token.startswith("KLIPPER_ARGS="):
            args = token.split("=", 1)[1]
        elif token.startswith("/") and os.path.isfile(token):
            with open(token) as f:
                for line in f:
                    if line.startswith("KLIPPER_ARGS="):
                        args = line.split("=", 1)[1].strip().strip('"')
    try:
        parts = shlex.split(args)
    except ValueError:
        return None
    for i, part in enumerate(parts):
        if part.endswith("klippy.py") and i + 1 < len(parts):
            return parts[i + 1]
    return None


def _section_value(path, section, key):
    """Liest einen Wert aus einer Klipper-/Moonraker-Datei, ohne Includes."""
    current = None
    try:
        with open(path) as f:
            for line in f:
                if line.startswith("#*#"):
                    break
                m = re.match(r"\[([^\]]+)\]", line)
                if m:
                    current = m.group(1).strip()
                elif current == section:
                    m = re.match(r"%s\s*[:=]\s*(\S+)" % re.escape(key), line)
                    if m:
                        return m.group(1)
    except OSError:
        pass
    return None


def _printer_name(port, data_dir, index):
    ok, data = moonraker("/server/database/item?namespace=mainsail&key=general.printername", port)
    if ok and data and str(data.get("result", {}).get("value") or "").strip():
        return str(data["result"]["value"]).strip()
    m = re.fullmatch(r"printer_(.+)_data", os.path.basename(data_dir))
    return m.group(1) if m else "Drucker %d" % index


def instances():
    """Alle Drucker dieses Rechners als Liste von dicts."""
    result = []
    for index, unit in enumerate(_klipper_units(), 1):
        config = _unit_config(unit)
        if not config or not os.path.isfile(config):
            continue
        data_dir = os.path.dirname(os.path.dirname(config))
        port = _section_value(os.path.join(data_dir, "config", "moonraker.conf"), "server", "port")
        port = int(port) if port and port.isdigit() else DEFAULT_PORT
        result.append({"id": unit, "service": unit + ".service", "config": config, "data_dir": data_dir,
                       "port": port, "serial": _section_value(config, "mcu", "serial") or "",
                       "name": _printer_name(port, data_dir, index)})
    return result


def find_instance(instance_id):
    for inst in instances():
        if inst["id"] == instance_id:
            return inst
    return None


def led_signal(port, mode, color="RED", duration=30):
    """LED des Druckers als Erkennungszeichen. Ohne RF_LED_SIGNAL (aeltere Config) einfach SET_LED."""
    script = "RF_LED_SIGNAL MODE=%s COLOR=%s DURATION=%d" % (mode, color, duration)
    if gcode(port, script):
        return True
    ok, data = moonraker("/printer/objects/list", port)
    if not (ok and data and "led led" in data["result"].get("objects", [])):
        return False
    rgb = {"RED": (1, 0, 0), "GREEN": (0, 1, 0)}.get(color, (1, 1, 1)) if mode != "OFF" else (1, 1, 1)
    return gcode(port, "SET_LED LED=led RED=%d GREEN=%d BLUE=%d SYNC=0" % rgb)


def service_active(name):
    r = subprocess.run(["systemctl", "show", "-p", "ActiveState", "--value", name],
                       capture_output=True, text=True)
    return r.stdout.strip() in ("active", "activating")


def build_constants():
    """Takt und Baudrate aus der Build-Config, die dieses Paket mitbringt."""
    values = {"CLOCK_FREQ": "", "SERIAL_BAUD": ""}
    with open(FILES + "/mcu-build-config-atmega2560") as f:
        for line in f:
            for key in values:
                if line.startswith("CONFIG_%s=" % key):
                    values[key] = line.split("=", 1)[1].strip()
    return values


def board_block_reason(port=DEFAULT_PORT):
    """Verhindert, dass die Firmware auf ein unpassendes Board geschrieben wird.

    Laeuft Klipper nicht, gibt es hier keine Aussage. Dann prueft avrdude beim
    Schreiben trotzdem die Kennung des Chips.
    """
    constants = {"MCU": test_cfg().get("FAKE_MCU")}
    if not constants["MCU"]:
        ok, data = moonraker("/printer/objects/query?mcu=mcu_constants", port)
        if not ok or data is None:
            return None
        constants = data["result"]["status"]["mcu"].get("mcu_constants") or {}
    mcu = constants.get("MCU")
    if mcu and mcu != SUPPORTED_MCU:
        return "Dieses Update ist nur für Boards mit ATmega2560. Dein Drucker meldet einen anderen Prozessor (%s)." % mcu
    build = build_constants()
    for key, value in (("CLOCK_FREQ", build["CLOCK_FREQ"]), ("SERIAL_BAUD", build["SERIAL_BAUD"])):
        current = constants.get(key)
        if current is not None and str(current) != value:
            return "Die Firmware passt nicht zu deinem Board: %s ist %s, erwartet wird %s." % (key, current, value)
    return None


def print_block_reason(port=DEFAULT_PORT, service="klipper.service"):
    """Grund, warum gerade nicht aktualisiert werden darf, sonst None."""
    reason = board_block_reason(port)
    if reason:
        return reason
    fake = test_cfg().get("FAKE_PRINT")
    if fake:
        state = fake
    else:
        ok, data = moonraker("/printer/objects/query?print_stats=state", port)
        if not ok:
            if service_active(service):
                return "Der Druckerstatus konnte nicht abgefragt werden. Bitte den Drucker neu starten und es noch einmal versuchen."
            return None
        if data is None:
            return None  # Klipper meldet einen Fehler: es laeuft sicher kein Druck
        state = data["result"]["status"]["print_stats"]["state"]
    if state in ("printing", "paused"):
        return "Gerade läuft ein Druck. Das Update ist erst nach dem Druck möglich."
    return None


def read_status():
    try:
        with open(STATUS_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_status(status):
    fd, tmp = tempfile.mkstemp(dir=STATE_DIR)
    with os.fdopen(fd, "w") as f:
        json.dump(status, f)
    os.chmod(tmp, 0o644)
    os.replace(tmp, STATUS_FILE)
