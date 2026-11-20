# Druckbett mit 3D-Artmaker-Logo für OrcaSlicer

Bett-Modell und Bett-Textur für den RF1000, RF2000 und RF2000 v2. In OrcaSlicer siehst du dann statt der leeren Platte ein Bett mit Raster (10 mm, alle 50 mm beschriftet), dem 3D-Artmaker-Logo und dem Druckernamen.

| Drucker | Textur | Modell | Druckfläche |
|---|---|---|---|
| RF1000 | [RF1000_texture.png](RF1000_texture.png) | [RF1000_bed.stl](RF1000_bed.stl) | 240 x 245 mm |
| RF2000 | [RF2000_texture.png](RF2000_texture.png) | [RF2000_bed.stl](RF2000_bed.stl) | 200 x 245 mm |
| RF2000 v2 | [RF2000v2_texture.png](RF2000v2_texture.png) | [RF2000v2_bed.stl](RF2000v2_bed.stl) | 200 x 295 mm |

## In OrcaSlicer einstellen

1. Die beiden Dateien für deinen Drucker herunterladen und an einen festen Ort legen, zum Beispiel in deinen Dokumente-Ordner. OrcaSlicer merkt sich nur den Pfad.
2. In OrcaSlicer neben dem Drucker auf das Bearbeiten-Symbol klicken.
3. **Basic information**, Bereich **Printable space**:
   - Bei **Bed custom texture** auf **Load** klicken und `<Drucker>_texture.png` wählen.
   - Bei **Bed custom model** auf **Load** klicken und `<Drucker>_bed.stl` wählen.
4. Das Druckerprofil speichern.
5. Hast du eine Datei unter demselben Namen ersetzt, OrcaSlicer ganz beenden (Mac: Cmd+Q) und neu starten. Orca liest das Modell nur neu ein, wenn sich der Dateiname ändert.

Je nach Version heißen die Felder etwas anders, oder sie stehen im Fenster hinter dem Knopf neben **Printable area**.

OrcaSlicer zieht die Textur auf die **Printable area** deines Profils. Weicht die Fläche ab, zum Beispiel beim RF1000 mit zwei Extrudern (200 statt 240 mm in X), wird das Logo etwas gestaucht. Das Raster stimmt dann nicht mehr genau mit den Millimetern überein.

## Neu erzeugen

```bash
python3 tools/make_orca_beds.py
```

Maße, Farben und Logo-Deckkraft stehen oben im Skript. Das Logo kommt aus `skipr-bootlogo/logo.png`.
