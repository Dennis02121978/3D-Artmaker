# 3D-Artmaker

Zusätze für den RF1000 und RF2000 mit Klipper, Moonraker und Mainsail.

**Neu hier? Hier geht es zur [Installationsanleitung für Einsteiger](INSTALLATION.md).**

Jedes Paket lässt sich allein installieren und erscheint dann als eigener Eintrag im Update-Manager von Mainsail.

| Eintrag im Update-Manager | Paket | Inhalt | Update per Klick |
|---|---|---|---|
| 3D-Artmaker 2in1 Hotend | `skipr-filament` | Filament-Anzeige für das 2in1-Hotend | Die ganze Seite |
| 3D-Artmaker Firmware Updater | `skipr-update` | Firmware-Update für das MKS-SKIPR-Board | Nur die Webseite |
| 3D-Artmaker Firmware Updater ATmega | `rf-update` | Firmware-Update für ATmega2560-Boards | Nur die Webseite |
| 3D-Artmaker BootScreen | `skipr-bootlogo` | Logo beim Start auf dem Display (Armbian) | Nur das Logo |
| 3D-Artmaker BootScreen Pi | `rf-bootlogo` | Logo beim Start auf dem Display (Raspberry Pi) | Nur das Logo |

Die Pakete und ihre Prüfsummen liegen unter [Releases](https://github.com/Dennis02121978/3D-Artmaker/releases/latest).

Dazu gibt es [`config/2in1_hotend.cfg`](config/2in1_hotend.cfg), die Klipper-Makros für einen RF2000 mit 2in1-Umbau. Sie ist kein Paket und wird nicht über den Update-Manager aktualisiert.

Das passende Klipper mit den RF1000-Modulen liegt in [Dennis02121978/klipper](https://github.com/Dennis02121978/klipper). Dort stehen auch die Anleitungen zum [Umstellen von Klipper](https://github.com/Dennis02121978/klipper/blob/master/KLIPPER_WECHSELN.md) zum [Firmware Updater](https://github.com/Dennis02121978/klipper/blob/master/FIRMWARE_UPDATER.md) und zum [BootScreen für den Raspberry Pi](https://github.com/Dennis02121978/klipper/blob/master/BOOTSCREEN.md).

## Warum nicht alles per Klick aktualisiert wird

Moonraker läuft als normaler Benutzer. Teile, die als Root laufen, bleiben deshalb im `.deb`, sonst könnte jedes Programm dieses Benutzers eigenen Code als Root ausführen. Das betrifft das Update-Programm von `skipr-update` und `rf-update` und die Boot-Einstellungen von `skipr-bootlogo` und `rf-bootlogo`. Ändern sich diese Teile, muss die neue `.deb` installiert werden.

## Neue Version veröffentlichen

```
git tag v1.2.0
git push origin v1.2.0
```

Danach baut GitHub alle Pakete und erstellt das Release. Trage die neue Version und die Prüfsummen aus `SHA256SUMS` danach in `INSTALLATION.md` ein. Alle Pakete tragen immer dieselbe Versionsnummer, deshalb meldet Mainsail auch dann ein Update, wenn sich nur ein anderes Paket geändert hat.

## Lizenz

GPLv3, siehe [LICENSE](LICENSE). `skipr-update/files` enthält Dateien aus dem [Klipper-Projekt](https://github.com/Klipper3d/klipper), das ebenfalls unter GPLv3 steht.
