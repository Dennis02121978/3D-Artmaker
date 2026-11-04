#!/usr/bin/env python3
"""Firmware-Update fuer MKS SKIPR ohne Eingaben, Ablauf nach skipr_flash v2.1.

Unterschiede zum Skript:
- Die Dateien vom Update-Server liegen geprueft auf dem Drucker und werden nicht
  bei jedem Lauf ungesichert per HTTP geladen.
- Die Firmware wird gebaut, bevor Klipper gestoppt wird. Ein Build-Fehler
  unterbricht den Drucker also nicht.
- Bei einem Fehler werden Klipper und Moonraker wieder gestartet.
"""
import hashlib
import os
import shutil
import subprocess
import time

import common as c

USER = c.USER
ENV = ["env", "HOME=" + c.HOME, "LANG=C",
       "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"]
FLASH_TRIES = 3
BOARD_DEFS = "scripts/spi_flash/board_defs.py"
TEMP_FILES = ["flash_card", "board_defs.py", "mcu-build-config-skipr", "linux_process"]
OLD_CONFIGS = ["mcu-build-config-skipr.old", "linux_process.old"]  # Sicherungen von olddefconfig

STEPS = [
    ("check", "Drucker wird geprüft", 3),
    ("source", "Neue Software wird geladen", 12),
    ("build_mcu", "Firmware wird erstellt (dauert ein paar Minuten)", 45),
    ("stop", "Drucker-Dienste werden angehalten", 48),
    ("flash", "Firmware wird auf das Board geschrieben", 65),
    ("build_host", "Zusatzprogramm wird erstellt und installiert", 88),
    ("finish", "Aufräumen", 95),
    ("reboot", "Drucker startet neu", 100),
]
MESSAGES = {
    "check": "Die Prüfung vor dem Update ist fehlgeschlagen.",
    "source": "Die neue Software konnte nicht geladen werden. Bitte die Internetverbindung des Druckers prüfen und es erneut versuchen.",
    "build_mcu": "Die Firmware konnte nicht erstellt werden. Es wurde nichts auf das Board geschrieben. Bitte erneut versuchen.",
    "stop": "Die Drucker-Dienste konnten nicht angehalten werden. Es wurde nichts auf das Board geschrieben. Bitte den Drucker neu starten und es erneut versuchen.",
    "flash": "Die Firmware konnte nicht auf das Board geschrieben werden. Bitte den Drucker aus- und wieder einschalten und das Update erneut starten.",
    "build_host": "Die Firmware wurde geschrieben, das Zusatzprogramm konnte aber nicht installiert werden. Bitte das Update erneut starten.",
}

status = {}
simulate = False
log = None


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


def verify_files():
    with open(c.FILES + "/SHA256SUMS") as f:
        for line in f:
            digest, name = line.split()
            with open(os.path.join(c.FILES, name), "rb") as data:
                if hashlib.sha256(data.read()).hexdigest() != digest:
                    raise Fail("Datei beschädigt: " + name)


def check():
    reason = c.print_block_reason()
    if reason:
        raise Fail(reason)
    verify_files()
    if not simulate:
        if not os.path.exists("/dev/ttyS0"):
            raise Fail("Das Board wurde nicht gefunden (/dev/ttyS0).")
        if shutil.disk_usage("/").free < 300 * 1024 * 1024:
            raise Fail("Zu wenig freier Speicher auf dem Drucker.")
        for tool in ("arm-none-eabi-gcc", "make", "git"):
            if not shutil.which(tool):
                raise Fail("Programm fehlt: " + tool)


def put_files():
    if simulate:
        return
    for name in TEMP_FILES:
        target = os.path.join(c.KLIPPER, name)
        shutil.copyfile(os.path.join(c.FILES, name), target)
        shutil.chown(target, USER, USER)
        os.chmod(target, 0o755 if name == "flash_card" else 0o644)


def clean_files():
    if simulate:
        return
    for name in TEMP_FILES + OLD_CONFIGS:
        try:
            os.remove(os.path.join(c.KLIPPER, name))
        except FileNotFoundError:
            pass
    run(["git", "checkout", BOARD_DEFS], check=False)


def flash():
    run(["cp", "board_defs.py", BOARD_DEFS])
    for attempt in range(1, FLASH_TRIES + 1):
        say("Flash-Versuch %d von %d" % (attempt, FLASH_TRIES))
        subprocess.run(["sync"])
        time.sleep(1)
        if run(["./flash_card", "/dev/ttyS0", "mks-skipr"], timeout=300, check=False) == 0:
            return
        time.sleep(3)
    raise Fail("Flashen nach %d Versuchen fehlgeschlagen" % FLASH_TRIES)


def update():
    stopped = False
    try:
        enter("check")
        check()

        enter("source")
        clean_files()
        run(["git", "pull"], timeout=300)
        if not simulate and not os.path.exists(os.path.join(c.KLIPPER, "Makefile")):
            run(["git", "reset", "--hard", "HEAD"])

        enter("build_mcu")
        put_files()
        run(["make", "clean", "KCONFIG_CONFIG=mcu-build-config-skipr"])
        # Die Config stammt aus einer aelteren Klipper-Version. Ohne diesen Schritt
        # fehlen neue Optionen wie WANT_I2C, WANT_BUTTONS oder WANT_NEOPIXEL.
        run(["make", "olddefconfig", "KCONFIG_CONFIG=mcu-build-config-skipr"])
        run(["make", "-j4", "KCONFIG_CONFIG=mcu-build-config-skipr"], timeout=1800)

        enter("stop")
        status["danger"] = True
        save()
        stopped = True
        run(["systemctl", "stop", "klipper"], root=True, timeout=120)
        run(["systemctl", "stop", "moonraker"], root=True, timeout=120)
        run(["killall", "-9", "klippy"], root=True, check=False)
        time.sleep(2)

        enter("flash")
        flash()

        enter("build_host")
        run(["git", "checkout", BOARD_DEFS])
        run(["make", "clean", "KCONFIG_CONFIG=linux_process"])
        run(["make", "olddefconfig", "KCONFIG_CONFIG=linux_process"])
        run(["make", "-j4", "KCONFIG_CONFIG=linux_process"], timeout=1800)
        run(["./scripts/flash-linux.sh", "out"], root=True, timeout=120)

        enter("finish")
        try:
            clean_files()
            run(["git", "reset", "--hard", "HEAD"], check=False)
            run(["git", "pull"], timeout=300, check=False)
            run(["find", ".", "-maxdepth", "1", "-name", "*.old", "-type", "f", "-delete"], check=False)
        except Exception as e:  # Aufraeumen darf den Neustart nicht verhindern
            say("Aufräumen unvollständig: %s" % e)

        enter("reboot")
        status["state"] = "rebooting"
        status["percent"] = 100
        status["finished"] = time.time()
        save()
        say("Update erfolgreich, Neustart in 5 Sekunden")
        time.sleep(5)
        if simulate:
            status["state"] = "done"
            status["danger"] = False
            save()
            return
        subprocess.run(["sync"])
        subprocess.run(["systemctl", "reboot"])
    except Exception as e:
        step = status.get("step")
        say("FEHLER: %s" % e)
        text = str(e) if step == "check" and isinstance(e, Fail) else MESSAGES.get(step, "Das Update ist fehlgeschlagen.")
        status.update(state="failed", message=text, danger=False, finished=time.time())
        for item in status.get("steps", []):
            if item["state"] == "active":
                item["state"] = "failed"
        save()
        if step != "check":
            try:
                clean_files()
            except Exception as cleanup_error:
                say("Aufräumen fehlgeschlagen: %s" % cleanup_error)
        if stopped:
            run(["systemctl", "start", "moonraker", "klipper"], root=True, check=False)


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
