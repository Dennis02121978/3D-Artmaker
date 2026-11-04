#!/usr/bin/python3
"""Traegt die Update-Seite in nginx und Mainsail ein oder wieder aus."""
import json
import os
import pwd
import re
import shutil
import subprocess
import sys

NGINX = "/etc/nginx/sites-available/mainsail"
BEGIN = "    # BEGIN skipr-update\n"
END = "    # END skipr-update\n"
BLOCK = BEGIN + """    location = /update { return 302 /update/; }

    location ^~ /update/ {
        proxy_pass http://127.0.0.1:7682/;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }
""" + END + "\n"
HREF = "/update/"
NAVI_ITEM = {
    "title": "Firmware-Update",
    "href": HREF,
    "target": "_self",
    "position": 95,
    "icon": "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
}


def strip_nginx(text):
    text = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?", "", text, flags=re.S)
    # Eintraege einer aelteren Installation ohne Markierung
    text = re.sub(r"    location = /update \{[^}]*\}\n+", "", text)
    text = re.sub(r"    location \^~ /update/ \{[^}]*\}\n+", "", text)
    return text


def write_nginx(new_text):
    if not os.path.exists(NGINX):
        return
    with open(NGINX) as f:
        old_text = f.read()
    if new_text(old_text) == old_text:
        return
    with open(NGINX, "w") as f:
        f.write(new_text(old_text))
    if subprocess.run(["nginx", "-tq"]).returncode:
        with open(NGINX, "w") as f:
            f.write(old_text)
        sys.exit("nginx-Pruefung fehlgeschlagen, Aenderung zurueckgenommen.")
    subprocess.run(["systemctl", "reload", "nginx"])


def install_nginx():
    marker = "    location / {\n"
    def change(text):
        text = strip_nginx(text)
        if text.count(marker) != 1:
            sys.exit("nginx: Einfuegestelle in %s nicht eindeutig." % NGINX)
        return text.replace(marker, BLOCK + marker)
    write_nginx(change)


def navi_paths(user):
    home = pwd.getpwnam(user).pw_dir
    theme = home + "/printer_data/config/.theme"
    return theme, theme + "/navi.json"


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
    theme, path = navi_paths(user)
    if not os.path.isdir(theme):
        os.makedirs(theme)
        shutil.chown(theme, user, user)
    items = [i for i in read_navi(path) if i.get("href") != HREF]
    write_navi(path, items + [NAVI_ITEM], user)


def remove_navi(user):
    theme, path = navi_paths(user)
    if not os.path.exists(path):
        return
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
        install_nginx()
        install_navi(user)
    elif action == "remove":
        write_nginx(strip_nginx)
        remove_navi(user)
    else:
        sys.exit("Unbekannte Aktion: " + action)


if __name__ == "__main__":
    main()
