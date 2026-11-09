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
| `rf_display.cfg` | Display und Menü wie in der RF-Firmware (Repetier) |
| `offset_test.cfg` | Testdruck `OFFSET_TEST` und `NOZZLE_OFFSET_ADJUST` für den Düsenversatz |
| `rf_led.cfg` | RGB-Licht wie in der RF-Firmware, LED-Signale für das Firmware-Update |
| `OrcaSlicer_Einstellungen.md` | Was du in OrcaSlicer einstellen musst |

Nicht enthalten sind die Dateien von Mainsail, Moonraker, KlipperScreen, Crowsnest, Sonar und Timelapse. Sie gehören zu deiner eigenen Installation und bleiben, wie sie sind.

## Das brauchst du vorher

- [ ] Einen RF2000 v2 mit zwei Extrudern und ATmega2560-Board. Bei anderen Druckern passen die Pins nicht.
- [ ] Klipper aus [Dennis02121978/klipper](https://github.com/Dennis02121978/klipper). Das offizielle Klipper kennt die Module für die Treiber, die Wägezelle und die Z-Tasten nicht. Wie du umstellst, steht in [KLIPPER_WECHSELN.md](https://github.com/Dennis02121978/klipper/blob/master/KLIPPER_WECHSELN.md). Die `rf_display.cfg` und die `printer.cfg` ab v1.5.5 brauchen den Fork-Stand vom 08.11.2026 nachmittags oder neuer (Menü „Drucke Datei“, `[rf_sdcard]`). Aktualisiere Klipper vorher in Mainsail unter **Maschine → Update Manager**.
- [ ] Mainsail, denn die `printer.cfg` bindet `mainsail.cfg` ein.
- [ ] Für das schnelle Lesen der SD-Karte im Drucker das Paket **Firmware Updater ATmega** ab v1.5.5. Es stellt den USB-Wandler des Druckers auf 1 ms Wartezeit. Ohne das Paket geht es auch, nur etwa dreimal langsamer.
- [ ] Es läuft **kein Druck**.

## Installieren

**1. Eigene Config sichern.** Lade in Mainsail unter **Maschine** deine Config-Dateien herunter.

**2. Dateien hochladen.** Entpacke das ZIP und lade die Dateien in Mainsail unter **Maschine** hoch. Vorhandene Dateien mit gleichem Namen werden dabei ersetzt.

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

## Z-Höhe

Z max ist 190 mm, nicht 200 mm. Beim Homing fährt Klipper Z zuerst von der Düse weg (`z_hop`), damit nichts kaputtgeht. Dafür bleiben 10 mm Reserve unter dem Fahrweg. `PRINT_END` und „Objekt ausgeben“ fahren deshalb nur bis 185 mm. Die Druckhöhe in OrcaSlicer (185 mm, siehe [OrcaSlicer_Einstellungen.md](OrcaSlicer_Einstellungen.md)) liegt darunter.

Y max ist 290 mm: Der Fahrweg ab dem Home-Schalter ist 295 mm, am Schalter steht die Düse 5 mm vor dem Bett (Y = −5). Mit 300 mm fuhr das Bett zu weit nach vorne. Wer von einer älteren Config mit Y = −10 kommt, muss das Bettnetz neu aufnehmen, weil sich Y=0 um 5 mm verschoben hat.

## Kalibrieren

Ganz unten in der `printer.cfg` steht im Bereich `SAVE_CONFIG` das Bettnetz **dieses** Druckers. Die PID-Werte stehen weiter oben bei den Heizungen. Beides passt nicht zu deinem Drucker.

Fahre die Schritte der Reihe nach, die Hand am Not-Halt:

1. Fahre mit `G28 X` und `G28 Y` X und Y an, danach mit `G28 Z` die Z-Achse. Beobachte Z genau. Y=0 ist die Vorderkante des Betts, am Y-Schalter steht die Düse 5 mm davor.
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
- **Extruder-Tasten:** F-FWD und F-REV am Drucker. Kurz drücken fördert 2 mm vor bzw. zurück. 1 Sekunde halten lässt den Extruder mit 5 mm/s weiterlaufen, bis du loslässt. Beim Drucken ändert ein Druck den Fluss um 1 %. Ist die Düse zu kalt, erscheint nur eine Meldung. Einstellbar im Makro `_E_KEY` in der `macros.cfg`.
- **Werkzeugwechsel:** `T0` und `T1` wechseln den Extruder und setzen den Düsenversatz.
- **Druckende und Pause:** Der Kopf parkt ohne Versatz und bleibt so im Fahrweg. Am Druckende werden alle Heizungen ausgeschaltet.
- **Filamentwechsel:** `M600` parkt den Kopf und wartet. Danach geht es mit `RESUME` weiter.
- **Notfall-Pause und Flow-Kompensation:** Steigt die Kraft an der Düse stark an, pausiert der Druck. Bei erhöhter Kraft passt Klipper Flow und Geschwindigkeit an. Einstellungen unter `[rf1000_pressure_guard]`, Erklärung in [PRESSURE_GUARD.md](https://github.com/Dennis02121978/klipper/blob/master/PRESSURE_GUARD.md).
- **Sense Offset:** Drückt die Düse im ersten Layer zu stark aufs Bett (Kraft über `force_threshold`), hebt Klipper den Abstand schrittweise an, höchstens um `max_z_offset` (0,2 mm). Homing setzt ihn wieder auf 0. Im Terminal erscheint jeder Anstieg um 0,02 mm und nach dem ersten Layer das Ergebnis mit höchster und mittlerer Kraft. `Z_SENSE_OFFSET QUERY=1` zeigt den Stand jederzeit.
- **Anzeige in Mainsail:** Unter „Sonstige“ stehen `Load Cell` (Kraft an der Düse) und `Sense Offset` (in Mikrometern, 120 = 0,120 mm). Mainsail schreibt dort fest „g“ dahinter, gemeint sind Digits bzw. Mikrometer.
- **Startbild:** Beim Start zeigt das Display „3D-Artmaker“ mit Version und Stand, danach die Startseite.
- **RGB-Licht wie in der RF-Firmware:** Heizen rot, Temperatur erreicht weiß, Abkühlen blau. In Ruhe erst weiß, nach 30 Sekunden Farbwechsel Rot, Gelb, Grün, Cyan, Blau, Magenta mit weichem Übergang. Während eines Drucks gelten die Farben aus `PRINT_START` und `PRINT_END`. „Licht“ im Menü schaltet LED und Automatik aus und an. Der Firmware Updater lässt die LED über `RF_LED_SIGNAL` blinken (Druckerauswahl), rot leuchten (Update läuft) und 5 Sekunden grün leuchten (fertig). Zusätzlich zeigt das Display über `RF_DISPLAY_SIGNAL` (in `rf_display.cfg`) einen blinkenden Rahmen mit „FIRMWARE-UPDATE – DIESER DRUCKER“, „UPDATE LAEUFT“ und „ERFOLGREICH“.
- **SD-Karte im Drucker:** Steckt im Kartenleser des Druckers eine SD-Karte, steht im Display unter **SD Karte → Drucke Datei** oben der Eintrag **SD-Karte >** mit ihren G-Code-Dateien, auch aus Unterordnern. Darunter stehen wie bisher die Dateien auf dem Raspberry Pi. Steckt keine Karte, siehst du nur die Dateien auf dem Pi. Antippen einer Datei von der Karte kopiert sie in den G-Code-Ordner (Unterordner `SD-Karte`) und startet den Druck. Das Kopieren dauert etwa 2 Minuten je 1,5 MB, das Display zeigt den Fortschritt. Ist die Datei schon kopiert und unverändert, startet der Druck sofort. In der Mainsail-Konsole: `RF_SD_LIST` zeigt die Dateien, `RF_SD_PRINT FILE="Name.gcode"` druckt, `RF_SD_COPY FILE=*` kopiert alle Dateien, danach siehst du sie in Mainsail unter **G-Code-Dateien → SD-Karte**. Die Karte muss FAT16 oder FAT32 formatiert sein (exFAT geht nicht), sie wird nur gelesen. Große Dateien lädst du schneller direkt in Mainsail hoch.
- **Display wie in der RF-Firmware:** Startseiten und Menü sehen aus wie unter Repetier, mit deutschen Texten und Umlauten. Auf der Startanzeige blättern hoch und runter durch die Seiten, OK öffnet das Menü. Einstellungen aus dem Menü (DMS, Beschleunigung, Feedrate) werden in `rf_variables.cfg` gespeichert. Beschreibung in [DISPLAY_MENU.md](https://github.com/Dennis02121978/klipper/blob/master/DISPLAY_MENU.md).

## Stand der Tests

Noch nicht in einem echten Druck gelaufen sind: die Heißmessung in `PRINT_START`, die Notfall-Pause und Flow-Kompensation, der Sense Offset (nur ohne Bewegung geprüft), `OFFSET_TEST` und der neue Y-Nullpunkt. Achte beim ersten Druck deshalb besonders auf diese Stellen und bleib mit der Hand am Not-Halt.

## Lizenz

GPLv3, siehe [LICENSE](../../LICENSE).
