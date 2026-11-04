# Firmware-Update für MKS SKIPR über Mainsail

Fügt Mainsail den Menüpunkt **Firmware-Update** hinzu. Die Firmware lässt sich damit per Knopfdruck aktualisieren, ganz ohne Terminal.

## Voraussetzungen

- MKS-SKIPR-Board (STM32F407), angebunden über `/dev/ttyS0`
- Debian-basiertes System mit Klipper, Moonraker und Mainsail unter nginx
- Klipper liegt im Home-Ordner des Klipper-Benutzers

Das Paket prüft vor der Installation, ob Klipper und Mainsail vorhanden sind. Die Update-Seite prüft vor jedem Update den Prozessor des Boards und lehnt andere Boards ab.

## Installieren

Paket auf den Drucker kopieren und dort ausführen:

```
sudo apt install ./skipr-update_<version>_all.deb
```

Danach Mainsail neu laden. Die Seite ist auch direkt erreichbar unter `http://<drucker-ip>/update/`.

## Entfernen

```
sudo apt remove skipr-update    # Protokoll und Einstellungen bleiben
sudo apt purge skipr-update     # entfernt alles
```

## Neue Version bauen

Auf einem Linux-System mit `dpkg-deb`:

```
./build_deb.sh 1.0.1
```

Das Paket landet in `dist/`.

Der Ablauf steckt in `runner.py`, die festen Build-Dateien vom Update-Server in `files/`. Ändern sich diese Dateien, müssen sie hier ersetzt und `SHA256SUMS` neu erzeugt werden:

```
cd files && sha256sum flash_card board_defs.py mcu-build-config-skipr linux_process > SHA256SUMS
```

## Sicherheit

Die Seite hat kein eigenes Passwort, jeder im lokalen Netzwerk kann ein Update starten. Das entspricht Mainsail ohne Anmeldung. Die Seite darf nicht aus dem Internet erreichbar sein.
