# 3D-Artmaker

Zusätze für den RF1000 und RF2000 mit Klipper, Moonraker und Mainsail.

**Neu hier? Hier geht es zur [Installationsanleitung für Einsteiger](INSTALLATION.md).**

**Am einfachsten:** Der [3D-Artmaker Installer](INSTALLATION.md#am-einfachsten-der-3d-artmaker-installer) richtet Klipper auf dem Raspberry Pi oder MKS SKIPR ein und erzeugt die Config mit denselben Fragen wie der Config Creator. Danach hält `3DArtmaker-upgrade` alles aktuell.

Jedes Paket lässt sich allein installieren und erscheint dann als eigener Eintrag im Update-Manager von Mainsail.

| Eintrag im Update-Manager | Paket | Inhalt | Update per Klick |
|---|---|---|---|
| 3D-Artmaker 2in1 Hotend | `skipr-filament` | Filament-Anzeige für das 2in1-Hotend | Die ganze Seite |
| 3D-Artmaker Firmware Updater | `skipr-update` | Firmware-Update für das MKS-SKIPR-Board | Nur die Webseite |
| 3D-Artmaker Firmware Updater ATmega | `rf-update` | Firmware-Update für ATmega2560-Boards | Nur die Webseite |
| 3D-Artmaker BootScreen | `skipr-bootlogo` | Animiertes Logo beim Start auf dem Display (Armbian) | Nur das Logo |
| 3D-Artmaker BootScreen Pi | `rf-bootlogo` | Animiertes Logo beim Start auf dem Display (Raspberry Pi) | Nur das Logo |
| (kein Eintrag) | `rf-multi` | Bis zu 4 Drucker an einem Raspberry Pi | Nein, nur per `.deb` |
| (kein Eintrag) | `rf-terminal` | System-Terminal im Browser (Menüpunkt in Mainsail), siehe [rf-terminal/README.md](rf-terminal/README.md) | Nein, nur per `.deb` |

Die Pakete und ihre Prüfsummen liegen unter [Releases](https://github.com/Dennis02121978/3D-Artmaker/releases/latest).

Dazu gibt es [`config/2in1_hotend.cfg`](config/2in1_hotend.cfg), die Klipper-Makros für einen RF2000 mit 2in1-Umbau. Sie ist kein Paket und wird nicht über den Update-Manager aktualisiert.

Für den RF2000 v2 mit zwei Extrudern und zwei Düsen gibt es eine komplette Config mit OrcaSlicer-Einstellungen: [Download als ZIP](https://github.com/Dennis02121978/3D-Artmaker/releases/latest/download/RF2000v2_DualExtruder.zip) oder [Dateien ansehen](config/RF2000v2_DualExtruder/). Auch sie wird nicht über den Update-Manager aktualisiert.

Für den RF1000 gibt es die Display-Datei mit 16 Spalten und den kurzen Menütexten der RF-Firmware: [`config/rf_display_rf1000.cfg`](config/rf_display_rf1000.cfg). Der Config Creator erzeugt die passende `printer.cfg` und bietet alle eingebundenen Dateien zum Download an.

Für den RF2000 mit zwei Extrudern und 3-mm-Filament gibt es eine mit dem Renkforce Klipper Config Creator erzeugte Config, noch ungetestet: [Download als ZIP](https://github.com/Dennis02121978/3D-Artmaker/releases/latest/download/RF2000_DualExtruder_3mm.zip) oder [Dateien ansehen](config/RF2000_DualExtruder_3mm/).

## Mehrere Drucker an einem Raspberry Pi

Mit dem Paket [`rf-multi`](rf-multi/README.md) laufen bis zu 4 Drucker an einem Raspberry Pi: jeder mit eigener Klipper- und Moonraker-Instanz, eigenem Mainsail (`http://<IP>:81` bis `:83`) und Druckerauswahl in Mainsail und KlipperScreen. Der Firmware Updater ATmega (`rf-update` ab v1.5.0) fragt dann, welcher Drucker aktualisiert werden soll, und zeigt auf dessen Display eine blinkende Meldung „FIRMWARE-UPDATE – DIESER DRUCKER“, dazu blinkt die LED rot (RF1000: nur Display). Während des Updates steht „UPDATE LAEUFT“ auf dem Display und die LED leuchtet rot, danach kurz „ERFOLGREICH“ und 5 Sekunden grün. Der Renkforce Klipper Config Creator fragt zuerst, wie viele Drucker am Pi hängen. Jeder Drucker bekommt eigene Einstellungen, am Ende gibt es alle Configs als ZIP mit einem Ordner pro Drucker. Anleitung: [INSTALLATION.md](INSTALLATION.md#mehrere-drucker-an-einem-raspberry-pi).

Fertige Images liegen wegen ihrer Größe bei Google Drive: [RF2000 v2 mit zwei Extrudern und ATmega2560](https://drive.google.com/file/d/1lhX58YXYUb97EdHdkSFAutRhuTZfrxYp/view?usp=share_link) (Raspberry Pi 3, 3,4 GB) und [RF2000 mit 2in1-Hotend und MKS SKIPR](https://drive.google.com/file/d/1tOGc1TmRw5Qx8h91m4WREEqGrIiXHiVt/view?usp=sharing) (1,7 GB). Das Zurückspielen und der erste Start sind noch nicht getestet. Mehr dazu steht im [Release v1.4.0](https://github.com/Dennis02121978/3D-Artmaker/releases/tag/v1.4.0).

Das passende Klipper mit den RF1000-Modulen liegt in [Dennis02121978/klipper](https://github.com/Dennis02121978/klipper). Dort stehen auch die Anleitungen zum [Umstellen von Klipper](https://github.com/Dennis02121978/klipper/blob/master/KLIPPER_WECHSELN.md), zum [Firmware Updater](https://github.com/Dennis02121978/klipper/blob/master/FIRMWARE_UPDATER.md) und zum [BootScreen für den Raspberry Pi](https://github.com/Dennis02121978/klipper/blob/master/BOOTSCREEN.md).

## Warum nicht alles per Klick aktualisiert wird

Moonraker läuft als normaler Benutzer. Teile, die als Root laufen, bleiben deshalb im `.deb`, sonst könnte jedes Programm dieses Benutzers eigenen Code als Root ausführen. Das betrifft das Update-Programm von `skipr-update` und `rf-update` und die Boot-Einstellungen von `skipr-bootlogo` und `rf-bootlogo`. `rf-multi` und `rf-terminal` richten Dienste ein und haben deshalb gar keinen Teil im Update-Manager. Ändern sich diese Teile, muss die neue `.deb` installiert werden.

## Neue Version veröffentlichen

```
git tag v1.2.0
git push origin v1.2.0
```

Danach baut GitHub alle Pakete und erstellt das Release. Beim lokalen Bauen (`./build_release.sh`) braucht das System `python3-pil` und `python3-numpy`, sie berechnen die Logo-Animation. Trage die neue Version und die Prüfsummen aus `SHA256SUMS` danach in `INSTALLATION.md` ein. Alle Pakete tragen immer dieselbe Versionsnummer, deshalb meldet Mainsail auch dann ein Update, wenn sich nur ein anderes Paket geändert hat.

## Lizenz

GPLv3, siehe [LICENSE](LICENSE). `skipr-update/files` enthält Dateien aus dem [Klipper-Projekt](https://github.com/Klipper3d/klipper), das ebenfalls unter GPLv3 steht.
