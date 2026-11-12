#!/usr/bin/python3
"""Traegt das System-Terminal in nginx und Mainsail ein oder wieder aus.

nginx: alle Mainsail-Seiten (mainsail und mainsail-NAME von rf-multi).
Mainsail: Menuepunkt in jeder .theme/navi.json der Drucker dieses Benutzers.
"""
import glob
import json
import os
import pwd
import re
import shutil
import subprocess
import sys

SITES = "/etc/nginx/sites-available"
BEGIN = "    # BEGIN rf-terminal\n"
END = "    # END rf-terminal\n"
BLOCK = BEGIN + """    location = /terminal { return 302 /terminal/; }

    # Seite mit Logo, das Terminal selbst steckt darin unter /terminal/tty/
    location ^~ /terminal/ {
        alias /usr/share/rf-terminal/;
        index index.html;
    }

    location ^~ /terminal/tty/ {
        proxy_pass http://127.0.0.1:7683/;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }
""" + END + "\n"
MARKER = "    location / {\n"
HREF = "/terminal/"
NAVI_ITEM = {
    "title": "System Terminal",
    "href": HREF,
    "target": "_self",
    "position": 96,
    # mdi-console
    "icon": "M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z",
}


def sites():
    return [p for p in sorted(glob.glob(SITES + "/mainsail*"))
            if os.path.isfile(p) and not p.endswith((".bak", "~")) and ".vor-" not in p]


def strip_nginx(text):
    return re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?", "", text, flags=re.S)


def add_nginx(text):
    text = strip_nginx(text)
    if text.count(MARKER) != 1:
        return None
    return text.replace(MARKER, BLOCK + MARKER)


def change_nginx(change):
    """Aendert alle Seiten, prueft nginx einmal und nimmt bei einem Fehler alles zurueck."""
    old = {}
    for path in sites():
        with open(path) as f:
            text = f.read()
        new = change(text)
        if new is None:
            print("rf-terminal: %s hat ein unbekanntes Format, uebersprungen." % path)
            continue
        if new != text:
            old[path] = text
            with open(path, "w") as f:
                f.write(new)
    if not old:
        return
    if subprocess.run(["nginx", "-tq"]).returncode:
        for path, text in old.items():
            with open(path, "w") as f:
                f.write(text)
        sys.exit("nginx-Pruefung fehlgeschlagen, Aenderung zurueckgenommen.")
    subprocess.run(["systemctl", "reload", "nginx"])


def theme_dirs(user):
    home = pwd.getpwnam(user).pw_dir
    return [d + "/config/.theme" for d in sorted(glob.glob(home + "/printer*_data"))
            if os.path.isdir(d + "/config")]


def read_navi(path):
    try:
        with open(path) as f:
            items = json.load(f)
        return items if isinstance(items, list) else []
    except (OSError, ValueError):
        return []


def write_navi(path, items, user):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(items, f, indent=2)
        f.write("\n")
    shutil.chown(tmp, user, user)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def install_navi(user):
    for theme in theme_dirs(user):
        if not os.path.isdir(theme):
            os.makedirs(theme)
            shutil.chown(theme, user, user)
        path = theme + "/navi.json"
        items = [i for i in read_navi(path) if i.get("href") != HREF]
        write_navi(path, items + [NAVI_ITEM], user)


def remove_navi(user):
    for theme in theme_dirs(user):
        path = theme + "/navi.json"
        if not os.path.exists(path):
            continue
        items = [i for i in read_navi(path) if i.get("href") != HREF]
        if items:
            write_navi(path, items, user)
        else:
            os.remove(path)
            try:
                os.rmdir(theme)
            except OSError:
                pass


def main():
    action, user = sys.argv[1], sys.argv[2]
    if action == "install":
        change_nginx(add_nginx)
        install_navi(user)
    elif action == "remove":
        change_nginx(strip_nginx)
        remove_navi(user)
    else:
        sys.exit("Unbekannte Aktion: " + action)


if __name__ == "__main__":
    main()
