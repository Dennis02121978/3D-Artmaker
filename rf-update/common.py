"""Gemeinsame Hilfen fuer Update-Ablauf und Webseite."""
import json
import os
import pwd
import subprocess
import tempfile
import urllib.error
import urllib.request

BASE = "/usr/lib/rf-update"
FILES = BASE + "/files"
STATE_DIR = "/var/lib/rf-update"
STATUS_FILE = STATE_DIR + "/status.json"
LOG_FILE = STATE_DIR + "/update.log"
CONFIG = "/etc/rf-update/config"
TEST_ENV = "/etc/rf-update/test.env"
UNIT = "rf-update.service"
MOONRAKER = "http://127.0.0.1:7125"
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


def moonraker(path):
    """Liefert (erreichbar, JSON oder None)."""
    try:
        with urllib.request.urlopen(MOONRAKER + path, timeout=3) as r:
            return True, json.load(r)
    except urllib.error.HTTPError:
        return True, None
    except (OSError, ValueError):
        return False, None


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


def board_block_reason():
    """Verhindert, dass die Firmware auf ein unpassendes Board geschrieben wird.

    Laeuft Klipper nicht, gibt es hier keine Aussage. Dann prueft avrdude beim
    Schreiben trotzdem die Kennung des Chips.
    """
    constants = {"MCU": test_cfg().get("FAKE_MCU")}
    if not constants["MCU"]:
        ok, data = moonraker("/printer/objects/query?mcu=mcu_constants")
        if not ok or data is None:
            return None
        constants = data["result"]["status"]["mcu"].get("mcu_constants", {})
    mcu = constants.get("MCU")
    if mcu and mcu != SUPPORTED_MCU:
        return "Dieses Update ist nur für Boards mit ATmega2560. Dein Drucker meldet einen anderen Prozessor (%s)." % mcu
    build = build_constants()
    for key, value in (("CLOCK_FREQ", build["CLOCK_FREQ"]), ("SERIAL_BAUD", build["SERIAL_BAUD"])):
        current = constants.get(key)
        if current is not None and str(current) != value:
            return "Die Firmware passt nicht zu deinem Board: %s ist %s, erwartet wird %s." % (key, current, value)
    return None


def print_block_reason():
    """Grund, warum gerade nicht aktualisiert werden darf, sonst None."""
    reason = board_block_reason()
    if reason:
        return reason
    fake = test_cfg().get("FAKE_PRINT")
    if fake:
        state = fake
    else:
        ok, data = moonraker("/printer/objects/query?print_stats=state")
        if not ok:
            if service_active("klipper.service"):
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
