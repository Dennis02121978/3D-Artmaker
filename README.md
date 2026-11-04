# 3D-Artmaker

Zusätze für den RF1000 und RF2000 mit Klipper, Moonraker und Mainsail.

Jedes Paket lässt sich allein installieren und erscheint dann als eigener Eintrag im Update-Manager von Mainsail.

| Eintrag im Update-Manager | Paket | Inhalt | Update per Klick |
|---|---|---|---|
| 3D-Artmaker 2in1 Hotend | `skipr-filament` | Filament-Anzeige für das 2in1-Hotend | Die ganze Seite |
| 3D-Artmaker Firmware Updater | `skipr-update` | Firmware-Update für das MKS-SKIPR-Board | Nur die Webseite |
| 3D-Artmaker BootScreen | `skipr-bootlogo` | Logo beim Start auf dem Display | Nur das Logo |

Die Pakete und ihre Prüfsummen liegen unter [Releases](https://github.com/Dennis02121978/3D-Artmaker/releases/latest).

## Warum nicht alles per Klick aktualisiert wird

Moonraker läuft als normaler Benutzer. Teile, die als Root laufen, bleiben deshalb im `.deb`, sonst könnte jedes Programm dieses Benutzers eigenen Code als Root ausführen. Das betrifft das Update-Programm von `skipr-update` und die Boot-Einstellungen von `skipr-bootlogo`. Ändern sich diese Teile, muss die neue `.deb` installiert werden.

## Neue Version veröffentlichen

```
git tag v1.2.0
git push origin v1.2.0
```

Danach baut GitHub alle Pakete und erstellt das Release. Alle Pakete tragen immer dieselbe Versionsnummer, deshalb meldet Mainsail auch dann ein Update, wenn sich nur ein anderes Paket geändert hat.

## Lizenz

GPLv3, siehe [LICENSE](LICENSE). `skipr-update/files` enthält Dateien aus dem [Klipper-Projekt](https://github.com/Klipper3d/klipper), das ebenfalls unter GPLv3 steht.
