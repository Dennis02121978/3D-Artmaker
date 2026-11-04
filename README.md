# 3D-Artmaker

Zusätze für den RF1000 und RF2000 mit Klipper, Moonraker und Mainsail.

| Paket | Inhalt | Updates |
|---|---|---|
| `skipr-filament` | Filament-Anzeige für das 2in1-Hotend | Per Klick im Update-Manager von Mainsail |
| `skipr-update` | Firmware-Update für das MKS-SKIPR-Board | Hinweis auf der Seite, Installation von Hand |

Die Pakete und ihre Prüfsummen liegen unter [Releases](https://github.com/Dennis02121978/3D-Artmaker/releases/latest).

## Warum `skipr-update` nicht per Klick aktualisiert wird

Das Update-Programm läuft als Root. Moonraker läuft als normaler Benutzer und könnte seine Dateien nur ändern, wenn sie auch diesem Benutzer gehören. Damit könnte jedes Programm dieses Benutzers eigenen Code als Root ausführen.

## Neue Version veröffentlichen

```
git tag v1.2.0
git push origin v1.2.0
```

Danach baut GitHub alle Pakete und erstellt das Release. Beide Pakete tragen immer dieselbe Versionsnummer, deshalb meldet Mainsail auch dann ein Update, wenn sich nur das andere Paket geändert hat.

## Lizenz

GPLv3, siehe [LICENSE](LICENSE). `skipr-update/files` enthält Dateien aus dem [Klipper-Projekt](https://github.com/Klipper3d/klipper), das ebenfalls unter GPLv3 steht.
