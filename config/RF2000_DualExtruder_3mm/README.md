# Klipper-Config für den RF2000 Dual Extruder (3 mm)

Das ist die Config für einen Renkforce RF2000 der ersten Version mit zwei Extrudern, Hotend V2, 3-mm-Filament (2,85 mm) und ATmega2560-Board.

> [!WARNING]
> Diese Config ist aus der [RF2000v2-Config](../RF2000v2_DualExtruder/) abgeleitet und **noch an keinem echten RF2000 getestet**. Die Pins sind laut RF-Firmware bei RF2000 und RF2000 v2 gleich. Die Maße, der Extruder und der Lüfter stammen aus `RF2000.h` der RF-Repetier-Firmware. Prüfe trotzdem alles und bleib bei den ersten Bewegungen mit der Hand am Not-Halt.

## Unterschiede zur RF2000v2-Config

| Wert | RF2000 v2 | RF2000 (diese Config) | Quelle |
|---|---|---|---|
| Filament | 1,75 mm | 2,85 mm | |
| Y-Fahrweg | -10 bis 300 | 0 bis 245 | `Y_MAX_LENGTH 245` |
| Z-Fahrweg | bis 200 | bis 200 | `Z_MAX_LENGTH 200` |
| Extruder | rotation_distance 22.857 | 22.857 (8,75 Vollschritte/mm) | `EXT0_STEPS_PER_MM` |
| Bauteil-Lüfter | max_power 1.0 | max_power 0.63 (160 von 255) | `PART_FAN_PWM_MAX 160` |
| Düsenversatz T1 | X 35,0 / Y 0,0 | X 33,9 / Y 0,1 | `EXT1_X/Y_OFFSET_MM` |
| Bettnetz | 10,50 bis 200,275 | 10,15 bis 165,230 | an den Fahrweg angepasst |
| Prime Line | E13 / E25 | E4,9 / E9,4 | auf 2,85 mm umgerechnet |
| Parkposition Druckende | Y 295 | Y 240 | |

Nicht enthalten sind PID-Werte und Bettnetz für deinen Drucker. Die eingetragenen PID-Werte sind die des RF2000 v2 und nur ein Startwert.

## Zu prüfen vor dem ersten Druck

1. **Endstops:** `QUERY_ENDSTOPS` im Ruhezustand muss überall `open` zeigen.
2. **Y-Nullpunkt:** Beim RF2000 liegt Y=0 am Home-Schalter. Fahre nach `G28` mit Y in kleinen Schritten nach vorne und hinten und prüfe, ob 0 bis 245 frei ist.
3. **Thermistoren:** Die RF-Firmware nutzt für das Hotend V2 Tabelle 3, die Config einen 100k-Thermistor (Beta 4150). Vergleiche die angezeigte Temperatur bei Raumtemperatur und beim ersten Aufheizen.
4. **Extruder:** Fördere 100 mm Filament und miss nach. Passe `rotation_distance` an, falls nötig.
5. **PID und Bettnetz:** `PID_TUNING_HOTEND_1`, `PID_TUNING_HOTEND_2`, `PID_TUNING_BED`, danach `G28` und `BED_CALIBRATE`. Ohne Bettnetz bricht `PRINT_START` mit „Unknown profile“ ab, das ist Absicht.
6. **Düsenversatz:** mit `OFFSET_TEST` prüfen, siehe `offset_test.cfg`.

## Installieren

Am einfachsten mit dem Paket **rf-multi** (zwei Drucker an einem Raspberry Pi). Es legt diese Config automatisch an und trägt den Anschluss ein. Ohne rf-multi gehst du vor wie in der [RF2000v2-README](../RF2000v2_DualExtruder/README.md#installieren) beschrieben.

Die übrigen Funktionen (Display wie in der RF-Firmware, Z-Tasten, Sense Offset, Notfall-Pause, RGB-Licht) sind dieselben wie beim RF2000 v2.

## Lizenz

GPLv3, siehe [LICENSE](../../LICENSE).
