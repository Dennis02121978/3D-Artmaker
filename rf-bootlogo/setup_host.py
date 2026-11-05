#!/usr/bin/python3
"""Passt die Kernel-Argumente des Raspberry Pi an und nimmt sie beim Entfernen wieder zurueck."""
import json
import os
import sys

import artmaker_updates as updates

CMDLINES = ["/boot/firmware/cmdline.txt", "/boot/cmdline.txt"]
SEED = "/usr/share/rf-bootlogo"
FOLDER = "rf-bootlogo"
MARKER = "rf-bootlogo"
TITLE = "3D-Artmaker BootScreen Pi"
STATE_DIR = "/var/lib/rf-bootlogo"
STATE = STATE_DIR + "/state.json"
ARGS = ["fbcon=map:9", "vt.global_cursor_default=0"]


def cmdline_path():
    for path in CMDLINES:
        if os.path.isfile(path):
            return path
    sys.exit("rf-bootlogo: cmdline.txt wurde nicht gefunden.")


def read_args(path):
    with open(path) as f:
        return f.read().split("\n", 1)[0].split()


def write_args(path, args):
    """Der Pi liest nur die erste Zeile. Ohne root= wuerde er nicht mehr starten."""
    if not any(a.startswith("root=") for a in args):
        sys.exit("rf-bootlogo: cmdline.txt ohne root= wird nicht geschrieben.")
    tmp = path + ".rf-tmp"
    with open(tmp, "w") as f:
        f.write(" ".join(args) + "\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
    os.sync()


def install():
    path = cmdline_path()
    args = read_args(path)
    os.makedirs(STATE_DIR, exist_ok=True)
    if not os.path.exists(STATE):
        with open(STATE, "w") as f:
            json.dump({"added": [a for a in ARGS if a not in args]}, f)
    missing = [a for a in ARGS if a not in args]
    if missing:
        write_args(path, args + missing)


def remove():
    added = ARGS
    if os.path.exists(STATE):
        with open(STATE) as f:
            added = json.load(f)["added"]
    path = cmdline_path()
    args = read_args(path)
    kept = [a for a in args if a not in added]
    if kept != args:
        write_args(path, kept)
    if os.path.exists(STATE):
        os.remove(STATE)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("install", "remove"):
        sys.exit("Aufruf: setup_host.py install|remove BENUTZER")
    user = sys.argv[2]
    if sys.argv[1] == "install":
        install()
        updates.install_folder(user, FOLDER, SEED)
        updates.register(user, MARKER, TITLE, FOLDER)
    else:
        remove()
        updates.unregister(user, MARKER)
        updates.remove_folder(user, FOLDER)
