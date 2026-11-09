# OrcaSlicer für den RF2000 v2 Dual Extruder

Passt zu `printer.cfg` und `macros.cfg` in diesem Ordner (Stand 05.11.2026).
Die Namen sind die englischen Bezeichnungen aus OrcaSlicer. Je nach Version und
Sprache können sie etwas anders heißen oder an anderer Stelle stehen.

Mit "Startwert" markierte Zahlen stammen nicht aus der Config und wurden nicht am
Drucker gemessen. Diese bitte kalibrieren.

## 1. Drucker (Printer Settings)

| Einstellung | Wert | Woher |
|---|---|---|
| Printable area | 200 x 290 mm | Maximaler Fahrweg X 200 mm und Y 290 mm (`position_max`), Ursprung 0 / 0 = vordere linke Ecke des Betts |
| Bed exclude area | `0x0,200x0,200x15,0x15` | Vorderer Streifen 15 mm für die Prime Line, bedruckbar bleiben 200 x 275 mm |
| Printable height | 185 mm | `position_max` Z ist 190 mm, 5 mm Reserve für Z-Hop und Parken |
| G-code flavor | Klipper | |
| Use relative E distances | an | |
| Use firmware retraction | aus | Es gibt kein `[firmware_retraction]` |
| Exclude objects | an | `[exclude_object]` ist aktiv |
| Thumbnails | `32x32/PNG,300x300/PNG` | Für die Vorschau in Mainsail |
| Single Extruder Multi Material | **aus** | Zwei Heizungen und zwei Düsen |
| Anzahl Extruder | 2 | |
| Nozzle diameter | 0,4 mm bei beiden | `nozzle_diameter` |

### Motion ability

| Einstellung | Wert |
|---|---|
| Maximum speed X und Y | 200 mm/s |
| Maximum speed Z | 50 mm/s |
| Maximum acceleration X und Y | 1500 mm/s² |
| Maximum acceleration Z | 70 mm/s² |

### Extruder offset

**In OrcaSlicer bleibt der Extruder offset bei beiden Extrudern `0 x 0`.** Der Versatz der
Düsen steht in Klipper. Trägst du ihn auch hier ein, wird er doppelt angewendet.

### Düsenversatz in Klipper

**Das muss vor dem ersten Druck mit T1 eingestellt werden, auch wenn nur T1 druckt.** Die Werte
stehen in der `macros.cfg` beim Makro `T1`:

```
variable_offset_x: 0.0
variable_offset_y: 0.0
```

Klipper addiert sie zu den Koordinaten. Das Vorzeichen ist also umgekehrt zur Lage der Düse:

| Lage von Düse 2 gegenüber Düse 1 | Wert |
|---|---|
| rechts | `offset_x` negativ |
| links | `offset_x` positiv |
| zum höheren Y hin | `offset_y` negativ |
| zum niedrigeren Y hin | `offset_y` positiv |

Nach dem Ändern **Speichern & Neustart** klicken. Die Werte mit einem Testdruck prüfen, zum
Beispiel einem Würfel mit zweifarbigem Muster.

Beide Düsen müssen außerdem gleich hoch stehen. Die Makros gleichen nur X und Y aus.

### Nutzbare Fläche mit T1

Der Kopf kann nur X 0 bis 200 mm und Y 0 bis 290 mm fahren. Der Versatz verschiebt den Bereich,
den T1 erreicht. Teile, die T1 druckt, müssen deshalb hier liegen:

| Achse | `offset` negativ | `offset` positiv |
|---|---|---|
| X | von `-offset_x` bis `200` | von `0` bis `200 - offset_x` |
| Y | von `-offset_y` bis `290` | von `0` bis `290 - offset_y` |

Beispiel mit `offset_x: -30` und `offset_y: 5`: T1 erreicht X 30 bis 200 und Y 0 bis 285.

Die Druckplatte in OrcaSlicer bleibt 200 x 290 mm groß und zeigt diese Grenze nicht an. Liegt
ein Teil oder der Prime Tower außerhalb, bricht Klipper den Druck mit `Move out of range` ab.
Stelle Teile und Prime Tower deshalb selbst in diesen Bereich.

### Retraction bei beiden Extrudern

| Einstellung | Wert |
|---|---|
| Length | 1,0 mm (Startwert) |
| Retraction speed | 30 mm/s (Startwert) |
| Z hop | 0,2 mm (Startwert) |
| Length beim Werkzeugwechsel | 2,0 mm (Startwert) |

## 2. Machine start G-code

Den vorhandenen Text komplett ersetzen:

```
M140 S0 ; damit OrcaSlicer nicht selbst vor PRINT_START heizt
M104 S0 ; damit OrcaSlicer nicht selbst vor PRINT_START heizt
T{initial_tool}
{if is_extruder_used[0] and initial_tool != 0}M104 T0 S{nozzle_temperature_initial_layer[0]}{endif}
{if is_extruder_used[1] and initial_tool != 1}M104 T1 S{nozzle_temperature_initial_layer[1]}{endif}
PRINT_START BED_TEMP=[bed_temperature_initial_layer_single] EXTRUDER_TEMP={nozzle_temperature_initial_layer[initial_tool]}
{if is_extruder_used[0] and initial_tool != 0}M109 T0 S{nozzle_temperature_initial_layer[0]}{endif}
{if is_extruder_used[1] and initial_tool != 1}M109 T1 S{nozzle_temperature_initial_layer[1]}{endif}
```

Was das macht:

- Das erste Werkzeug wird aktiviert, und `PRINT_START` heizt es und zieht damit die Prime Line: bei Y3 von rechts nach links, 1 mm versetzt bei Y4 wieder zurück.
- Wird die zweite Düse auch gebraucht, heizt sie gleich mit. Der Druck beginnt erst, wenn sie heiß ist.
- Wird sie nicht gebraucht, bleibt sie kalt.

Die zweite Düse bekommt keine Prime Line. Dafür ist der Prime Tower aus Abschnitt 4 da.

## 3. Machine end G-code

```
PRINT_END
```

`PRINT_END` schaltet alle Heizungen aus und parkt den Kopf.

Das Feld **Change filament G-code** bleibt leer. Der Werkzeugwechsel läuft über die Makros `T0` und `T1`.

## 4. Filament und Druck

| Einstellung | Wert | Warum |
|---|---|---|
| Enable pressure advance (Filament) | aus | `pressure_advance: 0.1` steht schon in der `printer.cfg`, sonst würde der Wert überschrieben. Wer pro Filament kalibriert, schaltet es ein und trägt den Wert ein |
| Nozzle temperature, Bed temperature | je nach Filament | Grenzen: Düse 170 bis 260 °C, Bett maximal 130 °C |

### Nur beim Druck mit beiden Düsen

| Einstellung | Wert |
|---|---|
| Prime tower | an |
| Ooze prevention | an |
| Temperature variation | -40 °C (Startwert) |

Mit Ooze prevention wird die freie Düse kühler gehalten und nach jedem Wechsel wieder
aufgeheizt. Das verlängert den Druck, dafür tropft sie weniger.

Der Düsenversatz verkleinert die nutzbare Fläche, siehe "Nutzbare Fläche mit T1" in Abschnitt 1.

## 5. Vor dem ersten Druck prüfen

1. Slicen und die G-Code-Datei öffnen.
2. Im oberen Teil müssen `PRINT_START BED_TEMP=...` und `EXTRUDER_TEMP=...` echte Zahlen enthalten.
3. Vor `PRINT_START` dürfen keine Zeilen mit `M190` oder `M109` und einer Temperatur stehen.
4. Bei einem Druck mit nur einer Düse darf `M104 T...` nur für diese Düse vorkommen.
5. Erst mit nur einer Düse drucken, dann mit beiden. Bleib beim ersten Druck am Not-Halt.
