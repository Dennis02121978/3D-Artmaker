"""Traegt ein Paket in den Update-Manager von Moonraker ein oder wieder aus.

Wird beim Bauen in jedes Paket kopiert, damit jedes Paket allein installierbar bleibt.
"""
import json
import os
import pwd
import re
import shutil
import subprocess

REPO = "Dennis02121978/3D-Artmaker"


def home(user):
    return pwd.getpwnam(user).pw_dir


def read_version(folder):
    try:
        with open(folder + "/release_info.json") as f:
            return str(json.load(f)["version"]).lstrip("v")
    except (OSError, ValueError, KeyError, TypeError):
        return None


def install_folder(user, folder, seed):
    """Moonraker aktualisiert diesen Ordner. Eine neuere Version von dort bleibt erhalten."""
    target = os.path.join(home(user), folder)
    current = read_version(target)
    if current and subprocess.run(["dpkg", "--compare-versions", current, "ge", read_version(seed)]).returncode == 0:
        return
    shutil.rmtree(target, ignore_errors=True)
    shutil.copytree(seed, target)
    os.chmod(target, 0o755)
    shutil.chown(target, user, user)
    for name in os.listdir(target):
        path = os.path.join(target, name)
        os.chmod(path, 0o644)
        shutil.chown(path, user, user)


def remove_folder(user, folder):
    shutil.rmtree(os.path.join(home(user), folder), ignore_errors=True)


def _write_moonraker(user, marker, block):
    path = home(user) + "/printer_data/config/moonraker.conf"
    try:
        with open(path) as f:
            old_text = f.read()
    except FileNotFoundError:
        return
    begin, end = "# BEGIN %s\n" % marker, "# END %s\n" % marker
    text = re.sub(r"\n?" + re.escape(begin) + r".*?" + re.escape(end), "", old_text, flags=re.S)
    if block:
        text = text.rstrip("\n") + "\n\n" + begin + block + end
    if text == old_text:
        return
    with open(path, "w") as f:
        f.write(text)
    subprocess.run(["systemctl", "try-restart", "moonraker"])


def register(user, marker, title, folder):
    _write_moonraker(user, marker, """[update_manager %s]
type: web
channel: stable
repo: %s
path: ~/%s
""" % (title, REPO, folder))


def unregister(user, marker):
    _write_moonraker(user, marker, "")
