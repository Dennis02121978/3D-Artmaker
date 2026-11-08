#!/usr/bin/env python3
"""Kleine Update-Webseite, laeuft unabhaengig von Klipper und Moonraker."""
import json
import os
import shutil
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import common as c

PORT = 7682
DONE_VISIBLE_SECONDS = 15 * 60
REMOTE_CACHE_SECONDS = 300
remote = {"sha": None, "time": 0}
remote_lock = threading.Lock()
RELEASE_API = "https://api.github.com/repos/Dennis02121978/3D-Artmaker/releases/latest"
RELEASE_CHECK_SECONDS = 6 * 3600
release = {"newer": None, "url": None, "time": 0}
release_lock = threading.Lock()


def git(*args, timeout=10):
    try:
        r = subprocess.run(["git", "-C", c.KLIPPER] + list(args), capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return ""
    return r.stdout.strip() if r.returncode == 0 else ""


def remote_sha():
    with remote_lock:
        if time.time() - remote["time"] > REMOTE_CACHE_SECONDS:
            out = git("ls-remote", "origin", "HEAD", timeout=8)
            remote["sha"] = out.split()[0] if out else None
            remote["time"] = time.time()
        return remote["sha"]


def installed_package_version():
    r = subprocess.run(["dpkg-query", "-W", "-f=${Version}", "rf-update"], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


PACKAGE_VERSION = installed_package_version()


def check_release():
    """Meldet eine neuere Version dieses Pakets. Installiert wird sie bewusst von Hand."""
    with release_lock:
        if time.time() - release["time"] > RELEASE_CHECK_SECONDS:
            release["time"] = time.time()
            try:
                req = urllib.request.Request(RELEASE_API, headers={"User-Agent": "rf-update"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    data = json.load(r)
                tag = data["tag_name"]
                newer = PACKAGE_VERSION and subprocess.run(
                    ["dpkg", "--compare-versions", tag.lstrip("v"), "gt", PACKAGE_VERSION]).returncode == 0
                release["newer"] = tag if newer else None
                release["url"] = data.get("html_url")
            except (OSError, ValueError, KeyError):
                pass  # Ohne Internet oder ohne Release gibt es einfach keinen Hinweis
        return release["newer"], release["url"]


inst_cache = {"list": [], "time": 0}
inst_lock = threading.Lock()


def instances():
    """Druckerliste, kurz zwischengespeichert, weil die Seite alle 2 Sekunden fragt."""
    with inst_lock:
        if time.time() - inst_cache["time"] > 15:
            inst_cache["list"] = c.instances()
            inst_cache["time"] = time.time()
        return inst_cache["list"]


def printer_info(inst, version, code_update, running):
    """Stand eines Druckers: Klipper-Zustand, Firmware auf dem Board, Sperrgrund."""
    info = {"id": inst["id"], "name": inst["name"], "serial": os.path.basename(inst["serial"]),
            "klippy": None, "mcu_version": None, "update_available": code_update}
    ok, data = c.moonraker("/printer/info", inst["port"])
    if ok and data:
        info["klippy"] = data["result"]["state"]
    ok, data = c.moonraker("/printer/objects/query?mcu=mcu_version", inst["port"])
    if ok and data:
        mcu = data["result"]["status"]["mcu"].get("mcu_version")
        # Das Board haengt z. B. "-dirty-<datum>-<hostname>" an seine Version an
        if mcu and not (mcu == version or mcu.startswith(version + "-")):
            info["update_available"] = True
            info["mcu_version"] = mcu
    info["block_reason"] = None if running else c.print_block_reason(inst["port"], inst["service"])
    return info


def versions(running):
    info = {"version": git("describe", "--always", "--tags") or "unbekannt", "update_available": None,
            "klippy": None}
    info["package_update"], info["package_url"] = check_release()
    local = git("rev-parse", "HEAD")
    upstream = remote_sha()
    code_update = (upstream != local) if upstream and local else None
    info["printers"] = [printer_info(i, info["version"], code_update, running) for i in instances()]
    # Felder fuer einen einzelnen Drucker wie bisher
    if len(info["printers"]) == 1:
        first = info["printers"][0]
        info.update(klippy=first["klippy"], update_available=first["update_available"],
                    block_reason=first["block_reason"])
        if first["mcu_version"]:
            info["mcu_version"] = first["mcu_version"]
    else:
        info["update_available"] = code_update
        info["block_reason"] = None
    return info


def status_payload():
    running = c.service_active(c.UNIT)
    status = c.read_status() or {"state": "idle"}
    state = status.get("state", "idle")
    if state == "rebooting" and status.get("boot_id") != c.boot_id():
        state = "done"
    elif state == "running" and not running:
        state = "failed"
        status["message"] = "Das Update wurde unterbrochen, zum Beispiel durch einen Stromausfall. Bitte erneut starten."
        status["danger"] = False
    if state == "done" and time.time() - status.get("finished", 0) > DONE_VISIBLE_SECONDS:
        state = "idle"
    status["state"] = state
    if running and state not in ("running", "rebooting"):
        status = {"state": "running", "percent": 0, "steps": [], "danger": False}
    status.update(versions(running))
    if status.get("printer"):
        # Nach dem Update den Zustand des aktualisierten Druckers zeigen
        for item in status["printers"]:
            if item["id"] == status["printer"]:
                status["klippy"] = item["klippy"]
    return status


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def respond(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            page = os.path.join(c.WEB_DIR, "index.html")
            if not os.path.isfile(page):  # Zum Beispiel waehrend Moonraker den Ordner ersetzt
                page = os.path.join(c.SEED_DIR, "index.html")
            with open(page, encoding="utf-8") as f:
                self.respond(200, f.read(), "text/html; charset=utf-8")
        elif path == "/status":
            self.respond(200, json.dumps(status_payload()))
        elif path == "/log":
            try:
                with open(c.LOG_FILE, encoding="utf-8", errors="replace") as f:
                    text = "".join(f.readlines()[-300:])
            except OSError:
                text = "Noch kein Protokoll vorhanden."
            self.respond(200, text, "text/plain; charset=utf-8")
        else:
            self.respond(404, '{"error":"not found"}')

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = {}
        if length:
            try:
                body = json.loads(self.rfile.read(min(length, 4096)) or b"{}")
            except ValueError:
                body = {}
        if not isinstance(body, dict):
            body = {}
        path = urlparse(self.path).path
        if path not in ("/start", "/identify"):
            self.respond(404, '{"error":"not found"}')
            return
        # Schutz davor, dass fremde Webseiten das Update im Browser ausloesen
        origin = self.headers.get("Origin")
        same_origin = not origin or urlparse(origin).netloc == self.headers.get("Host")
        if self.headers.get("X-Skipr-Update") != "1" or not same_origin:
            self.respond(403, json.dumps({"error": "Anfrage abgelehnt."}))
            return
        inst_cache["time"] = 0
        found = instances()
        inst = None
        if body.get("printer"):
            inst = next((i for i in found if i["id"] == body["printer"]), None)
        elif len(found) == 1:
            inst = found[0]
        if path == "/identify":
            if not inst or c.service_active(c.UNIT):
                self.respond(409, json.dumps({"error": "Drucker nicht verfügbar."}))
                return
            # Andere Drucker hoeren auf zu blinken, der gewaehlte blinkt 30 Sekunden rot
            for other in found:
                if other["id"] != inst["id"]:
                    c.led_signal(other["port"], "OFF")
            if body.get("off"):
                ok = c.led_signal(inst["port"], "OFF")
            else:
                ok = c.led_signal(inst["port"], "BLINK", "RED", 30)
            self.respond(200, json.dumps({"ok": ok}))
            return
        if c.service_active(c.UNIT):
            self.respond(202, '{"ok":true}')
            return
        if not inst:
            self.respond(409, json.dumps({"error": "Bitte zuerst den Drucker auswählen."}))
            return
        reason = c.print_block_reason(inst["port"], inst["service"])
        if reason:
            self.respond(409, json.dumps({"error": reason}))
            return
        try:
            with open(c.REQUEST_FILE, "w") as f:
                json.dump({"printer": inst["id"], "time": time.time()}, f)
        except OSError:
            self.respond(500, json.dumps({"error": "Die Auswahl des Druckers konnte nicht gespeichert werden."}))
            return
        r = subprocess.run(["sudo", "-n", shutil.which("systemctl"), "start", "--no-block", c.UNIT],
                           capture_output=True, text=True)
        if r.returncode:
            self.respond(500, json.dumps({"error": "Das Update konnte nicht gestartet werden."}))
            return
        self.respond(202, '{"ok":true}')


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
