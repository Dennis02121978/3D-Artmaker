#!/usr/bin/python3
"""Mehrere Drucker an einem Raspberry Pi: richtet weitere Klipper-Instanzen ein.

Jeder weitere Drucker bekommt
- einen eigenen Ordner ~/printer_<Name>_data mit Config, Logs und G-Codes,
- eigene Dienste klipper-<Name>.service und moonraker-<Name>.service,
- einen eigenen Moonraker-Port (7126, 7127, ...),
- ein eigenes Mainsail unter http://<IP>:81 (82, ...), zusaetzlich ist er in
  Mainsail ueber die Druckerauswahl erreichbar,
- einen Eintrag in KlipperScreen (Druckerauswahl beim Start).

Der erste Drucker (klipper.service, ~/printer_data, Port 7125, Mainsail auf
Port 80) bleibt unveraendert.

Bis zu 4 Drucker an einem Raspberry Pi (MAX_PRINTERS). Ein Pi 3 schafft zwei
Drucker gut, fuer drei oder vier gleichzeitig druckende ist ein Pi 4 oder 5 besser.

Aufruf: sudo rf-multi            Assistent
        sudo rf-multi list       Drucker und Anschluesse anzeigen
        sudo rf-multi add --name RF2000 --serial /dev/serial/by-id/... --config RF2000_DualExtruder_3mm
        sudo rf-multi remove RF2000
"""
import argparse
import json
import os
import pwd
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

SHARE = "/usr/share/rf-multi"
CONFIGS = SHARE + "/configs"
UNIT_DIR = "/etc/systemd/system"
NGINX_AVAILABLE = "/etc/nginx/sites-available"
NGINX_ENABLED = "/etc/nginx/sites-enabled"
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,30}$")
FIRST_PORT = 7126
FIRST_WEB_PORT = 81
MAX_PRINTERS = 4
CONFIG_TITLES = {
    "RF2000v2_DualExtruder": "RF2000 v2 Dual Extruder, Filament 1,75 mm",
    "RF2000_DualExtruder_3mm": "RF2000 Dual Extruder, Filament 3 mm (2,85 mm)",
}


class Abort(Exception):
    pass


def say(text=""):
    print(text, flush=True)


def run(cmd, check=True, **kw):
    r = subprocess.run(cmd, text=True, capture_output=True, **kw)
    if check and r.returncode:
        raise Abort("Befehl fehlgeschlagen: %s\n%s" % (" ".join(cmd), (r.stderr or r.stdout).strip()))
    return r


# ---------------------------------------------------------------------------
# Bestand
# ---------------------------------------------------------------------------

def klipper_user():
    user = run(["systemctl", "show", "-p", "User", "--value", "klipper.service"], check=False).stdout.strip()
    if not user:
        raise Abort("Der erste Drucker (klipper.service) wurde nicht gefunden. rf-multi braucht eine "
                    "funktionierende Installation mit Klipper, Moonraker und Mainsail.")
    return user


def home_of(user):
    return pwd.getpwnam(user).pw_dir


def section_value(path, section, key):
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


def env_value(path, key):
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return ""


def instances(home):
    """Alle Drucker: erster Drucker plus alle printer_<Name>_data mit Dienst."""
    found = []
    first = home + "/printer_data"
    if os.path.isdir(first):
        found.append({"name": None, "data": first, "klipper": "klipper", "moonraker": "moonraker"})
    for entry in sorted(os.listdir(home)):
        m = re.fullmatch(r"printer_(.+)_data", entry)
        if m and os.path.isdir(os.path.join(home, entry)):
            name = m.group(1)
            found.append({"name": name, "data": os.path.join(home, entry),
                          "klipper": "klipper-" + name, "moonraker": "moonraker-" + name})
    for inst in found:
        cfg = inst["data"] + "/config"
        port = section_value(cfg + "/moonraker.conf", "server", "port")
        inst["port"] = int(port) if port and port.isdigit() else 7125
        inst["serial"] = section_value(cfg + "/printer.cfg", "mcu", "serial") or ""
        inst["web_port"] = web_port_of(inst)
        inst["unit_exists"] = os.path.exists("%s/%s.service" % (UNIT_DIR, inst["klipper"]))
    return found


def web_port_of(inst):
    if inst["name"] is None:
        return 80
    path = "%s/mainsail-%s" % (NGINX_AVAILABLE, inst["name"])
    try:
        with open(path) as f:
            m = re.search(r"^\s*listen\s+(\d+)", f.read(), re.M)
            return int(m.group(1)) if m else None
    except OSError:
        return None


def serial_devices():
    base = "/dev/serial/by-id"
    try:
        return [os.path.join(base, n) for n in sorted(os.listdir(base))]
    except OSError:
        return []


def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def next_port(used, start):
    port = start
    while port in used or not port_free(port):
        port += 1
    return port


def host_ip():
    out = run(["hostname", "-I"], check=False).stdout.split()
    return out[0] if out else socket.gethostname()


def moonraker(port, path, data=None, method=None, timeout=5):
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), method=method,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"} if data is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except (OSError, ValueError, urllib.error.HTTPError):
        return None


def printer_name(inst):
    data = moonraker(inst["port"], "/server/database/item?namespace=mainsail&key=general.printername")
    value = str((data or {}).get("result", {}).get("value") or "").strip()
    return value or inst["name"] or socket.gethostname()


# ---------------------------------------------------------------------------
# Einrichten
# ---------------------------------------------------------------------------

def chown_tree(path, user):
    for root, dirs, files in os.walk(path):
        for name in [root] + [os.path.join(root, d) for d in dirs] + [os.path.join(root, f) for f in files]:
            if not os.path.islink(name):
                shutil.chown(name, user, user)


def write(path, text, user=None, mode=0o644):
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, mode)
    if user:
        shutil.chown(path, user, user)


def make_config(home, user, name, data, template, serial, port):
    first = home + "/printer_data"
    cfg = data + "/config"
    for sub in ("config", "logs", "gcodes", "systemd", "comms", "database", "certs", "misc"):
        os.makedirs(os.path.join(data, sub), exist_ok=True)

    src = os.path.join(CONFIGS, template)
    for fname in sorted(os.listdir(src)):
        if not fname.endswith(".cfg"):
            continue
        with open(os.path.join(src, fname)) as f:
            text = f.read()
        # Pfade auf den neuen Datenordner und den echten Benutzer umstellen
        text = text.replace("/home/pi/", home + "/")
        # printer_data/ oder printer_<Name>_data/ (Config aus dem Config Creator) auf diesen Drucker
        text = re.sub(r"printer(?:_[A-Za-z0-9_-]+?)?_data/", os.path.basename(data) + "/", text)
        if fname == "printer.cfg":
            text, n = re.subn(r"(?m)^(\[mcu\]\s*\nserial:\s*)\S+", r"\g<1>" + serial, text)
            if n != 1:
                raise Abort("In der Vorlage %s fehlt [mcu] serial." % template)
        write(os.path.join(cfg, fname), text)
    # Vorlage ohne eigene Variablen-Datei: leere Datei fuer [save_variables]
    if not os.path.exists(cfg + "/rf_variables.cfg"):
        write(cfg + "/rf_variables.cfg", "")
    for extra in ("OrcaSlicer_Einstellungen.md", "README.md"):
        if os.path.exists(os.path.join(src, extra)):
            shutil.copyfile(os.path.join(src, extra), os.path.join(cfg, extra))

    # mainsail.cfg wie beim ersten Drucker (meist ein Link auf ~/mainsail-config)
    first_ms = first + "/config/mainsail.cfg"
    if os.path.islink(first_ms):
        os.symlink(os.readlink(first_ms), cfg + "/mainsail.cfg")
    elif os.path.exists(first_ms):
        shutil.copyfile(first_ms, cfg + "/mainsail.cfg")

    # Moonraker: eigener Port, eigener Klipper-Socket, Freigaben wie beim ersten Drucker
    auth = ""
    try:
        with open(first + "/config/moonraker.conf") as f:
            m = re.search(r"(?ms)^\[authorization\]\n.*?(?=^\[|\Z)", f.read())
            auth = m.group(0).rstrip() + "\n" if m else ""
    except OSError:
        pass
    write(cfg + "/moonraker.conf", """# Moonraker fuer den Drucker %(name)s (eingerichtet mit rf-multi)
# Updates von Klipper, Moonraker und Mainsail laufen ueber den ersten Drucker.
[server]
host: 0.0.0.0
port: %(port)d
max_upload_size: 1024
klippy_uds_address: %(data)s/comms/klippy.sock

[file_manager]
enable_object_processing: False

%(auth)s
[octoprint_compat]

[history]
""" % {"name": name, "port": port, "data": data, "auth": auth or "[authorization]\ntrusted_clients:\n    127.0.0.0/8\n    192.168.0.0/16\n    10.0.0.0/8\n"})

    for fname in ("moonraker.asvc",):
        if os.path.exists(os.path.join(first, fname)):
            shutil.copyfile(os.path.join(first, fname), os.path.join(data, fname))

    # Menuepunkt Firmware-Update usw. auch in diesem Mainsail
    theme = first + "/config/.theme"
    if os.path.isdir(theme):
        shutil.copytree(theme, cfg + "/.theme", dirs_exist_ok=True)

    # Umgebungsdateien der Dienste
    k_first = first + "/systemd/klipper.env"
    klippy = env_value(k_first, "KLIPPER_ARGS").split()
    klippy_py = klippy[0] if klippy else home + "/klipper/klippy/klippy.py"
    write(data + "/systemd/klipper.env",
          'KLIPPER_ARGS="%s %s/config/printer.cfg -l %s/logs/klippy.log -I %s/comms/klippy.serial -a %s/comms/klippy.sock"\n'
          % (klippy_py, data, data, data, data))
    pythonpath = env_value(first + "/systemd/moonraker.env", "PYTHONPATH") or home + "/moonraker"
    write(data + "/systemd/moonraker.env",
          'MOONRAKER_DATA_PATH="%s"\nMOONRAKER_ARGS="-m moonraker"\nPYTHONPATH="%s"\n' % (data, pythonpath))
    chown_tree(data, user)


def make_units(home, name, data):
    first_env = home + "/printer_data/systemd/"
    for kind in ("klipper", "moonraker"):
        with open("%s/%s.service" % (UNIT_DIR, kind)) as f:
            text = f.read()
        text = text.replace(first_env + kind + ".env", data + "/systemd/" + kind + ".env")
        if data + "/systemd/" not in text:
            raise Abort("%s.service hat ein unbekanntes Format (EnvironmentFile)." % kind)
        text = re.sub(r"(?m)^Description=(.*)$", r"Description=\1 (%s)" % name, text, count=1)
        text = text.replace("Before=moonraker.service", "Before=moonraker-%s.service" % name)
        write("%s/%s-%s.service" % (UNIT_DIR, kind, name), text)
    run(["systemctl", "daemon-reload"])
    run(["systemctl", "enable", "--now", "klipper-%s.service" % name, "moonraker-%s.service" % name])


def make_nginx(name, port, web_port):
    first = NGINX_AVAILABLE + "/mainsail"
    if not os.path.exists(first):
        say("Hinweis: Mainsail-Seite in nginx nicht gefunden, eigener Mainsail-Port wird uebersprungen.")
        return None
    with open(first) as f:
        text = f.read()
    upstream = "apiserver_" + re.sub(r"[^A-Za-z0-9_]", "_", name)
    text = re.sub(r"(?m)^(\s*)listen 80 default_server;", r"\1listen %d;" % web_port, text)
    text = re.sub(r"(?m)^\s*#?\s*listen \[::\]:80 default_server;\n", "", text)
    if "listen %d;" % web_port not in text:
        raise Abort("Die nginx-Seite von Mainsail hat ein unbekanntes Format (listen 80).")
    text = text.replace("http://apiserver", "http://" + upstream)
    text = text.replace("mainsail-access.log", "mainsail-%s-access.log" % name)
    text = text.replace("mainsail-error.log", "mainsail-%s-error.log" % name)
    text = ("# Mainsail fuer den Drucker %s (eingerichtet mit rf-multi)\nupstream %s {\n    ip_hash;\n"
            "    server 127.0.0.1:%d;\n}\n\n" % (name, upstream, port)) + text
    path = "%s/mainsail-%s" % (NGINX_AVAILABLE, name)
    write(path, text)
    link = "%s/mainsail-%s" % (NGINX_ENABLED, name)
    if not os.path.lexists(link):
        os.symlink(path, link)
    if run(["nginx", "-tq"], check=False).returncode:
        os.remove(link)
        os.remove(path)
        raise Abort("nginx-Pruefung fehlgeschlagen, eigener Mainsail-Port wurde nicht eingerichtet.")
    run(["systemctl", "reload", "nginx"])
    return web_port


def wait_moonraker(port, seconds=90):
    end = time.time() + seconds
    while time.time() < end:
        if moonraker(port, "/server/info"):
            return True
        time.sleep(2)
    return False


def set_printer_name(port, name):
    moonraker(port, "/server/database/item", {"namespace": "mainsail", "key": "general.printername",
                                               "value": name}, method="POST")


def sync_mainsail(home):
    """Jedes Mainsail kennt alle Drucker (Druckerauswahl oben links)."""
    ip = host_ip()
    insts = [i for i in instances(home) if i["name"] is None or i["unit_exists"]]
    for inst in insts:
        data = moonraker(inst["port"], "/server/database/item?namespace=mainsail&key=remoteprinters")
        existing = ((data or {}).get("result", {}).get("value") or {}).get("printers", {}) or {}
        # Eintraege, die rf-multi angelegt hat, neu schreiben
        for key, value in existing.items():
            if isinstance(value, dict) and (value.get("settings") or {}).get("rf_multi"):
                moonraker(inst["port"], "/server/database/item?namespace=mainsail&key=remoteprinters.printers."
                          + key, method="DELETE")
        for other in insts:
            if any(isinstance(v, dict) and str(v.get("port")) == str(other["port"]) and v.get("hostname") == ip
                   and not (v.get("settings") or {}).get("rf_multi") for v in existing.values()):
                continue  # Schon von Hand eingetragen
            moonraker(inst["port"], "/server/database/item", {
                "namespace": "mainsail", "key": "remoteprinters.printers." + str(uuid.uuid4()),
                "value": {"hostname": ip, "port": other["port"], "path": "/",
                          "settings": {"rf_multi": True}}}, method="POST")


def sync_klipperscreen(home, user):
    """KlipperScreen zeigt beim Start die Druckerauswahl."""
    path = home + "/printer_data/config/KlipperScreen.conf"
    try:
        with open(path) as f:
            text = f.read()
    except FileNotFoundError:
        text = ""
    marker = "#~# --- Do not edit below this line"
    head, sep, tail = text.partition(marker)
    head = re.sub(r"(?ms)^# BEGIN rf-multi\n.*?^# END rf-multi\n?", "", head)
    insts = [i for i in instances(home) if i["name"] is None or i["unit_exists"]]
    block = ""
    if len(insts) > 1:
        block = "# BEGIN rf-multi\n# Druckerauswahl, eingerichtet mit rf-multi\n"
        for inst in insts:
            block += "[printer %s]\nmoonraker_host: 127.0.0.1\nmoonraker_port: %d\n\n" % (printer_name(inst), inst["port"])
        block += "# END rf-multi\n"
    head = head.strip("\n")
    parts = [p for p in (head, block.rstrip("\n")) if p]
    new = "\n\n".join(parts) + ("\n\n" if parts and sep else "\n" if parts else "") + sep + tail
    if new != text:
        write(path, new, user, 0o664)
        if run(["systemctl", "is-active", "--quiet", "KlipperScreen.service"], check=False).returncode == 0:
            run(["systemctl", "restart", "KlipperScreen.service"], check=False)


def add(home, user, name, serial, template):
    if not NAME_RE.match(name):
        raise Abort("Der Name darf nur Buchstaben, Ziffern, - und _ enthalten (ohne Leerzeichen).")
    data = "%s/printer_%s_data" % (home, name)
    if os.path.exists(data) or os.path.exists("%s/klipper-%s.service" % (UNIT_DIR, name)):
        raise Abort("Ein Drucker mit dem Namen %s existiert schon." % name)
    if template not in os.listdir(CONFIGS):
        raise Abort("Unbekannte Config-Vorlage: %s" % template)
    if not os.path.exists(serial):
        raise Abort("Anschluss nicht gefunden: %s" % serial)
    insts = instances(home)
    active = [i for i in insts if i["name"] is None or i["unit_exists"]]
    if len(active) >= MAX_PRINTERS:
        raise Abort("An diesem Raspberry Pi laufen schon %d Drucker, mehr als %d werden nicht unterstuetzt."
                    % (len(active), MAX_PRINTERS))
    for inst in insts:
        if inst["serial"] and os.path.realpath(inst["serial"]) == os.path.realpath(serial):
            raise Abort("Dieser Anschluss gehoert schon zum Drucker %s." % (inst["name"] or "1 (printer_data)"))
    port = next_port({i["port"] for i in insts}, FIRST_PORT)
    web_port = next_port({i["web_port"] for i in insts if i["web_port"]}, FIRST_WEB_PORT)

    say("Lege Drucker %s an (Moonraker-Port %d, Mainsail-Port %d) ..." % (name, port, web_port))
    make_config(home, user, name, data, template, serial, port)
    make_units(home, name, data)
    web = make_nginx(name, port, web_port)
    say("Warte auf Moonraker ...")
    if wait_moonraker(port):
        set_printer_name(port, name)
        if not moonraker(7125, "/server/database/item?namespace=mainsail&key=general.printername"):
            set_printer_name(7125, "Drucker 1")
    else:
        say("Hinweis: Moonraker fuer %s antwortet noch nicht, Name und Druckerauswahl bitte spaeter mit "
            "'sudo rf-multi sync' nachtragen." % name)
    sync_mainsail(home)
    sync_klipperscreen(home, user)
    ip = host_ip()
    say("")
    say("Fertig. Der Drucker %s ist eingerichtet:" % name)
    if web:
        say("  Mainsail:       http://%s:%d" % (ip, web))
    say("  Druckerauswahl: in Mainsail links unter „Drucker“ und in KlipperScreen beim Start")
    say("  Config:         %s/config" % data)
    say("Vor dem ersten Druck die Config pruefen und kalibrieren (README im Config-Ordner).")


def remove(home, name):
    if not NAME_RE.match(name):
        raise Abort("Ungueltiger Name.")
    units = ["klipper-%s.service" % name, "moonraker-%s.service" % name]
    if not any(os.path.exists(os.path.join(UNIT_DIR, u)) for u in units):
        raise Abort("Drucker %s wurde nicht gefunden." % name)
    run(["systemctl", "disable", "--now"] + units, check=False)
    for u in units:
        try:
            os.remove(os.path.join(UNIT_DIR, u))
        except FileNotFoundError:
            pass
    run(["systemctl", "daemon-reload"])
    for path in ("%s/mainsail-%s" % (NGINX_ENABLED, name), "%s/mainsail-%s" % (NGINX_AVAILABLE, name)):
        if os.path.lexists(path):
            os.remove(path)
    run(["systemctl", "reload", "nginx"], check=False)
    say("Drucker %s entfernt. Der Ordner %s/printer_%s_data mit Config und G-Codes bleibt erhalten."
        % (name, home, name))


def show_list(home):
    say("Drucker:")
    for inst in instances(home):
        if inst["name"] is not None and not inst["unit_exists"]:
            continue
        say("  %-14s Moonraker %-5d Mainsail %-4s %s" % (
            printer_name(inst), inst["port"], inst["web_port"] or "-", os.path.basename(inst["serial"])))
    used = {os.path.realpath(i["serial"]) for i in instances(home) if i["serial"]}
    free = [d for d in serial_devices() if os.path.realpath(d) not in used]
    say("Freie Anschluesse:" if free else "Keine freien Anschluesse gefunden.")
    for d in free:
        say("  " + d)


# ---------------------------------------------------------------------------
# Assistent
# ---------------------------------------------------------------------------

def ask(prompt, default=None):
    text = input("%s%s: " % (prompt, " [%s]" % default if default else "")).strip()
    return text or default


def pick(prompt, options):
    for n, (_value, label) in enumerate(options, 1):
        say("  %d) %s" % (n, label))
    while True:
        answer = ask(prompt, "1")
        if answer and answer.isdigit() and 1 <= int(answer) <= len(options):
            return options[int(answer) - 1][0]
        say("Bitte eine Zahl von 1 bis %d eingeben." % len(options))


def wizard(home, user):
    say("Weiteren Drucker an diesem Raspberry Pi einrichten")
    say("==================================================")
    insts = instances(home)
    active = [i for i in insts if i["name"] is None or i["unit_exists"]]
    if len(active) >= MAX_PRINTERS:
        raise Abort("An diesem Raspberry Pi laufen schon %d Drucker (hoechstens %d)." % (len(active), MAX_PRINTERS))
    used = {os.path.realpath(i["serial"]) for i in insts if i["serial"]}
    free = [d for d in serial_devices() if os.path.realpath(d) not in used]
    say("Bis zu %d Drucker koennen an diesem Raspberry Pi laufen. Vorhanden:" % MAX_PRINTERS)
    for inst in insts:
        if inst["name"] is None or inst["unit_exists"]:
            say("  %s  (%s)" % (printer_name(inst), os.path.basename(inst["serial"]) or "kein Anschluss"))
    say("")
    if not free:
        raise Abort("Kein freier Anschluss gefunden. Ist der zweite Drucker per USB angeschlossen und eingeschaltet?")
    say("1. Anschluss des neuen Druckers:")
    serial = pick("Nummer", [(d, os.path.basename(d)) for d in free])
    say("")
    say("2. Config-Vorlage:")
    templates = sorted(os.listdir(CONFIGS))
    template = pick("Nummer", [(t, CONFIG_TITLES.get(t, t)) for t in templates])
    say("")
    say("3. Name des Druckers (Buchstaben, Ziffern, - und _), z. B. RF2000.")
    say("   Erzeugst du die Config im Config Creator, dort denselben Namen eintragen.")
    while True:
        name = ask("Name")
        if name and NAME_RE.match(name):
            break
        say("Ungueltiger Name.")
    say("")
    if (ask("Jetzt einrichten? (j/n)", "j") or "").lower() not in ("j", "ja", "y", "yes"):
        raise Abort("Abgebrochen, es wurde nichts geaendert.")
    add(home, user, name, serial, template)


def main():
    parser = argparse.ArgumentParser(description="Mehrere Drucker an einem Raspberry Pi")
    sub = parser.add_subparsers(dest="cmd")
    sub.add_parser("list")
    sub.add_parser("sync", help="Mainsail und KlipperScreen auf alle Drucker abgleichen")
    p_add = sub.add_parser("add")
    p_add.add_argument("--name", required=True)
    p_add.add_argument("--serial", required=True)
    p_add.add_argument("--config", default="RF2000v2_DualExtruder")
    p_rm = sub.add_parser("remove")
    p_rm.add_argument("name")
    args = parser.parse_args()
    if os.geteuid() != 0:
        sys.exit("Bitte mit sudo starten: sudo rf-multi")
    try:
        user = klipper_user()
        home = home_of(user)
        if args.cmd == "list":
            show_list(home)
        elif args.cmd == "sync":
            sync_mainsail(home)
            sync_klipperscreen(home, user)
            say("Mainsail und KlipperScreen abgeglichen.")
        elif args.cmd == "add":
            add(home, user, args.name, args.serial, args.config)
        elif args.cmd == "remove":
            remove(home, args.name)
            sync_mainsail(home)
            sync_klipperscreen(home, user)
        else:
            wizard(home, user)
    except Abort as e:
        sys.exit("Fehler: %s" % e)
    except (KeyboardInterrupt, EOFError):
        sys.exit("\nAbgebrochen.")


if __name__ == "__main__":
    main()
