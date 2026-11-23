# 3D-Artmaker Design für Mainsail

Dunkles Theme in Marineblau mit dem 3D-Artmaker Logo (Farben aus dem Logo, Akzent `#2f6bff`).

## Inhalt (Ordner `.theme`)

| Datei | Wirkung |
|---|---|
| `custom.css` | Farben für Hintergrund, Karten, Kopfleiste, Seitenleiste, Schaltflächen, Fortschritt |
| `logo.svg`, `sidebar-logo.svg` | Logo in Mainsail (weiße Kachel mit Rundung, damit das dunkle Logo lesbar bleibt) |
| `sidebar-background.svg` | Marineblauer Verlauf in der Seitenleiste |
| `favicon.png` | Symbol im Browser-Tab (3D) |

## Einspielen

Am einfachsten mit dem Installer (`3DArtmaker-install`, Frage "Mainsail-Design"). `3DArtmaker-upgrade` hält das Design danach aktuell, aber nur in Ordnern, in denen es schon liegt. Die `navi.json` mit den Menüpunkten bleibt unberührt.

Von Hand: den Ordner `.theme` in den Config-Ordner des Druckers kopieren (versteckt, beginnt mit Punkt):

```
cp -r .theme ~/printer_data/config/
```

Mainsail danach mit **Strg+F5** neu laden. Bei mehreren Druckern in den jeweiligen Ordner `~/printer_<Name>_data/config/`.

In Mainsail unter *Einstellungen → Oberfläche* gibt es zusätzlich die Primärfarbe. Dort `#2f6bff` eintragen, dann stimmen auch Elemente, die das CSS nicht trifft.

Zurück zum Standard: Ordner `.theme` löschen.

## Stand

Nicht in Mainsail getestet. Die Klassen im CSS beruhen auf dem Vuetify-2-Aufbau von Mainsail. Ändert eine Mainsail-Version Klassen, fällt der Teil auf das Standarddesign zurück.
