# Klipper-Config für den RF2000 Dual Extruder (3 mm)

Das ist die Config für einen Renkforce RF2000 mit zwei Extrudern, 3-mm-Filament (2,85 mm) und ATmega2560-Board.

`printer.cfg`, `macros.cfg`, `offset_test.cfg` und `rf_led.cfg` sind unverändert aus dem **Renkforce Klipper Config Creator** erzeugt, mit diesen Eingaben:

- Drucker: RF2000, Dual Extruder, LED, Display wie in der RF-Firmware
- Filament 2,85 mm, Düse 0,4 mm, 280 Steps/mm (rotation_distance 22,857)
- Düsenversatz T1: X 35 mm, Y 0 mm (Vorgabe des Creators)
- Heißmessung vor dem Druck an, Notfall-Pause ±6000, Flow-Kompensation 400 bis 800, ohne Digits-Kurve
- Drucker 1 an diesem Raspberry Pi. Als zweiter, dritter oder vierter Drucker passt `rf-multi` die Pfade selbst an.

`rf_display.cfg` und `z_tasten.cfg` sind dieselben Dateien wie beim RF2000 v2. Auch die SD-Karte im Kartenleser des Druckers funktioniert wie dort beschrieben ([Funktionen](../RF2000v2_DualExtruder/README.md#funktionen)).

> [!WARNING]
> Diese Config ist **noch an keinem echten RF2000 getestet**. Die Pins sind laut RF-Firmware bei RF2000 und RF2000 v2 gleich. Prüfe trotzdem alles und bleib bei den ersten Bewegungen mit der Hand am Not-Halt.

## Werte aus dem Creator für den RF2000

| Wert | RF2000 (diese Config) | RF2000 v2 |
|---|---|---|
| Fahrweg ab Schalter X / Y / Z | 200 / 245 / 190 mm | 200 / 295 / 190 mm |
| Düse am Y-Home-Schalter vor dem Bett | 18 mm (Y = −18 bis 227) | 5 mm (Y = −5 bis 290) |
| Bettnetz | 10,50 bis 200,220, 5 × 5, lagrange | 10,50 bis 200,275, 6 × 9, bicubic |
| Filament | 2,85 mm | 1,75 mm |
| Prime Line | E4,9 / E9,4 | E13 / E25 |
| Sense Offset Schwelle | 4000 (Vorgabe) | 500 (am Drucker eingestellt) |

Z max ist bei allen Modellen 190 mm: Beim Homing fährt Klipper Z zuerst von der Düse weg (`z_hop`), dafür bleiben 10 mm Reserve unter dem Fahrweg von 200 mm. `PRINT_END` und „Objekt ausgeben“ fahren deshalb nur bis 185 mm.

Y max (`position_max`) ist der am Drucker gemessene Fahrweg ab dem Home-Schalter minus dem Abstand der Düse vor dem Bett am Schalter: RF1000 245 − 22 = 223 mm, RF2000 245 − 18 = 227 mm, RF2000 v2 295 − 5 = 290 mm. Weiter darf das Bett nicht nach vorne fahren. X max ist beim RF2000 und RF2000 v2 200 mm (Single und Dual).

PID-Werte und Bettnetz sind nicht für deinen Drucker. Die eingetragenen PID-Werte sind die Vorgabe des Creators.

## Zu prüfen vor dem ersten Druck

1. **Endstops:** `QUERY_ENDSTOPS` im Ruhezustand muss überall `open` zeigen.
2. **Y-Nullpunkt:** Nach `G28` mit `G1 Y0 F3000` vorfahren. Die Düse muss an der Vorderkante des Betts stehen. Sonst im Creator „Y-Home vor dem Bett“ anpassen und neu erzeugen.
3. **Thermistoren:** Temperatur bei Raumtemperatur und beim ersten Aufheizen vergleichen.
4. **Extruder:** 100 mm Filament fördern und nachmessen, bei Bedarf `rotation_distance` anpassen.
5. **Bauteil-Lüfter:** Die RF-Firmware begrenzt ihn beim RF2000 auf 160 von 255. Läuft er zu stark, in `[fan]` `max_power: 0.63` eintragen.
6. **PID und Bettnetz:** `PID_TUNING_HOTEND_1`, `PID_TUNING_HOTEND_2`, `PID_TUNING_BED`, danach `G28` und `BED_CALIBRATE`. Ohne Bettnetz bricht `PRINT_START` mit „Unknown profile“ ab, das ist Absicht.
7. **Düsenversatz:** mit `OFFSET_TEST` prüfen, siehe `offset_test.cfg`. Die RF-Firmware nennt für den RF2000 X 33,9 mm und Y 0,1 mm.

## Installieren

- **Als weiterer Drucker an einem Raspberry Pi:** mit dem Paket **rf-multi** (`sudo rf-multi`, Vorlage „RF2000 Dual Extruder, Filament 3 mm“). Es legt diese Config an und trägt Anschluss und Pfade ein.
- **Als einziger Drucker:** wie in der [RF2000v2-README](../RF2000v2_DualExtruder/README.md#installieren) beschrieben. Den Anschluss unter `[mcu]` musst du an deinen Drucker anpassen.
- **Eigene Werte:** Erzeuge die Dateien im Config Creator neu und ersetze damit `printer.cfg`, `macros.cfg`, `offset_test.cfg` und `rf_led.cfg`. Bei mehreren Druckern wählst du dort die Nummer und den Namen des Druckers.

Die Einstellungen für OrcaSlicer zeigt der Config Creator auf der Seite „Anleitung“.

## Lizenz

GPLv3, siehe [LICENSE](../../LICENSE).
