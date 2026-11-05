# Klipper-Config für den RF2000 v2 Dual Extruder

Das ist die Config eines Renkforce RF2000 v2 mit zwei Extrudern und zwei Düsen, einem ATmega2560-Board und einem Raspberry Pi 3.

> [!WARNING]
> Die Werte sind an **einem** Drucker eingestellt. Übernimm sie nicht ungeprüft. Falsche Werte für Z oder die Heizungen können deinen Drucker beschädigen. Bleib bei den ersten Tests am Drucker und halte den Not-Halt bereit.

## Was ist enthalten?

| Datei | Inhalt |
|---|---|
| `printer.cfg` | Motoren, Heizungen, Wägezelle, Bettnetz, Display |
| `macros.cfg` | `PRINT_START`, `PRINT_END`, `PAUSE`, `RESUME`, `M600`, `T0`, `T1`, Kalibrierung, Tasten |
| `z_tasten.cfg` | Z-Achse mit den Tasten Z-UP und Z-DN fahren |
| `crowsnest.conf` | Kamera, nur nötig, wenn du Crowsnest nutzt |
| `OrcaSlicer_Einstellungen.md` | Was du in OrcaSlicer einstellen musst |

Nicht enthalten sind die Dateien von Mainsail, Moonraker, KlipperScreen, Sonar und Timelapse. Sie gehören zu deiner eigenen Installation und bleiben, wie sie sind.

## Das brauchst du vorher

- [ ] Einen RF2000 v2 mit zwei Extrudern und ATmega2560-Board. Bei anderen Druckern passen die Pins nicht.
- [ ] Klipper aus [Dennis02121978/klipper](https://github.com/Dennis02121978/klipper). Das offizielle Klipper kennt die Module für die Treiber, die Wägezelle und die Z-Tasten nicht. Wie du umstellst, steht in [KLIPPER_WECHSELN.md](https://github.com/Dennis02121978/klipper/blob/master/KLIPPER_WECHSELN.md).
- [ ] Mainsail, denn die `printer.cfg` bindet `mainsail.cfg` ein.
- [ ] Es läuft **kein Druck**.

## Installieren

**1. Eigene Config sichern.** Lade in Mainsail unter **Maschine** deine Config-Dateien herunter.

**2. Dateien hochladen.** Entpacke das ZIP und lade die Dateien in Mainsail unter **Maschine** hoch. Vorhandene Dateien mit gleichem Namen werden dabei ersetzt. `crowsnest.conf` lässt du weg, wenn deine Kamera schon läuft.

**3. Anschluss des Boards eintragen.** Der Eintrag in der `printer.cfg` gehört zum USB-Adapter dieses Druckers und passt bei dir nicht. Verbinde dich per SSH mit dem Drucker und gib ein:

```bash
ls /dev/serial/by-id/
```

Trage den angezeigten Namen hier ein:

```ini
[mcu]
serial: /dev/serial/by-id/DEIN-NAME
```

**4. Pfad prüfen.** Heißt dein Benutzer nicht `pi`, ändere `path:` unter `[virtual_sdcard]`.

**5. Speichern.** Klicke auf **Speichern & Neustart**.

## Kalibrieren

Ganz unten in der `printer.cfg` stehen im Bereich `SAVE_CONFIG` die Messwerte **dieses** Druckers: Z-Endstopp, Bettnetz und Input Shaper. Die PID-Werte stehen weiter oben bei den Heizungen. Sie alle passen nicht zu deinem Drucker.

Fahre die Schritte der Reihe nach, die Hand am Not-Halt:

1. Fahre mit `G28 X` und `G28 Y` X und Y an, danach mit `G28 Z` die Z-Achse. Beobachte Z genau, der gespeicherte Endstopp-Wert stammt von einem anderen Drucker.
2. Starte `PID_TUNING_HOTEND_1`, danach `PID_TUNING_HOTEND_2` und `PID_TUNING_BED`. Jedes dieser Makros speichert die Werte und startet Klipper neu.
3. Fahre wieder mit `G28` an und starte `BED_CALIBRATE`. Das Makro misst Z mit der Wägezelle, erstellt das Bettnetz und speichert es.
4. Miss den Input Shaper neu, oder lösche den Abschnitt `[input_shaper]` im Bereich `SAVE_CONFIG`.

## Düsenversatz einstellen

Solange der Versatz nicht stimmt, druckt T1 an der falschen Stelle. Er steht in der `macros.cfg` beim Makro `T1` und ist hier auf 0 gesetzt:

```ini
variable_offset_x: 0.0
variable_offset_y: 0.0
```

Beide Werte musst du an deinem Drucker messen. Wie das geht und wie weit T1 fahren kann, steht in [OrcaSlicer_Einstellungen.md](OrcaSlicer_Einstellungen.md).

## Funktionen

- **Z-Tasten:** Kurz drücken fährt 0,03 mm. 2 Sekunden halten fährt mit 8 mm/s, bis du loslässt. Beim Drucken ändert ein Druck den Z-Offset um 0,005 mm. Mehr dazu in [Z_TASTEN.md](https://github.com/Dennis02121978/klipper/blob/master/Z_TASTEN.md).
- **Werkzeugwechsel:** `T0` und `T1` wechseln den Extruder und setzen den Düsenversatz.
- **Druckende und Pause:** Der Kopf parkt ohne Versatz und bleibt so im Fahrweg. Am Druckende werden alle Heizungen ausgeschaltet.
- **Filamentwechsel:** `M600` parkt den Kopf und wartet. Danach geht es mit `RESUME` weiter.

## Stand der Tests

`PRINT_END`, `PAUSE`, `RESUME`, `CANCEL_PRINT` und der Düsenversatz wurden zuletzt geändert. Sie liefen im Testmodus von Klipper ohne Fehler, aber noch nicht in einem echten Druck. Der Versatz wurde am Drucker nur ohne Bewegung geprüft. Achte beim ersten Druck deshalb besonders auf diese Stellen.

## Lizenz

GPLv3, siehe [LICENSE](../../LICENSE).
