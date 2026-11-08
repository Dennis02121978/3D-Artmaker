#!/usr/bin/env python3
"""Firmware-Update fuer ATmega2560-Boards ohne Eingaben.

Die Firmware wird gebaut, bevor Klipper gestoppt wird. Scheitert das, geht der
Klipper-Code auf den alten Stand zurueck und das Board bleibt unberuehrt.

Mit mehreren Druckern an einem Rechner waehlt die Webseite den Drucker aus
(request.json). Angehalten und geflasht wird nur dieser Drucker. Seine LED
leuchtet waehrend des Updates rot und danach 5 Sekunden gruen.
"""
import hashlib
import json
import os
import shutil
import subprocess
import time

import common as c

USER = c.USER
ENV = ["env", "HOME=" + c.HOME, "LANG=C",
       "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"]
FLASH_TRIES = 3
READY_SECONDS = 120

STEPS = [
    ("check", "Drucker wird geprüft", 5),
    ("source", "Neue Software wird geladen", 20),
    ("build_mcu", "Firmware wird erstellt", 55),
    ("stop", "Klipper wird angehalten", 60),
    ("flash", "Firmware wird auf das Board geschrieben", 85),
    ("start", "Klipper wird gestartet und geprüft", 98),
    ("finish", "Aufräumen", 100),
]
MESSAGES = {
    "check": "Die Prüfung vor dem Update ist fehlgeschlagen.",
    "source": "Die neue Software konnte nicht geladen werden. Bitte die Internetverbindung des Druckers prüfen und es erneut versuchen.",
    "build_mcu": "Die Firmware konnte nicht erstellt werden. Es wurde nichts auf das Board geschrieben. Bitte erneut versuchen.",
    "stop": "Klipper konnte nicht angehalten werden. Es wurde nichts auf das Board geschrieben. Bitte den Drucker neu starten und es erneut versuchen.",
    "flash": "Die Firmware konnte nicht auf das Board geschrieben werden. Bitte den Drucker aus- und wieder einschalten und das Update erneut starten.",
    "start": "Die Firmware wurde geschrieben, Klipper wurde aber nicht bereit. Bitte die Meldung in Mainsail prüfen.",
}

status = {}
simulate = False
log = None
inst = None  # Gewaehlter Drucker, siehe common.instances()


class Fail(Exception):
    pass


def save():
    c.write_status(status)


def say(text):
    log.write(text + "\n")
    log.flush()


def enter(step_id):
    index = [s[0] for s in STEPS].index(step_id)
    status["step"] = step_id
    status["percent"] = STEPS[index - 1][2] if index else 0
    status["steps"] = [{"title": t, "state": "done" if i < index else "active" if i == index else "todo"}
                       for i, (_, t, _p) in enumerate(STEPS)]
    say("\n=== " + STEPS[index][1] + " ===")
    save()
    if c.test_cfg().get("FAIL_STEP") == step_id:
        raise Fail("Simulierter Fehler")


def run(cmd, root=False, timeout=600, check=True):
    say("$ " + " ".join(cmd))
    if simulate:
        time.sleep(1)
        return 0
    prefix = ENV if root else ["runuser", "-u", USER, "--"] + ENV
    r = subprocess.run(prefix + cmd, cwd=c.KLIPPER, stdout=log, stderr=subprocess.STDOUT,
                       stdin=subprocess.DEVNULL, timeout=timeout)
    if check and r.returncode:
        raise Fail("Befehl fehlgeschlagen (%d): %s" % (r.returncode, " ".join(cmd)))
    return r.returncode


def git_out(*args):
    r = subprocess.run(["runuser", "-u", USER, "--", "git", "-C", c.KLIPPER] + list(args),
                       capture_output=True, text=True, timeout=30)
    return r.stdout.strip() if r.returncode == 0 else ""


def verify_files():
    with open(c.FILES + "/SHA256SUMS") as f:
        for line in f:
            digest, name = line.split()
            with open(os.path.join(c.FILES, name), "rb") as data:
                if hashlib.sha256(data.read()).hexdigest() != digest:
                    raise Fail("Datei beschädigt: " + name)


def choose_instance():
    """Drucker aus der Anfrage der Webseite, bei nur einem Drucker diesen."""
    try:
        with open(c.REQUEST_FILE) as f:
            wanted = json.load(f).get("printer")
    except (OSError, ValueError, AttributeError):
        wanted = None
    found = c.instances()
    if wanted:
        for item in found:
            if item["id"] == wanted:
                return item
        raise Fail("Der gewählte Drucker wurde nicht gefunden.")
    if len(found) == 1:
        return found[0]
    if not found:
        raise Fail("Es wurde kein Klipper-Drucker gefunden.")
    raise Fail("Es sind mehrere Drucker angeschlossen. Bitte auf der Update-Seite einen auswählen.")


def led(mode, color="RED", duration=30):
    if inst and not simulate or inst and c.test_cfg().get("SIMULATE_LED") == "1":
        say("LED: %s %s" % (mode, color))
        c.led_signal(inst["port"], mode, color, duration)


def check():
    reason = c.print_block_reason(inst["port"], inst["service"])
    if reason:
        raise Fail(reason)
    verify_files()
    if simulate:
        return "/dev/null"
    device = inst["serial"]
    if not device:
        raise Fail("In der printer.cfg von %s wurde bei [mcu] kein Anschluss (serial) gefunden." % inst["name"])
    if not os.path.exists(device):
        raise Fail("Das Board wurde nicht gefunden (%s). Bitte Kabel und Stromversorgung prüfen." % device)
    if shutil.disk_usage("/").free < 300 * 1024 * 1024:
        raise Fail("Zu wenig freier Speicher auf dem Drucker.")
    for tool in ("avr-gcc", "avrdude", "make", "git"):
        if not shutil.which(tool):
            raise Fail("Programm fehlt: " + tool)
    if git_out("status", "--porcelain"):
        raise Fail("Im Klipper-Ordner gibt es eigene Änderungen. Bitte erst klären, sonst würden sie beim Update stören.")
    return device


def put_config():
    if simulate:
        return
    target = os.path.join(c.KLIPPER, ".config")
    shutil.copyfile(c.FILES + "/mcu-build-config-atmega2560", target)
    shutil.chown(target, USER, USER)


def flash(device):
    for attempt in range(1, FLASH_TRIES + 1):
        say("Flash-Versuch %d von %d" % (attempt, FLASH_TRIES))
        subprocess.run(["sync"])
        time.sleep(1)
        if run(["make", "flash", "FLASH_DEVICE=" + device], timeout=300, check=False) == 0:
            return
        time.sleep(3)
    raise Fail("Flashen nach %d Versuchen fehlgeschlagen" % FLASH_TRIES)


def wait_ready():
    if simulate:
        return
    message = ""
    end = time.time() + READY_SECONDS
    while time.time() < end:
        ok, data = c.moonraker("/printer/info", inst["port"])
        if ok and data:
            result = data["result"]
            if result["state"] == "ready":
                say("Klipper ist bereit")
                return
            message = result.get("state_message", "")
        time.sleep(3)
    raise Fail("Klipper wurde nicht bereit: " + message)


def update():
    global inst
    stopped = False
    flash_started = False
    old_commit = ""
    try:
        enter("check")
        inst = choose_instance()
        status.update(printer=inst["id"], printer_name=inst["name"])
        save()
        say("Drucker: %s (%s, %s)" % (inst["name"], inst["service"], inst["serial"]))
        device = check()
        led("ON", "RED", 3600)

        enter("source")
        old_commit = "" if simulate else git_out("rev-parse", "HEAD")
        run(["git", "pull", "--ff-only"], timeout=300)

        enter("build_mcu")
        put_config()
        run(["make", "clean"])
        run(["make", "olddefconfig"])
        run(["make", "-j3"], timeout=1800)

        enter("stop")
        status["danger"] = True
        save()
        stopped = True
        run(["systemctl", "stop", inst["service"]], root=True, timeout=120)
        time.sleep(2)

        enter("flash")
        flash_started = True
        flash(device)

        enter("start")
        run(["systemctl", "start", inst["service"]], root=True, timeout=120)
        stopped = False
        status["danger"] = False
        save()
        wait_ready()
        led("ON", "GREEN", 5)

        enter("finish")
        status.update(state="done", percent=100, finished=time.time(), danger=False)
        for item in status["steps"]:
            item["state"] = "done"
        save()
        say("Update erfolgreich")
    except Exception as e:
        step = status.get("step")
        say("FEHLER: %s" % e)
        text = str(e) if step == "check" and isinstance(e, Fail) else MESSAGES.get(step, "Das Update ist fehlgeschlagen.")
        status.update(state="failed", message=text, danger=False, finished=time.time())
        for item in status.get("steps", []):
            if item["state"] == "active":
                item["state"] = "failed"
        save()
        # Noch nichts geschrieben: Der Code muss zur Firmware auf dem Board passen
        if old_commit and not flash_started:
            run(["git", "reset", "--hard", old_commit], check=False)
        if stopped and inst:
            run(["systemctl", "start", inst["service"]], root=True, check=False)
        elif not stopped:
            led("OFF")


def main():
    global simulate, log
    os.makedirs(c.STATE_DIR, exist_ok=True)
    simulate = c.test_cfg().get("SIMULATE") == "1"
    log = open(c.LOG_FILE, "w")
    os.chmod(c.LOG_FILE, 0o644)
    status.update(state="running", started=time.time(), boot_id=c.boot_id(), percent=0,
                  danger=False, message="", simulate=simulate)
    update()


if __name__ == "__main__":
    main()
