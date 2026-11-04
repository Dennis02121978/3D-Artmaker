#!/usr/bin/python3
"""Traegt die Filament-Anzeige in nginx und Mainsail ein oder wieder aus.

Aufruf: setup_host.py install|remove BENUTZER
"""
import json
import os
import pwd
import re
import shutil
import subprocess
import sys

NGINX = "/etc/nginx/sites-available/mainsail"
SEED = "/usr/share/skipr-filament"
BEGIN = "    # BEGIN skipr-filament\n"
END = "    # END skipr-filament\n"
BLOCK = BEGIN + """    location = /filament { return 302 /filament/; }

    location ^~ /filament/ {
        alias %s/;
        index index.html;
        add_header Cache-Control "no-store";
    }
""" + END + "\n"
MR_BEGIN = "# BEGIN skipr-filament\n"
MR_END = "# END skipr-filament\n"
MR_BLOCK = MR_BEGIN + """[update_manager skipr-filament]
type: web
channel: stable
repo: Dennis02121978/3D-Artmaker
path: ~/skipr-filament
""" + MR_END
HREF = "/filament/"
NAVI_ITEM = {
    "title": "Filament 2in1",
    "href": HREF,
    "target": "_self",
    "position": 94,
    "icon": "M17,20.41L18.41,19L15,15.59L13.59,17M7.5,8H11V13.59L5.59,19L7,20.41L13,14.41V8H16.5L12,3.5",
}


def strip_nginx(text):
    return re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?", "", text, flags=re.S)


def write_nginx(change):
    with open(NGINX) as f:
        old_text = f.read()
    new_text = change(old_text)
    if new_text == old_text:
        return
    with open(NGINX, "w") as f:
        f.write(new_text)
    if subprocess.run(["nginx", "-tq"]).returncode:
        with open(NGINX, "w") as f:
            f.write(old_text)
        sys.exit("nginx-Pruefung fehlgeschlagen, Aenderung zurueckgenommen.")
    subprocess.run(["systemctl", "reload", "nginx"], check=True)


def install_nginx(user):
    block = BLOCK % web_dir(user)
    marker = "    location / {\n"

    def change(text):
        text = strip_nginx(text)
        if text.count(marker) != 1:
            sys.exit("nginx: Einfuegestelle in %s nicht eindeutig." % NGINX)
        return text.replace(marker, block + marker)

    write_nginx(change)


def home(user):
    return pwd.getpwnam(user).pw_dir


def web_dir(user):
    return home(user) + "/skipr-filament"


def read_version(folder):
    try:
        with open(folder + "/release_info.json") as f:
            return str(json.load(f)["version"]).lstrip("v")
    except (OSError, ValueError, KeyError, TypeError):
        return None


def install_web(user):
    """Moonraker aktualisiert diesen Ordner. Eine neuere Seite von dort bleibt erhalten."""
    target = web_dir(user)
    current = read_version(target)
    new = read_version(SEED)
    if current and subprocess.run(["dpkg", "--compare-versions", current, "ge", new]).returncode == 0:
        return
    shutil.rmtree(target, ignore_errors=True)
    shutil.copytree(SEED, target)
    os.chmod(target, 0o755)
    shutil.chown(target, user, user)
    for name in os.listdir(target):
        path = os.path.join(target, name)
        os.chmod(path, 0o644)
        shutil.chown(path, user, user)


def write_moonraker(user, change):
    path = home(user) + "/printer_data/config/moonraker.conf"
    try:
        with open(path) as f:
            old_text = f.read()
    except FileNotFoundError:
        return
    text = re.sub(r"\n?" + re.escape(MR_BEGIN) + r".*?" + re.escape(MR_END), "", old_text, flags=re.S)
    new_text = change(text)
    if new_text == old_text:
        return
    with open(path, "w") as f:
        f.write(new_text)
    subprocess.run(["systemctl", "try-restart", "moonraker"])


def install_moonraker(user):
    write_moonraker(user, lambda text: text.rstrip("\n") + "\n\n" + MR_BLOCK)


def remove_moonraker(user):
    write_moonraker(user, lambda text: text)


def navi_path(user):
    return home(user) + "/printer_data/config/.theme/navi.json"


def read_navi(path):
    try:
        with open(path) as f:
            items = json.load(f)
        return items if isinstance(items, list) else []
    except (OSError, ValueError):
        return []


def write_navi(path, items, user):
    theme = os.path.dirname(path)
    if not os.path.isdir(theme):
        os.makedirs(theme)
        shutil.chown(theme, user, user)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(items, f, indent=2)
        f.write("\n")
    shutil.chown(tmp, user, user)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def install_navi(user):
    path = navi_path(user)
    items = [i for i in read_navi(path) if i.get("href") != HREF]
    write_navi(path, sorted(items + [NAVI_ITEM], key=lambda i: i.get("position", 0)), user)


def remove_navi(user):
    path = navi_path(user)
    if not os.path.exists(path):
        return
    items = [i for i in read_navi(path) if i.get("href") != HREF]
    if items:
        write_navi(path, items, user)
    else:
        os.remove(path)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    action, user = sys.argv[1], sys.argv[2]
    if action == "install":
        install_web(user)
        install_nginx(user)
        install_navi(user)
        install_moonraker(user)
    elif action == "remove":
        write_nginx(strip_nginx)
        remove_navi(user)
        remove_moonraker(user)
        shutil.rmtree(web_dir(user), ignore_errors=True)
    else:
        sys.exit("Unbekannte Aktion: " + action)


if __name__ == "__main__":
    main()
