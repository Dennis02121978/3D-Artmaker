#!/usr/bin/python3
"""Passt Boot-Einstellungen an und stellt sie beim Entfernen wieder her."""
import json
import os
import shutil
import sys

import artmaker_updates as updates

ENV = "/boot/armbianEnv.txt"
MODULES = "/etc/modules"
SEED = "/usr/share/skipr-bootlogo"
FOLDER = "skipr-bootlogo"
MARKER = "skipr-bootlogo"
TITLE = "3D-Artmaker BootScreen"
STATE_DIR = "/var/lib/skipr-bootlogo"
STATE = STATE_DIR + "/state.json"
MODULE = "fb_st7796"
ARGS = ["fbcon=map:9", "vt.global_cursor_default=0"]
OLD_BACKUPS = [ENV + ".vor-logo", MODULES + ".vor-logo"]  # fruehere manuelle Installation


def read_lines(path):
    with open(path) as f:
        return f.read().splitlines()


def write_lines(path, lines):
    tmp = path + ".skipr-tmp"
    with open(tmp, "w") as f:
        f.write("\n".join(lines) + "\n")
        f.flush()
        os.fsync(f.fileno())
    shutil.copymode(path, tmp)
    os.replace(tmp, path)


def env_value(lines, key):
    for line in lines:
        if line.startswith(key + "="):
            return line.split("=", 1)[1]
    return None


def set_env(lines, key, value):
    """value=None entfernt den Eintrag."""
    result = [l for l in lines if not l.startswith(key + "=")]
    if value is not None:
        result.append("%s=%s" % (key, value))
    return result


def initial_state():
    """Merkt sich den Zustand vor der Aenderung, auch von einer manuellen Installation."""
    env_src, modules_src = ENV, MODULES
    if os.path.exists(OLD_BACKUPS[0]) and os.path.exists(OLD_BACKUPS[1]):
        env_src, modules_src = OLD_BACKUPS
    return {
        "bootlogo_before": env_value(read_lines(env_src), "bootlogo"),
        "module_added": MODULE not in read_lines(modules_src),
    }


def install():
    os.makedirs(STATE_DIR, exist_ok=True)
    if not os.path.exists(STATE):
        with open(STATE, "w") as f:
            json.dump(initial_state(), f)
    lines = read_lines(ENV)
    extra = (env_value(lines, "extraargs") or "").split()
    extra += [a for a in ARGS if a not in extra]
    lines = set_env(lines, "bootlogo", "false")
    lines = set_env(lines, "extraargs", " ".join(extra))
    write_lines(ENV, lines)
    modules = read_lines(MODULES)
    if MODULE not in modules:
        write_lines(MODULES, modules + [MODULE])
    for path in OLD_BACKUPS:
        if os.path.exists(path):
            os.remove(path)


def remove():
    state = {"bootlogo_before": "true", "module_added": False}
    if os.path.exists(STATE):
        with open(STATE) as f:
            state = json.load(f)
    lines = read_lines(ENV)
    extra = [a for a in (env_value(lines, "extraargs") or "").split() if a not in ARGS]
    lines = set_env(lines, "extraargs", " ".join(extra) or None)
    lines = set_env(lines, "bootlogo", state["bootlogo_before"])
    write_lines(ENV, lines)
    if state["module_added"]:
        write_lines(MODULES, [l for l in read_lines(MODULES) if l != MODULE])
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
