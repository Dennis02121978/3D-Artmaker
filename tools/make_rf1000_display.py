#!/usr/bin/env python3
"""Erzeugt config/rf_display_rf1000.cfg (RF1000, 16x4) aus der rf_display.cfg (RF2000, 20x4).

Seiten und Menuetexte wie in der RF-Repetier-Firmware fuer den RF1000
(uimenu.h mit UI_COLS<=16, Kurztexte aus uilang.h). Jede Ersetzung wird
geprueft: Aendert sich die Vorlage, bricht das Skript ab, statt eine halbe
Datei zu schreiben.

Aufruf: python3 tools/make_rf1000_display.py
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'config', 'RF2000v2_DualExtruder', 'rf_display.cfg')
DST = os.path.join(HERE, '..', 'config', 'rf_display_rf1000.cfg')

REPL = [
    # Kopf
    ("# Display und Menue wie in der RF-Repetier-Firmware (RF2000 / RF2000 v2, 20x4)",
     "# Display und Menue wie in der RF-Repetier-Firmware (RF1000, 16x4)\n"
     "# Erzeugt aus der rf_display.cfg des RF2000 (tools/make_rf1000_display.py),\n"
     "# Aenderungen bitte dort machen."),
    ("#   hd44780_charset: western",
     "#   hd44780_charset: a00\n#   line_length: 16"),
    # Startbild: 16 Spalten, Balken mit 14 Feldern
    ("    {% if s < 24 %}\n    SET_GCODE_VARIABLE MACRO=_RF_SPLASH VARIABLE=step VALUE={s + 3 if s < 18 else s + 1}",
     "    {% if s < 20 %}\n    SET_GCODE_VARIABLE MACRO=_RF_SPLASH VARIABLE=step VALUE={s + 2 if s < 14 else s + 1}"),
    ("text: ~rf_cube_tl~~rf_cube_tr~  3D-Artmaker   ~rf_cube_tl~~rf_cube_tr~",
     "text: ~rf_cube_tl~~rf_cube_tr~ 3D-Artmaker"),
    ("text: ~rf_cube_bl~~rf_cube_br~  ~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~   ~rf_cube_bl~~rf_cube_br~",
     "text: ~rf_cube_bl~~rf_cube_br~ ~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~"),
    ('text: { "{:^20}".format("Version " ~ printer["gcode_macro _RF_INFO"].version) }',
     'text: { "{:^16}".format("Version " ~ printer["gcode_macro _RF_INFO"].version) }'),
    ('  {% if s < 18 %}[{ "~rf_full~" * s }{ "~rf_shade~" }{ " " * (17 - s) }]{% else %}{ "{:^20}".format("Stand " ~ printer["gcode_macro _RF_INFO"].stand) }{% endif %}',
     '  {% if s < 14 %}[{ "~rf_full~" * s }{ "~rf_shade~" }{ " " * (13 - s) }]{% else %}{ "{:^16}".format("Stand " ~ printer["gcode_macro _RF_INFO"].stand) }{% endif %}'),
    # Seiten wie ui_page1 usw. mit UI_COLS<=16
    ('  { "Z%s%6.2f %6.2f%s" % (":" if "z" in th.homed_axes else "?", gz, th.position.z - gz, " Kmp" if printer.bed_mesh.profile_name else "") }',
     '  { "Z%s%6.2f %6.2f%s" % (":" if "z" in th.homed_axes else "?", gz, th.position.z - gz, "K" if printer.bed_mesh.profile_name else "") }'),
    ('# Kmp = Kompensation (Bettnetz) aktiv; ? statt : = nicht referenziert',
     '# K = Kompensation (Bettnetz) aktiv; ? statt : = nicht referenziert'),
    ('  ~extruder~{ "%3.0f/%3.0f" % (e.temperature, e.target) }~degrees~{ " B%3.0f/%3.0f" % (b.temperature, b.target) }~degrees~',
     '  ~extruder~{ "%3.0f/%3.0f" % (e.temperature, e.target) }{ "B%3.0f/%3.0f" % (b.temperature, b.target) }'),
    ('text: { "P: %5d L: %5.1f%%" % (printer["rf1000_load_cell_probe"].last_force, printer.fan.speed * 100) }',
     'text: { "P: %5d L:%3d%%" % (printer["rf1000_load_cell_probe"].last_force, printer.fan.speed * 100) }'),
    ('text: { "P:%6d     V: %3d%%" % (printer["rf1000_load_cell_probe"].last_force, printer.gcode_move.speed_factor * 100) }',
     'text: { "P:%6d  V:%3d%%" % (printer["rf1000_load_cell_probe"].last_force, printer.gcode_move.speed_factor * 100) }'),
    ('text: { "zO:%5d um zMat: %s" % (printer.gcode_move.homing_origin.z * 1000, "An" if printer.bed_mesh.profile_name else "Aus") }',
     'text: { "zO:%4dum zM:%s" % (printer.gcode_move.homing_origin.z * 1000, "An" if printer.bed_mesh.profile_name else "Aus") }'),
    ('  { "sO:%4d um " % (so.z_offset * 1000) }{ ("%s%5d" % ("@" if so.enabled else "^", so.force_threshold)) if so.enabled or so.z_offset > 0 else "Aus" }',
     '  { "sO:%4dum " % (so.z_offset * 1000) }{ ("%s%5d" % ("@" if so.enabled else "^", so.force_threshold)) if so.enabled or so.z_offset > 0 else "Aus" }'),
    ('text: { "F:%3d %3d%% %5.1fmm/s" % (printer.gcode_move.speed / 60, printer.gcode_move.speed_factor * 100, printer.motion_report.live_velocity) }',
     'text: { "F:%3d%% v:%3.0fmm/s" % (printer.gcode_move.speed_factor * 100, printer.motion_report.live_velocity) }'),
    ('text: { "E0:%3.0f/%3.0f" % (printer.extruder.temperature, printer.extruder.target) }~degrees~{ "C->%3d%%" % (printer.extruder.power * 100) }',
     'text: { "E0:%3.0f/%3.0f" % (printer.extruder.temperature, printer.extruder.target) }~degrees~{ "C>%3d" % (printer.extruder.power * 100) }'),
    ('  {% if \'extruder1\' in printer %}{ "E1:%3.0f/%3.0f" % (printer.extruder1.temperature, printer.extruder1.target) }~degrees~{ "C->%3d%%" % (printer.extruder1.power * 100) }{% endif %}',
     '  {% if \'extruder1\' in printer %}{ "E1:%3.0f/%3.0f" % (printer.extruder1.temperature, printer.extruder1.target) }~degrees~{ "C>%3d" % (printer.extruder1.power * 100) }{% endif %}'),
    ('text: { "B: %3.0f/%3.0f" % (printer.heater_bed.temperature, printer.heater_bed.target) }~degrees~{ "C->%3d%%" % (printer.heater_bed.power * 100) }',
     'text: { "B: %3.0f/%3.0f" % (printer.heater_bed.temperature, printer.heater_bed.target) }~degrees~{ "C>%3d" % (printer.heater_bed.power * 100) }'),
    ('text: { (printer.print_stats.filename or "Kein Druck")[:20] }',
     'text: { (printer.print_stats.filename or "Kein Druck")[:16] }'),
    ('  { "Druckzeit %3d:%02d:%02d" % (t // 3600, (t // 60) % 60, t % 60) }',
     '  { "Zeit %3d:%02d:%02d" % (t // 3600, (t // 60) % 60, t % 60) }'),
    ('text: { "Filament %8.2f m" % (printer.print_stats.filament_used / 1000) }',
     'text: { "Filam.%8.2f m" % (printer.print_stats.filament_used / 1000) }'),
    # Menue: Kurztexte des RF1000 aus uilang.h (UI_TEXT_..., zweiter Block)
    ("name: Schnelleinstellung", "name: Schnelleinst."),
    ("name: Motoren ausschalten", "name: Motoren aussch."),
    ("name: Geschw. Mul.:{'%3d' % menu.input}%", "name: Geschw.Mul:{'%3d' % menu.input}%"),
    ("name: Fluss Mul.  :{'%3d' % menu.input}%", "name: Fluss Mul.:{'%3d' % menu.input}%", 2),
    ("name: Position X:{'%7.1f' % menu.input}", "name: Pos. X:{'%7.1f' % menu.input}", 2),
    ("name: Position Y:{'%7.1f' % menu.input}", "name: Pos. Y:{'%7.1f' % menu.input}", 2),
    ("name: Position Z:{'%7.2f' % menu.input}", "name: Pos. Z:{'%7.2f' % menu.input}", 2),
    ("name: Position E:{'%+4.0f' % menu.input} mm", "name: Pos. E:{'%+4.0f' % menu.input}mm"),
    ("name: Temp. Bed:{'%3d' % menu.input}~degrees~C~extruder~{'%3.0f' % printer.heater_bed.temperature}",
     "name: Temp. Bed:{'%3d' % menu.input}~degrees~C"),
    ("name: Temp. E0 :{'%3d' % menu.input}~degrees~C~extruder~{'%3.0f' % printer.extruder.temperature}",
     "name: Temp. E0 :{'%3d' % menu.input}~degrees~C"),
    ("name: Temp. E1 :{'%3d' % menu.input}~degrees~C~extruder~{'%3.0f' % (printer.extruder1.temperature if 'extruder1' in printer else 0)}",
     "name: Temp. E1 :{'%3d' % menu.input}~degrees~C"),
    ("name: Aktiver Extruder:{'%d' % menu.input}", "name: Aktiver Extr. {'%d' % menu.input}"),
    ("name: Filament entladen", "name: Filament entl."),
    ("name: Setze E Ursprung", "name: Setze E Urspr."),
    ("name: Lüfter: {'%3d' % menu.input}%", "name: Lüfter:{'%3d' % menu.input}%"),
    ("name: Lüfter auf  25%", "name: Lüfter auf 25%"),
    ("name: Lüfter auf  50%", "name: Lüfter auf 50%"),
    ("name: Lüfter auf  75%", "name: Lüfter auf 75%"),
    ("name: Druck fortsetzen", "name: Druck forts."),
    ("name: Z Abstand:{'%7.3f' % menu.input}", "name: Z Abst.:{'%7.3f' % menu.input}"),
    ("name: Level:{'%6d' % menu.input} digits", "name: Level:{'%5d' % menu.input}digi"),
    ("name: Min:{'%6d' % menu.input} digits", "name: Min:{'%6d' % menu.input} digi"),
    ("name: Max:{'%6d' % menu.input} digits", "name: Max:{'%6d' % menu.input} digi"),
    ("name: Werkseinstellungen", "name: Werkseinstell."),
    ("name: Druck abbrechen", "name: Druck abbr.", 2),
    ("name: Ja, zurücksetzen", "name: Ja, zurücks."),
]


def main():
    s = open(SRC, encoding='utf-8').read()
    for item in REPL:
        a, b = item[0], item[1]
        n = item[2] if len(item) > 2 else 1
        found = s.count(a)
        if found != n:
            sys.exit("Vorlage geaendert, %d statt %d Treffer fuer:\n  %s" % (found, n, a))
        s = s.replace(a, b)
    # Pruefen: kein Menuetext ohne Platzhalter laenger als 15 Zeichen (16 minus Cursor)
    long = [m for m in re.findall(r'^name: ([^{\n]+)$', s, re.M) if len(m) > 15]
    if long:
        sys.exit("Zu lang fuer 16 Spalten: %s" % (long,))
    open(DST, 'w', encoding='utf-8').write(s)
    print("Erstellt:", os.path.normpath(DST))


if __name__ == '__main__':
    main()
