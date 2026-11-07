# Klipper-Config für den RF2000 v2 Dual Extruder

Das ist die Config eines Renkforce RF2000 v2 mit zwei Extrudern und zwei Düsen, einem ATmega2560-Board und einem Raspberry Pi 3.

> [!WARNING]
> Die Werte sind an **einem** Drucker eingestellt. Übernimm sie nicht ungeprüft. Falsche Werte für Z oder die Heizungen können deinen Drucker beschädigen. Bleib bei den ersten Tests am Drucker und halte den Not-Halt bereit.

## Was ist enthalten?

| Datei | Inhalt |
|---|---|
| `printer.cfg` | Motoren, Heizungen, Wägezelle, Notfall-Pause, Sense Offset, Bettnetz, Display |
| `macros.cfg` | `PRINT_START`, `PRINT_END`, `PAUSE`, `RESUME`, `M600`, `T0`, `T1`, Kalibrierung, Heißmessung |
| `z_tasten.cfg` | Z-Achse mit den Tasten Z-UP und Z-DN fahren |
| `offset_test.cfg` | Testdruck `OFFSET_TEST` und `NOZZLE_OFFSET_ADJUST` für den Düsenversatz |
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

Ganz unten in der `printer.cfg` steht im Bereich `SAVE_CONFIG` das Bettnetz **dieses** Druckers. Die PID-Werte stehen weiter oben bei den Heizungen. Beides passt nicht zu deinem Drucker.

Fahre die Schritte der Reihe nach, die Hand am Not-Halt:

1. Fahre mit `G28 X` und `G28 Y` X und Y an, danach mit `G28 Z` die Z-Achse. Beobachte Z genau. Y=0 ist die Vorderkante des Betts, der Y-Schalter liegt 10 mm davor.
2. Starte `PID_TUNING_HOTEND_1`, danach `PID_TUNING_HOTEND_2` und `PID_TUNING_BED`. Jedes dieser Makros speichert die Werte und startet Klipper neu.
3. Fahre wieder mit `G28` an und starte `BED_CALIBRATE`. Das Makro misst Z mit der Wägezelle, erstellt das Bettnetz und speichert es.

`PRINT_START` misst nach dem Aufheizen Z mit heißer Düse neu (`HOT_Z_PROBE`, an einer zufälligen Stelle zwischen 30 und 50 mm).

## Düsenversatz einstellen

Solange der Versatz nicht stimmt, druckt T1 an der falschen Stelle. Er steht in der `macros.cfg` beim Makro `T1`. Eingetragen ist der Wert **dieses** Druckers:

```ini
variable_offset_x: 35.00
variable_offset_y: 0.00
```

Prüfe ihn an deinem Drucker mit dem Testdruck `OFFSET_TEST`. Die Linie, bei der oben und unten ohne Knick ineinander übergehen, zeigt die Korrektur. `NOZZLE_OFFSET_ADJUST X=… Y=…` übernimmt sie bis zum Neustart, danach trägst du den angezeigten Wert in `T1` ein. Die Anleitung steht oben in `offset_test.cfg`. Was du in OrcaSlicer einstellen musst und wie weit T1 fahren kann, steht in [OrcaSlicer_Einstellungen.md](OrcaSlicer_Einstellungen.md).

## Funktionen

- **Z-Tasten:** Kurz drücken fährt 0,03 mm. 2 Sekunden halten fährt mit 8 mm/s, bis du loslässt. Beim Drucken ändert ein Druck den Z-Offset um 0,005 mm. Mehr dazu in [Z_TASTEN.md](https://github.com/Dennis02121978/klipper/blob/master/Z_TASTEN.md).
- **Werkzeugwechsel:** `T0` und `T1` wechseln den Extruder und setzen den Düsenversatz.
- **Druckende und Pause:** Der Kopf parkt ohne Versatz und bleibt so im Fahrweg. Am Druckende werden alle Heizungen ausgeschaltet.
- **Filamentwechsel:** `M600` parkt den Kopf und wartet. Danach geht es mit `RESUME` weiter.
- **Notfall-Pause und Flow-Kompensation:** Steigt die Kraft an der Düse stark an, pausiert der Druck. Bei erhöhter Kraft passt Klipper Flow und Geschwindigkeit an. Einstellungen unter `[rf1000_pressure_guard]`, Erklärung in [PRESSURE_GUARD.md](https://github.com/Dennis02121978/klipper/blob/master/PRESSURE_GUARD.md).
- **Sense Offset:** Drückt die Düse im ersten Layer zu stark aufs Bett (Kraft über `force_threshold`), hebt Klipper den Abstand schrittweise an, höchstens um `max_z_offset` (0,2 mm). Homing setzt ihn wieder auf 0.
- **Anzeige in Mainsail:** Unter „Sonstige“ stehen `Load Cell` (Kraft an der Düse) und `Sense Offset` (in Mikrometern, 120 = 0,120 mm). Mainsail schreibt dort fest „g“ dahinter, gemeint sind Digits bzw. Mikrometer.
- **Display:** Oben rechts steht die Kraft (`F…`), unten rechts der Sense Offset in mm (`S0.000`), solange er an ist. Im Menü erhöht die Taste hoch einen Wert, die Taste runter verringert ihn.

## Stand der Tests

Noch nicht in einem echten Druck gelaufen sind: die Heißmessung in `PRINT_START`, die Notfall-Pause und Flow-Kompensation, der Sense Offset (nur ohne Bewegung geprüft), `OFFSET_TEST` und der neue Y-Nullpunkt. Achte beim ersten Druck deshalb besonders auf diese Stellen und bleib mit der Hand am Not-Halt.

## Lizenz

GPLv3, siehe [LICENSE](../../LICENSE).
