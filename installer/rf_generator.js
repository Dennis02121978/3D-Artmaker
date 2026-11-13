// rf_generator.js: Config-Generator des Renkforce Config Creators fuer den 3D-Artmaker Installer.
// Automatisch erzeugt von RenkforceConfigCreator/sync_files.py aus config-creator/index.html.
// Nicht von Hand aendern, sondern im Creator und danach sync_files.py ausfuehren.
// Aufruf: qjs --std rf_generator.js BEFEHL ...  oder  node rf_generator.js BEFEHL ...
'use strict';
// [X max, Y-Fahrweg ab Home-Schalter, LED], am Drucker gemessen
const SIZES = {
  single: { rf1000: [240, 245, false], rf2000: [200, 245, true], rf2000v2: [200, 295, true] },
  dual:   { rf1000: [200, 245, false], rf2000: [200, 245, true], rf2000v2: [200, 295, true] }
};
// Y: Y=0 ist die Vorderkante des Betts. Beim Home-Schalter steht die Duese YHOME mm davor (am Drucker gemessen).
// position_endstop/position_min = -YHOME, position_max (Y max) = Fahrweg - YHOME
// YFRONT: vorderer Streifen fuer die Prime Line (Y3 und Y4), im Slicer nicht bedruckbar, bei allen Modellen 15 mm.
// MESHY: hinterer Rand des Bettnetzes (hoechstens Y max - 5)
const YHOME = { rf1000: 22, rf2000: 18, rf2000v2: 5 };
// Marlin (Slicer-Nullpunkt): am RF2000 mit Marlin gemessen 22 mm -> Sperrbereich 0x22,200x22,200x27,0x27
const YHOME_MARLIN = { rf1000: 22, rf2000: 22, rf2000v2: 5 };
// Marlin: bedruckbare Bettbreite im Slicer (RF1000/RF2000 Single 240, Dual 200 mm)
const BEDX_MARLIN = { single: { rf1000: 240, rf2000: 240, rf2000v2: 200 }, dual: { rf1000: 200, rf2000: 200, rf2000v2: 200 } };
const MESHY = { rf1000: 220, rf2000: 220, rf2000v2: 275 };
const YFRONT = { rf1000: 15, rf2000: 15, rf2000v2: 15 };
// Z-Endstop: RF1000 mechanischer Endschalter, RF2000/RF2000v2 Lichtschranke
const ZMIN = { rf1000: -0.8, rf2000: -1.2, rf2000v2: -1.2 };
const NAMES = { rf1000: 'RF1000', rf2000: 'RF2000', rf2000v2: 'RF2000 v2' };
// Z max bei allen Modellen 190 mm: 10 mm Reserve unter dem Fahrweg (200 mm), weil Klipper Z beim Homing
// zuerst von der Duese wegfaehrt (z_hop) und die Achse dabei nicht an das Ende fahren darf
const ZMAX = 190;
// Marlin RFxxxx: Bauraum wie RF Repetier (RF1000.h / RF2000.h / RF2000v2.h), 0 = Schalter
const SIZES_MARLIN = {
  single: { rf1000: [240, 245, false], rf2000: [240, 245, true], rf2000v2: [230, 290, true] },
  dual:   { rf1000: [200, 245, false], rf2000: [200, 245, true], rf2000v2: [170, 290, true] }
};
const ZMAX_MARLIN = { rf1000: 200, rf2000: 200, rf2000v2: 185 };

const fmt = n => String(Math.round(n * 1000) / 1000);
// Zeile(n) nur ausgeben, wenn Bedingung wahr
const when = (c, t) => c ? t + '\n' : '';
const cleanName = (v, i) => (String(v || '').trim().replace(/[^A-Za-z0-9_-]/g, '') || 'Drucker' + i).slice(0, 31);

// MKS SKIPR (Umbau, Klipper direkt auf dem Board): Werte aus der laufenden Config eines RF2000 mit 2in1-Hotend.
// [X max, Y-Fahrweg ab Home-Schalter]; Duese am Y-Schalter 25 mm vor dem Bett, Z max 180 mm, Ueberfahrweg 0,8 mm
const SIZES_SKIPR = { rf1000: [220, 245], rf2000: [220, 245], rf2000v2: [220, 295] };
const SKIPR_YHOME = 25, SKIPR_ZMAX = 180, SKIPR_ZMIN = -0.8;
// Vorgaben, die vom Board abhaengen (beim Wechsel des Boards gesetzt)
const BOARD_DEF = {
  atmega: { serial: '/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_AL03P23U-if00-port0', esteps: 280, zpin: 'PC6' },
  skipr:  { serial: '/dev/ttyS0', esteps: 385.08, zpin: 'PB15' }
};
// Mikroschritte des Extruders: Renkforce-Board (DRV8711) 32, SKIPR (TMC2240) 16
const MICROSTEPS_E = { atmega: 32, skipr: 16 };
const BOARD_NAMES = { atmega: 'Renkforce-Board (ATmega2560)', skipr: 'MKS SKIPR' };

// Masse und Schalter je Modell: setzt der Creator bei Modellwechsel, der Installer als Vorgabe
function modelDefaults(board, marlin, ext, m) {
  if (board === 'skipr') {
    const sz = SIZES_SKIPR[m] || SIZES_SKIPR.rf2000;
    return { xmax: sz[0], ytravel: sz[1], led: true, zmax: SKIPR_ZMAX, rfdisp: false, zmin: SKIPR_ZMIN,
             yhome: SKIPR_YHOME, yfront: ext === '2in1' ? 0 : YFRONT[m] };
  }
  const e = ext === 'dual' ? 'dual' : 'single';
  const sz = (marlin ? SIZES_MARLIN : SIZES)[e][m];
  const d = { xmax: sz[0], ytravel: sz[1], led: sz[2], zmax: marlin ? ZMAX_MARLIN[m] : ZMAX, rfdisp: true, zmin: ZMIN[m],
              yhome: (marlin ? YHOME_MARLIN : YHOME)[m], yfront: marlin ? 5 : YFRONT[m] };
  if (marlin) { const o = MOFF[m] || MOFF.rf2000v2; d.offx = o[0]; d.offy = o[1]; }
  return d;
}
// Vorgaben in Formularwerte uebertragen (Schluessel wie snapshot(): 'v:id', 'c:id', 'r:name')
function applyDefaults(f, d) {
  ['xmax', 'ytravel', 'zmax', 'zmin', 'yhome', 'yfront', 'offx', 'offy'].forEach(k => { if (d[k] !== undefined) f['v:' + k] = String(d[k]); });
  f['c:led'] = !!d.led; f['c:rfdisp'] = !!d.rfdisp;
  return f;
}
// Vorgaben beim Wechsel des Boards (Anschluss, Extruder-Schritte, Z-Pin, Extruder-Art)
function boardDefaults(f, board) {
  const b = BOARD_DEF[board] || BOARD_DEF.atmega;
  f['v:serial'] = b.serial; f['v:esteps'] = String(b.esteps); f['v:zpin'] = b.zpin;
  if (board === 'skipr' && f['r:ext'] !== 'single') f['r:ext'] = '2in1';
  if (board !== 'skipr' && f['r:ext'] === '2in1') f['r:ext'] = 'single';
  return f;
}

// Einstellungen eines Druckers aus den Formularwerten (Schluessel wie snapshot()) plus
// board, fw, pcount und pnum. Der Creator und der 3D-Artmaker Installer rufen das gleich auf.
function stateFrom(f) {
  const v = id => (f['v:' + id] === undefined || f['v:' + id] === null) ? '' : String(f['v:' + id]);
  const c = id => !!f['c:' + id];
  const r = n => f['r:' + n];
  const num = (id, d) => { const x = parseFloat(v(id)); return isFinite(x) ? x : d; };
  const board = f.board === 'skipr' ? 'skipr' : 'atmega', skipr = board === 'skipr';
  const marlin = !skipr && f.fw === 'marlin';
  const mkey = NAMES[v('model')] ? v('model') : 'rf2000';
  const dual = !skipr && r('ext') === 'dual', twoin1 = skipr && r('ext') === '2in1';
  const xmax = num('xmax', 200), ytravel = num('ytravel', 295), zmax = num('zmax', 190);
  // Marlin: Y=0 am Schalter wie Repetier, das Feld ist dort Y max
  const yoff = Math.max(0, num('yhome', 5));   // Duese am Y-Schalter vor dem Bett (Marlin: nur Slicer)
  const yhome = marlin ? 0 : yoff, ymax = ytravel - yhome;
  const useOff = dual;
  // Mehrere Drucker an einem Pi (Paket rf-multi): Drucker 2 bis 4 haben einen eigenen Ordner. SKIPR: immer einer.
  const pcount = skipr ? 1 : Math.min(4, Math.max(1, parseInt(f.pcount, 10) || 1));
  const pnum = pcount === 1 ? 1 : Math.min(pcount, Math.max(1, parseInt(f.pnum, 10) || 1));
  const pname = cleanName(v('pname'), pnum);
  const eon = c('eon'), fon = c('fon');
  const ms = MICROSTEPS_E[board];
  return {
    board, skipr, twoin1, microsteps: ms,
    dual, model: NAMES[mkey], mkey, marlin, esteps: num('esteps', 280), xmax, ymax, ytravel, zmax,
    meshy: Math.min(MESHY[mkey] || ymax - 5, ymax - 5),
    pcount, pnum, pname, dataDir: pnum === 1 ? 'printer_data' : `printer_${pname}_data`,
    mport: 7124 + pnum, wport: pnum === 1 ? 80 : 79 + pnum, rfdisp: !skipr && c('rfdisp'),
    yhome, yoff, yfront: Math.max(0, num('yfront', 0)),
    hp: c('hp') && !twoin1, hpmin: num('hpmin', 30), hpmax: Math.max(num('hpmin', 30), num('hpmax', 50)), hpwait: Math.max(0, num('hpwait', 45)),
    led: (skipr || mkey !== 'rf1000') && c('led'), fil: r('fil') || '1.75',
    nozzle: num('nozzle', 0.4),
    rot: Math.round(200 * ms / Math.max(num('esteps', 280), 0.01) * 1000) / 1000,
    serial: v('serial').trim(), zmin: num('zmin', -1.2),
    zpin: (c('zinv') ? '!' : '') + (v('zpin').trim().replace(/^!/, '') || BOARD_DEF[board].zpin),
    light: mkey !== 'rf1000',
    ftype: r('ftype') || 'pla', ftemp: Math.min(300, Math.max(150, num('ftemp', 195))), fbed: Math.min(120, Math.max(0, num('fbed', 65))),
    offx: useOff ? num('offx', 35) : 0, offy: useOff ? num('offy', 0) : 0,
    guard: !skipr && c('guard'), digits: !skipr && c('digits'),
    emin: eon ? -Math.abs(num('emin', 0)) : 0, emax: eon ? Math.abs(num('emax', 0)) : 0,
    esamp: Math.max(1, Math.round(num('esamp', 5))), fminz: Math.max(0, num('fminz', 0.2)),
    fmin: fon ? Math.min(Math.abs(num('fmin', 0)), Math.abs(num('fmax', 0))) : 0,
    fmax: fon ? Math.max(Math.abs(num('fmin', 0)), Math.abs(num('fmax', 0))) : 0,
    fpct: fon ? Math.min(99, Math.max(-99, num('fpct', 0))) : 0, vpct: fon ? Math.min(99, Math.max(-90, num('vpct', 0))) : 0
  };
}

// Feste Dateien aus dem Repo 3D-Artmaker (z_tasten.cfg, rf_display.cfg). Der Block
// zwischen BEGIN und END wird von sync_files.py geschrieben, nicht von Hand aendern.
// BEGIN STATIC FILES
const STATIC = {
 "z_tasten": "# Z-Tasten am RF2000\n# Z_DOWN erhoeht Z, Z_UP verringert Z (wie die bisherige Belegung).\n# Kurz druecken: 0,03 mm. Nach 2 Sekunden Halten: 3 mm/s bis zum Loslassen.\n# Waehrend eines Drucks: Babystep um 0,005 mm, Halten faehrt nicht.\n# Ohne Z-Referenzfahrt tun die Tasten nichts.\n# Beim Halten stoppt die Fahrt in Richtung kleineres Z bei hold_min_z,\n# die kurzen Schritte erst bei position_min.\n\n[z_jog]\nincrease_pin: !PJ4\ndecrease_pin: !PJ2\nhold_delay: 2.0\nhold_speed: 8.0\nhold_min_z: 0.0\nmax_margin: 0.5\npress_gcode:\n    _Z_JOG_START DIR={params.DIR}\n\n[gcode_macro _Z_JOG]\nvariable_step: 0.03\nvariable_step_speed: 3.0\nvariable_babystep: 0.005\nvariable_max_margin: 0.5\ngcode:\n    # Nur Variablen\n\n[gcode_macro _Z_JOG_START]\ngcode:\n    {% set jog = printer[\"gcode_macro _Z_JOG\"] %}\n    {% set dir = params.DIR|int %}\n    {% if printer.print_stats.state == \"printing\" %}\n        SET_GCODE_OFFSET Z_ADJUST={jog.babystep * dir}\n    {% elif \"z\" not in printer.toolhead.homed_axes %}\n        RESPOND TYPE=error MSG=\"Z-Tasten: Zuerst die Z-Achse referenzieren.\"\n    {% else %}\n        {% set z = printer.toolhead.position.z %}\n        {% set low = printer.toolhead.axis_minimum.z %}\n        {% set high = printer.toolhead.axis_maximum.z - jog.max_margin %}\n        {% set target = [[z + jog.step * dir, low]|max, high]|min %}\n        {% set dist = target - z %}\n        {% if dist * dir > 0 %}\n            SAVE_GCODE_STATE NAME=_z_jog\n            G91\n            G1 Z{\"%.4f\" % dist} F{jog.step_speed * 60}\n            RESTORE_GCODE_STATE NAME=_z_jog\n        {% endif %}\n    {% endif %}\n",
 "rf_display": "################################################################################\n# Display und Menue wie in der RF-Repetier-Firmware (RF2000 / RF2000 v2, 20x4)\n# Einbinden in printer.cfg mit [include rf_display.cfg]\n# Unter [display] dazu:\n#   display_group: rf_splash   (Startbild, danach rf_page1)\n#   menu_root: rf\n#   menu_pages: rf_page1, rf_page_mod, rf_page2, rf_page3, rf_page4\n#   menu_show_back: False\n#   hd44780_charset: western\n# Braucht den Klipper-Fork Dennis02121978/klipper (Umlaute, Seitenwechsel,\n# SET_Z_SENSE_OFFSET). Ausserhalb des Menues blaettern hoch/runter die Seiten,\n# zurueck springt auf Seite 1, OK oeffnet das Menue.\n# Einstellungen aus dem Menue (DMS, Beschleunigung, Feedrate) werden wie im\n# EEPROM in rf_variables.cfg gespeichert und beim Start geladen.\n################################################################################\n\n# [save_variables] steht in der printer.cfg, damit jeder Drucker (auch mehrere an\n# einem Raspberry Pi) seine eigene rf_variables.cfg hat:\n#   [save_variables]\n#   filename: ~/printer_data/config/rf_variables.cfg\n\n################################################################################\n# Startbild beim Verbinden: 3D-Artmaker mit Version und Stand\n# Unter [display] dazu: display_group: rf_splash\n# Ablauf: Balken laeuft ca. 3 s, dann 3 s Version/Stand, dann Seite 1.\n################################################################################\n\n# Version und Stand der Config (bei einem neuen Release anpassen)\n[gcode_macro _RF_INFO]\nvariable_version: \"v1.6.2\"\nvariable_stand: \"12.11.2026\"\ngcode:\n    {% set i = printer[\"gcode_macro _RF_INFO\"] %}\n    RESPOND MSG=\"3D-Artmaker {i.version}, Stand {i.stand}\"\n\n[gcode_macro _RF_SPLASH]\nvariable_step: 0\ngcode:\n    # Nur Variable fuer das Startbild\n\n[delayed_gcode _RF_SPLASH_RUN]\ninitial_duration: 0.5\ngcode:\n    {% set s = printer[\"gcode_macro _RF_SPLASH\"].step %}\n    {% if s < 24 %}\n    SET_GCODE_VARIABLE MACRO=_RF_SPLASH VARIABLE=step VALUE={s + 3 if s < 18 else s + 1}\n    UPDATE_DELAYED_GCODE ID=_RF_SPLASH_RUN DURATION=0.5\n    {% else %}\n    SET_DISPLAY_GROUP GROUP=rf_page1\n    {% endif %}\n\n# Eigene Zeichen (5x8) nur fuer das Startbild. Die Plaetze werden beim\n# Zeichnen belegt, die Seiten danach nutzen ihre eigenen Zeichen wieder.\n# Isometrischer Wuerfel aus 2x2 Zeichen: Deckel als Umriss, links voll,\n# rechts schraffiert\n[display_glyph rf_cube_tl]\nhd44780_slot: 1\nhd44780_data:\n  .....\n  ....*\n  ..**.\n  **...\n  ****.\n  *****\n  *****\n  *****\n\n[display_glyph rf_cube_tr]\nhd44780_slot: 2\nhd44780_data:\n  .....\n  *....\n  .**..\n  ...**\n  .****\n  *.*.*\n  .*.**\n  *.*.*\n\n[display_glyph rf_cube_bl]\nhd44780_slot: 3\nhd44780_data:\n  *****\n  *****\n  *****\n  *****\n  *****\n  ..***\n  ....*\n  .....\n\n[display_glyph rf_cube_br]\nhd44780_slot: 4\nhd44780_data:\n  .*.**\n  *.*.*\n  .*.**\n  *.*.*\n  .*.**\n  ***..\n  *....\n  .....\n\n# Unterstrich unter dem Namen\n[display_glyph rf_line]\nhd44780_slot: 5\nhd44780_data:\n  *****\n  .....\n  .*.*.\n  .....\n  .....\n  .....\n  .....\n  .....\n\n# Fortschrittsbalken: voll und Spitze\n[display_glyph rf_full]\nhd44780_slot: 7\nhd44780_data:\n  *****\n  *****\n  *****\n  *****\n  *****\n  *****\n  *****\n  *****\n\n[display_glyph rf_shade]\nhd44780_slot: 6\nhd44780_data:\n  *.*.*\n  .*.*.\n  *.*.*\n  .*.*.\n  *.*.*\n  .*.*.\n  *.*.*\n  .*.*.\n\n[display_data rf_splash title]\nposition: 0, 0\ntext: ~rf_cube_tl~~rf_cube_tr~  3D-Artmaker   ~rf_cube_tl~~rf_cube_tr~\n\n[display_data rf_splash line]\nposition: 1, 0\ntext: ~rf_cube_bl~~rf_cube_br~  ~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~   ~rf_cube_bl~~rf_cube_br~\n\n[display_data rf_splash version]\nposition: 2, 0\ntext: { \"{:^20}\".format(\"Version \" ~ printer[\"gcode_macro _RF_INFO\"].version) }\n\n[display_data rf_splash bar]\nposition: 3, 0\ntext:\n  {% set s = printer[\"gcode_macro _RF_SPLASH\"].step %}\n  {% if s < 18 %}[{ \"~rf_full~\" * s }{ \"~rf_shade~\" }{ \" \" * (17 - s) }]{% else %}{ \"{:^20}\".format(\"Stand \" ~ printer[\"gcode_macro _RF_INFO\"].stand) }{% endif %}\n\n################################################################################\n# Meldung fuer den Firmware Updater (auch ohne LED, z. B. RF1000)\n#   RF_DISPLAY_SIGNAL MODE=SELECT DURATION=30    Drucker wurde ausgewaehlt\n#   RF_DISPLAY_SIGNAL MODE=UPDATE DURATION=3600  Update laeuft\n#   RF_DISPLAY_SIGNAL MODE=DONE DURATION=15      Update fertig\n#   RF_DISPLAY_SIGNAL MODE=OFF                   zurueck zu Seite 1\n# Blinkender Rahmen aus Blockzeichen. Ist gerade das Menue offen, erscheint\n# die Meldung, sobald es geschlossen wird.\n################################################################################\n\n[gcode_macro _RF_SIGNAL]\n# 0 = keine, 1 = Auswahl, 2 = Update laeuft, 3 = Update fertig\nvariable_mode: 0\nvariable_until: 0.0\nvariable_cols: 20\ngcode:\n    # Nur Variablen fuer die Meldung\n\n[gcode_macro RF_DISPLAY_SIGNAL]\ndescription: Display-Meldung: MODE=SELECT|UPDATE|DONE|OFF DURATION=Sekunden\ngcode:\n    {% set modes = {\"SELECT\": 1, \"UPDATE\": 2, \"DONE\": 3} %}\n    {% set m = modes[params.MODE|default(\"SELECT\")|upper]|default(0) %}\n    {% if m %}\n      {% set dur = params.DURATION|default(30)|float %}\n      SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=mode VALUE={m}\n      SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=until VALUE={printer.toolhead.estimated_print_time|float + dur}\n      UPDATE_DELAYED_GCODE ID=_RF_SIGNAL_END DURATION={dur}\n      SET_DISPLAY_GROUP GROUP=rf_signal\n    {% elif printer[\"gcode_macro _RF_SIGNAL\"].mode %}\n      UPDATE_DELAYED_GCODE ID=_RF_SIGNAL_END DURATION=0\n      SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=mode VALUE=0\n      SET_DISPLAY_GROUP GROUP=rf_page1\n    {% endif %}\n\n[delayed_gcode _RF_SIGNAL_END]\ngcode:\n    SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=mode VALUE=0\n    SET_DISPLAY_GROUP GROUP=rf_page1\n\n# Zeile 1 und 4: Rahmen aus Bloecken, blinkt im Sekundentakt (fertig: steht).\n# Unten bei der Auswahl mittig die restlichen Sekunden.\n[display_template _rf_sig_frame]\nparam_bottom: False\ntext:\n  {% set v = printer[\"gcode_macro _RF_SIGNAL\"] %}\n  {% set now = printer.toolhead.estimated_print_time|float %}\n  {% set b = \"~rf_full~\" if v.mode == 3 or (now|int) % 2 == 0 else \" \" %}\n  {% set t = (\" %ds \" % ([v.until - now, 0]|max)) if param_bottom and v.mode == 1 else \"\" %}\n  {% set l = (v.cols - t|length) // 2 %}\n  { b * l }{ t }{ b * (v.cols - l - t|length) }\n\n# Zeile 2 und 3: Text mit Rahmen links und rechts\n[display_template _rf_sig_text]\nparam_row: 1\ntext:\n  {% set v = printer[\"gcode_macro _RF_SIGNAL\"] %}\n  {% set w = v.cols - 2 %}\n  {% set now = printer.toolhead.estimated_print_time|float %}\n  {% set b = \"~rf_full~\" if v.mode == 3 or (now|int) % 2 == 0 else \" \" %}\n  {% set head = \"FIRMWARE-UPDATE\" if w >= 15 else \"FW-UPDATE\" %}\n  {% set texts = {1: [head, \"DIESER DRUCKER\"], 2: [\"UPDATE LAEUFT\", \"NICHT AUSSCHALTEN\" if w >= 17 else \"NICHT AUS!\"], 3: [head, \"ERFOLGREICH\"]} %}\n  {% set t = texts[v.mode]|default([\"\", \"\"]) %}\n  { b }{ t[param_row - 1]|center(w) }{ b }\n\n[display_data rf_signal top]\nposition: 0, 0\ntext: { render(\"_rf_sig_frame\") }\n\n[display_data rf_signal line1]\nposition: 1, 0\ntext: { render(\"_rf_sig_text\", param_row=1) }\n\n[display_data rf_signal line2]\nposition: 2, 0\ntext: { render(\"_rf_sig_text\", param_row=2) }\n\n[display_data rf_signal bottom]\nposition: 3, 0\ntext: { render(\"_rf_sig_frame\", param_bottom=True) }\n\n################################################################################\n# Startseiten (wie UI_PAGE4 in uimenu.h)\n################################################################################\n\n# Statuszeile: Meldung (M117) oder Zustand\n[display_template _rf_status]\ntext:\n  {% set ps = printer.print_stats.state %}\n  {% if printer.display_status.message %}{ printer.display_status.message }\n  {% elif ps == \"printing\" %}{ \"Druck %3d%%\" % (printer.display_status.progress * 100) }\n  {% elif ps == \"paused\" %}Pause\n  {% else %}Drucker bereit.{% endif %}\n\n# Z-Zeile (Repetier \"Z%hZ%x2%x5 %sC\"): Z:<Position> <Ausgleich durch Mesh/Offset>\n# Kmp = Kompensation (Bettnetz) aktiv; ? statt : = nicht referenziert\n[display_template _rf_z]\ntext:\n  {% set th = printer.toolhead %}{% set gz = printer.gcode_move.gcode_position.z %}\n  { \"Z%s%6.2f %6.2f%s\" % (\":\" if \"z\" in th.homed_axes else \"?\", gz, th.position.z - gz, \" Kmp\" if printer.bed_mesh.profile_name else \"\") }\n\n# Seite 1 (ui_page1): Temperaturen, Z, Kraft und Luefter, Status\n[display_data rf_page1 temps]\nposition: 0, 0\ntext:\n  {% set e = printer[printer.toolhead.extruder] %}{% set b = printer.heater_bed %}\n  ~extruder~{ \"%3.0f/%3.0f\" % (e.temperature, e.target) }~degrees~{ \" B%3.0f/%3.0f\" % (b.temperature, b.target) }~degrees~\n\n[display_data rf_page1 z]\nposition: 1, 0\ntext: { render(\"_rf_z\")|trim }\n\n[display_data rf_page1 force]\nposition: 2, 0\ntext: { \"P: %5d L: %5.1f%%\" % (printer[\"rf1000_load_cell_probe\"].last_force, printer.fan.speed * 100) }\n\n[display_data rf_page1 status]\nposition: 3, 0\ntext: { render(\"_rf_status\")|trim }\n\n# Seite 2 (ui_page_mod): Kraft und Geschwindigkeit, Z-Offset, Sense Offset, Z\n[display_data rf_page_mod force]\nposition: 0, 0\ntext: { \"P:%6d     V: %3d%%\" % (printer[\"rf1000_load_cell_probe\"].last_force, printer.gcode_move.speed_factor * 100) }\n\n[display_data rf_page_mod zoffset]\nposition: 1, 0\ntext: { \"zO:%5d um zMat: %s\" % (printer.gcode_move.homing_origin.z * 1000, \"An\" if printer.bed_mesh.profile_name else \"Aus\") }\n\n[display_data rf_page_mod sense]\nposition: 2, 0\ntext:\n  {% set so = printer.z_sense_offset %}\n  { \"sO:%4d um \" % (so.z_offset * 1000) }{ (\"%s%5d\" % (\"@\" if so.enabled else \"^\", so.force_threshold)) if so.enabled or so.z_offset > 0 else \"Aus\" }\n\n[display_data rf_page_mod z]\nposition: 3, 0\ntext: { render(\"_rf_z\")|trim }\n\n# Seite 3 (ui_page2): Positionen und Vorschub\n[display_data rf_page2 x]\nposition: 0, 0\ntext: { \"X%s%7.2f mm\" % (\":\" if \"x\" in printer.toolhead.homed_axes else \"?\", printer.gcode_move.gcode_position.x) }\n\n[display_data rf_page2 y]\nposition: 1, 0\ntext: { \"Y%s%7.2f mm\" % (\":\" if \"y\" in printer.toolhead.homed_axes else \"?\", printer.gcode_move.gcode_position.y) }\n\n[display_data rf_page2 z]\nposition: 2, 0\ntext: { render(\"_rf_z\")|trim }\n\n[display_data rf_page2 speed]\nposition: 3, 0\ntext: { \"F:%3d %3d%% %5.1fmm/s\" % (printer.gcode_move.speed / 60, printer.gcode_move.speed_factor * 100, printer.motion_report.live_velocity) }\n\n# Seite 4 (ui_page3): Heizungen mit Leistung\n[display_data rf_page3 e0]\nposition: 0, 0\ntext: { \"E0:%3.0f/%3.0f\" % (printer.extruder.temperature, printer.extruder.target) }~degrees~{ \"C->%3d%%\" % (printer.extruder.power * 100) }\n\n[display_data rf_page3 e1]\nposition: 1, 0\ntext:\n  {% if 'extruder1' in printer %}{ \"E1:%3.0f/%3.0f\" % (printer.extruder1.temperature, printer.extruder1.target) }~degrees~{ \"C->%3d%%\" % (printer.extruder1.power * 100) }{% endif %}\n\n[display_data rf_page3 bed]\nposition: 2, 0\ntext: { \"B: %3.0f/%3.0f\" % (printer.heater_bed.temperature, printer.heater_bed.target) }~degrees~{ \"C->%3d%%\" % (printer.heater_bed.power * 100) }\n\n[display_data rf_page3 status]\nposition: 3, 0\ntext: { render(\"_rf_status\")|trim }\n\n# Seite 5 (ui_page4): aktueller Druck\n[display_data rf_page4 file]\nposition: 0, 0\ntext: { (printer.print_stats.filename or \"Kein Druck\")[:20] }\n\n[display_data rf_page4 time]\nposition: 1, 0\ntext:\n  {% set t = printer.print_stats.print_duration|int %}\n  { \"Druckzeit %3d:%02d:%02d\" % (t // 3600, (t // 60) % 60, t % 60) }\n\n[display_data rf_page4 filament]\nposition: 2, 0\ntext: { \"Filament %8.2f m\" % (printer.print_stats.filament_used / 1000) }\n\n[display_data rf_page4 layer]\nposition: 3, 0\ntext:\n  {% set i = printer.print_stats.info %}\n  { \"Layer %s/%s\" % (i.current_layer if i.current_layer is not none else \"-\", i.total_layer if i.total_layer is not none else \"-\") }\n\n################################################################################\n# Menue (wie UI_MENU in uimenu.h, deutsche Texte aus uilang.h)\n################################################################################\n\n[menu rf]\ntype: list\nname: Hauptmenü\n\n# ---------------------------- Schnelleinstellung ----------------------------\n[menu rf quick]\ntype: list\nname: Schnelleinstellung\n\n[menu rf quick stop]\ntype: list\nenable: {printer.print_stats.state in [\"printing\", \"paused\"]}\nname: Druck abbrechen\n\n[menu rf quick stop yes]\ntype: command\nname: Ja, abbrechen\ngcode:\n    CANCEL_PRINT\n    {menu.exit()}\n\n[menu rf quick stop no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n[menu rf quick home]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Home alle\ngcode: G28\n\n[menu rf quick motors]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Motoren ausschalten\ngcode: M84\n\n[menu rf quick output]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Objekt ausgeben\ngcode: _RF_OUTPUT_OBJECT\n\n[menu rf quick speed]\ntype: input\nname: Geschw. Mul.:{'%3d' % menu.input}%\ninput: {printer.gcode_move.speed_factor * 100}\ninput_min: 10\ninput_max: 300\ninput_step: 1\nrealtime: True\ngcode: M220 S{menu.input|int}\n\n[menu rf quick flow]\ntype: input\nname: Fluss Mul.  :{'%3d' % menu.input}%\ninput: {printer.gcode_move.extrude_factor * 100}\ninput_min: 10\ninput_max: 200\ninput_step: 1\nrealtime: True\ngcode: M221 S{menu.input|int}\n\n[menu rf quick park]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Heizbett parken\ngcode: _RF_PARK\n\n[menu rf quick light]\ntype: input\nenable: {'led led' in printer}\nname: X19 Licht: {'An' if menu.input else 'Aus'}\ninput: {1 if 'led led' in printer and printer[\"led led\"].color_data[0][0:3]|sum > 0 else 0}\ninput_min: 0\ninput_max: 1\ninput_step: 1\nrealtime: True\ngcode: RF_LIGHT S={menu.input|int}\n\n[menu rf quick reset]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Neustart\n\n[menu rf quick reset yes]\ntype: command\nname: Ja, neu starten\ngcode: FIRMWARE_RESTART\n\n[menu rf quick reset no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n# --------------------------------- Position ---------------------------------\n[menu rf pos]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Position\n\n[menu rf pos home]\ntype: command\nname: Home alle\ngcode: G28\n\n[menu rf pos homex]\ntype: command\nname: Home X {'*' if 'x' in printer.toolhead.homed_axes else ''}\ngcode: G28 X\n\n[menu rf pos homey]\ntype: command\nname: Home Y {'*' if 'y' in printer.toolhead.homed_axes else ''}\ngcode: G28 Y\n\n[menu rf pos homez]\ntype: command\nname: Home Z {'*' if 'z' in printer.toolhead.homed_axes else ''}\ngcode: G28 Z\n\n[menu rf pos x]\ntype: input\nenable: {'x' in printer.toolhead.homed_axes}\nname: Position X:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.x}\ninput_min: {printer.toolhead.axis_minimum.x}\ninput_max: {printer.toolhead.axis_maximum.x}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=X POS={menu.input} F=3000\n\n[menu rf pos y]\ntype: input\nenable: {'y' in printer.toolhead.homed_axes}\nname: Position Y:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.y}\ninput_min: {printer.toolhead.axis_minimum.y}\ninput_max: {printer.toolhead.axis_maximum.y}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=Y POS={menu.input} F=3000\n\n[menu rf pos z]\ntype: input\nenable: {'z' in printer.toolhead.homed_axes}\nname: Position Z:{'%7.2f' % menu.input}\ninput: {printer.gcode_move.gcode_position.z}\ninput_min: 0\ninput_max: {printer.toolhead.axis_maximum.z - 1}\ninput_step: 0.1\nrealtime: True\ngcode: _RF_MOVE AXIS=Z POS={menu.input} F=600\n\n[menu rf pos e]\ntype: input\nname: Position E:{'%+4.0f' % menu.input} mm\ninput: 0\ninput_min: -50\ninput_max: 50\ninput_step: 5\ngcode:\n    SAVE_GCODE_STATE NAME=_rf_e\n    M83\n    G1 E{menu.input} F240\n    RESTORE_GCODE_STATE NAME=_rf_e\n\n# ------------------------------ Pause Position ------------------------------\n[menu rf pausepos]\ntype: list\nenable: {printer.print_stats.state == \"paused\"}\nname: Pause Position\n\n[menu rf pausepos x]\ntype: input\nname: Position X:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.x}\ninput_min: {printer.toolhead.axis_minimum.x}\ninput_max: {printer.toolhead.axis_maximum.x}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=X POS={menu.input} F=3000\n\n[menu rf pausepos y]\ntype: input\nname: Position Y:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.y}\ninput_min: {printer.toolhead.axis_minimum.y}\ninput_max: {printer.toolhead.axis_maximum.y}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=Y POS={menu.input} F=3000\n\n[menu rf pausepos z]\ntype: input\nname: Position Z:{'%7.2f' % menu.input}\ninput: {printer.gcode_move.gcode_position.z}\ninput_min: {printer.gcode_move.gcode_position.z}\ninput_max: {printer.toolhead.axis_maximum.z - 1}\ninput_step: 0.5\nrealtime: True\ngcode: _RF_MOVE AXIS=Z POS={menu.input} F=600\n\n# --------------------------------- Extruder ---------------------------------\n[menu rf ext]\ntype: list\nname: Extruder\n\n[menu rf ext bed]\ntype: input\nname: Temp. Bed:{'%3d' % menu.input}~degrees~C~extruder~{'%3.0f' % printer.heater_bed.temperature}\ninput: {printer.heater_bed.target}\ninput_min: 0\ninput_max: {printer.configfile.settings.heater_bed.max_temp - 10}\ninput_step: 5\ngcode: M140 S{menu.input|int}\n\n[menu rf ext t0]\ntype: input\nname: Temp. E0 :{'%3d' % menu.input}~degrees~C~extruder~{'%3.0f' % printer.extruder.temperature}\ninput: {printer.extruder.target}\ninput_min: 0\ninput_max: {printer.configfile.settings.extruder.max_temp - 10}\ninput_step: 5\ngcode: M104 T0 S{menu.input|int}\n\n[menu rf ext t1]\ntype: input\nenable: {'extruder1' in printer}\nname: Temp. E1 :{'%3d' % menu.input}~degrees~C~extruder~{'%3.0f' % (printer.extruder1.temperature if 'extruder1' in printer else 0)}\ninput: {printer.extruder1.target if 'extruder1' in printer else 0}\ninput_min: 0\ninput_max: {printer.configfile.settings.extruder1.max_temp - 10 if 'extruder1' in printer else 250}\ninput_step: 5\ngcode: M104 T1 S{menu.input|int}\n\n[menu rf ext off0]\ntype: command\nname: Extruder 0 aus\ngcode: M104 T0 S0\n\n[menu rf ext off1]\ntype: command\nenable: {'extruder1' in printer}\nname: Extruder 1 aus\ngcode: M104 T1 S0\n\n[menu rf ext offbed]\ntype: command\nname: Heizbett aus\ngcode: M140 S0\n\n[menu rf ext active]\ntype: input\nenable: {'extruder1' in printer and printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Aktiver Extruder:{'%d' % menu.input}\ninput: {1 if printer.toolhead.extruder == \"extruder1\" else 0}\ninput_min: 0\ninput_max: 1\ninput_step: 1\ngcode: T{menu.input|int}\n\n[menu rf ext pla]\ntype: command\nname: Vorheizen PLA\ngcode: _RF_PREHEAT MATERIAL=PLA\n\n[menu rf ext abs]\ntype: command\nname: Vorheizen ABS\ngcode: _RF_PREHEAT MATERIAL=ABS\n\n[menu rf ext cool]\ntype: command\nname: Abkühlen\ngcode: _RF_COOLDOWN\n\n[menu rf ext load]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Filament laden\ngcode: _RF_FILAMENT DIR=1\n\n[menu rf ext unload]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Filament entladen\ngcode: _RF_FILAMENT DIR=-1\n\n[menu rf ext flow]\ntype: input\nname: Fluss Mul.  :{'%3d' % menu.input}%\ninput: {printer.gcode_move.extrude_factor * 100}\ninput_min: 10\ninput_max: 200\ninput_step: 1\nrealtime: True\ngcode: M221 S{menu.input|int}\n\n[menu rf ext eorigin]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Setze E Ursprung\ngcode: G92 E0\n\n# ---------------------------------- Luefter ---------------------------------\n[menu rf fan]\ntype: list\nname: Lüfter\n\n[menu rf fan speed]\ntype: input\nname: Lüfter: {'%3d' % menu.input}%\ninput: {printer.fan.speed * 100}\ninput_min: 0\ninput_max: 100\ninput_step: 5\nrealtime: True\ngcode: M106 S{(menu.input * 2.55)|int}\n\n[menu rf fan off]\ntype: command\nname: Lüfter aus\ngcode: M107\n\n[menu rf fan p25]\ntype: command\nname: Lüfter auf  25%\ngcode: M106 S64\n\n[menu rf fan p50]\ntype: command\nname: Lüfter auf  50%\ngcode: M106 S128\n\n[menu rf fan p75]\ntype: command\nname: Lüfter auf  75%\ngcode: M106 S191\n\n[menu rf fan p100]\ntype: command\nname: Lüfter auf 100%\ngcode: M106 S255\n\n# --------------------------------- SD Karte ---------------------------------\n[menu rf sd]\ntype: list\nname: SD Karte\n\n[menu rf sd files]\n# Dateien aus dem G-Code-Ordner des Raspberry Pi (wie in Mainsail unter G-Code-Dateien).\n# Steckt eine SD-Karte im Drucker ([rf_sdcard]), steht oben der Eintrag \"SD-Karte\" mit\n# deren Dateien. Antippen startet den Druck sofort, wie in der RF-Firmware (braucht\n# den Klipper-Fork); Dateien von der Karte werden dafuer zuerst auf den Pi kopiert.\ntype: vsdlist\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Drucke Datei\nstart_print: True\nempty_text: Keine Dateien\ncard_text: SD-Karte\n\n[menu rf sd pause]\ntype: command\nenable: {printer.print_stats.state == \"printing\"}\nname: Druck pausieren\ngcode: PAUSE\n\n[menu rf sd resume]\ntype: command\nenable: {printer.print_stats.state == \"paused\"}\nname: Druck fortsetzen\ngcode: RESUME\n\n[menu rf sd stop]\ntype: list\nenable: {printer.print_stats.state in [\"printing\", \"paused\"]}\nname: Druck abbrechen\n\n[menu rf sd stop yes]\ntype: command\nname: Ja, abbrechen\ngcode:\n    CANCEL_PRINT\n    {menu.exit()}\n\n[menu rf sd stop no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n# ------------------------------- Konfiguration ------------------------------\n[menu rf conf]\ntype: list\nname: Konfiguration\n\n# Z Kalibrierung\n[menu rf conf z]\ntype: list\nname: Z Kalibrierung\n\n[menu rf conf z scan]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Matrix Scan\ngcode: _RF_MATRIX_SCAN\n\n[menu rf conf z scanpla]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Matrix Scan PLA\ngcode: _RF_MATRIX_SCAN BED=60\n\n[menu rf conf z scanabs]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Matrix Scan ABS\ngcode: _RF_MATRIX_SCAN BED=100\n\n[menu rf conf z offsetscan]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Z-Offset-Scan\ngcode: _RF_Z_OFFSET_SCAN\n\n[menu rf conf z offset]\ntype: input\nname: Z Abstand:{'%7.3f' % menu.input}\ninput: {printer.gcode_move.homing_origin.z}\ninput_min: -2\ninput_max: 2\ninput_step: 0.01\nrealtime: True\ngcode: SET_GCODE_OFFSET Z={'%.3f' % menu.input}\n\n# DMS Features\n[menu rf conf dms]\ntype: list\nname: DMS Features\n\n[menu rf conf dms sense]\ntype: list\nname: SenseOffset\n\n[menu rf conf dms sense level]\ntype: input\nname: Level:{'%6d' % menu.input} digits\ninput: {printer.z_sense_offset.force_threshold}\ninput_min: 50\ninput_max: 20000\ninput_step: 50\ngcode:\n    SET_Z_SENSE_OFFSET FORCE_THRESHOLD={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_sense_threshold VALUE={menu.input|int}\n\n[menu rf conf dms sense max]\ntype: input\nname: Max: {'%3d' % menu.input} um\ninput: {printer.z_sense_offset.max_z_offset * 1000}\ninput_min: 0\ninput_max: 500\ninput_step: 10\ngcode:\n    SET_Z_SENSE_OFFSET MAX_Z_OFFSET={'%.3f' % (menu.input / 1000)}\n    SAVE_VARIABLE VARIABLE=rf_sense_max VALUE={'%.3f' % (menu.input / 1000)}\n\n[menu rf conf dms sense auto]\ntype: input\nname: AutoStart: {'An' if menu.input else 'Aus'}\ninput: {printer.save_variables.variables.rf_sense_autostart|default(1)}\ninput_min: 0\ninput_max: 1\ninput_step: 1\ngcode: SAVE_VARIABLE VARIABLE=rf_sense_autostart VALUE={menu.input|int}\n\n[menu rf conf dms pause]\ntype: list\nenable: {'rf1000_pressure_guard' in printer}\nname: Notfall Pause\n\n[menu rf conf dms pause min]\ntype: input\nname: Min:{'%6d' % menu.input} digits\ninput: {printer.rf1000_pressure_guard.emergency_min}\ninput_min: -20000\ninput_max: 0\ninput_step: 100\ngcode:\n    RF_EMERGENCY_PAUSE MIN={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_pause_min VALUE={menu.input|int}\n\n[menu rf conf dms pause max]\ntype: input\nname: Max:{'%6d' % menu.input} digits\ninput: {printer.rf1000_pressure_guard.emergency_max}\ninput_min: 0\ninput_max: 20000\ninput_step: 100\ngcode:\n    RF_EMERGENCY_PAUSE MAX={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_pause_max VALUE={menu.input|int}\n\n[menu rf conf dms flow]\ntype: list\nenable: {'rf1000_pressure_guard' in printer}\nname: Digit Flow CMP\n\n[menu rf conf dms flow min]\ntype: input\nname: Digit Min:{'%5d' % menu.input}\ninput: {printer.rf1000_pressure_guard.flow_min}\ninput_min: 0\ninput_max: 20000\ninput_step: 50\ngcode:\n    RF_FLOW_COMP MIN={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_flow_min VALUE={menu.input|int}\n\n[menu rf conf dms flow max]\ntype: input\nname: Digit Max:{'%5d' % menu.input}\ninput: {printer.rf1000_pressure_guard.flow_max}\ninput_min: 0\ninput_max: 20000\ninput_step: 50\ngcode:\n    RF_FLOW_COMP MAX={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_flow_max VALUE={menu.input|int}\n\n[menu rf conf dms flow df]\ntype: input\nname: dFlow:   :{'%+4d' % menu.input}%\ninput: {printer.rf1000_pressure_guard.flow_percent}\ninput_min: -99\ninput_max: 99\ninput_step: 1\ngcode:\n    RF_FLOW_COMP FLOW={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_flow_percent VALUE={menu.input|int}\n\n[menu rf conf dms flow dv]\ntype: input\nname: dFeed:   :{'%+4d' % menu.input}%\ninput: {printer.rf1000_pressure_guard.feed_percent}\ninput_min: -90\ninput_max: 99\ninput_step: 1\ngcode:\n    RF_FLOW_COMP FEED={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_feed_percent VALUE={menu.input|int}\n\n# Temperaturen: PID-Autotune\n[menu rf conf pid]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Temperatures\n\n[menu rf conf pid e0]\ntype: list\nname: Extruder 0\n\n[menu rf conf pid e0 yes]\ntype: command\nname: PID starten\ngcode:\n    PID_TUNING_HOTEND_1\n    {menu.exit()}\n\n[menu rf conf pid e1]\ntype: list\nenable: {'extruder1' in printer}\nname: Extruder 1\n\n[menu rf conf pid e1 yes]\ntype: command\nname: PID starten\ngcode:\n    PID_TUNING_HOTEND_2\n    {menu.exit()}\n\n[menu rf conf pid bed]\ntype: list\nname: Heizbett\n\n[menu rf conf pid bed yes]\ntype: command\nname: PID starten\ngcode:\n    PID_TUNING_BED\n    {menu.exit()}\n\n# Beschleunigung und Feedrate\n[menu rf conf accel]\ntype: list\nname: Beschleunigung\n\n[menu rf conf accel xy]\ntype: input\nname: Accel:{'%5d' % menu.input}\ninput: {printer.toolhead.max_accel}\ninput_min: 100\ninput_max: 10000\ninput_step: 100\ngcode:\n    SET_VELOCITY_LIMIT ACCEL={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_accel VALUE={menu.input|int}\n\n[menu rf conf feed]\ntype: list\nname: Feedrate\n\n[menu rf conf feed max]\ntype: input\nname: Max v:{'%4d' % menu.input}mm/s\ninput: {printer.toolhead.max_velocity}\ninput_min: 10\ninput_max: 500\ninput_step: 5\ngcode:\n    SET_VELOCITY_LIMIT VELOCITY={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_velocity VALUE={menu.input|int}\n\n# Werkseinstellungen\n[menu rf conf defaults]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Werkseinstellungen\n\n[menu rf conf defaults yes]\ntype: command\nname: Ja, zurücksetzen\ngcode:\n    _RF_FACTORY_RESET\n    {menu.exit()}\n\n[menu rf conf defaults no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n################################################################################\n# Hilfsmakros fuer das Menue\n################################################################################\n\n# Gespeicherte Menue-Einstellungen beim Start uebernehmen\n[delayed_gcode _RF_LOAD_SETTINGS]\ninitial_duration: 1\ngcode:\n    {% set v = printer.save_variables.variables %}\n    {% if 'rf_sense_threshold' in v or 'rf_sense_max' in v %}\n    SET_Z_SENSE_OFFSET FORCE_THRESHOLD={v.rf_sense_threshold|default(printer.z_sense_offset.force_threshold)|int} MAX_Z_OFFSET={v.rf_sense_max|default(printer.z_sense_offset.max_z_offset)}\n    {% endif %}\n    {% if 'rf1000_pressure_guard' in printer %}\n    {% set pg = printer.rf1000_pressure_guard %}\n    {% if 'rf_pause_min' in v or 'rf_pause_max' in v %}\n    RF_EMERGENCY_PAUSE MIN={v.rf_pause_min|default(pg.emergency_min)} MAX={v.rf_pause_max|default(pg.emergency_max)}\n    {% endif %}\n    {% if 'rf_flow_min' in v or 'rf_flow_max' in v or 'rf_flow_percent' in v or 'rf_feed_percent' in v %}\n    RF_FLOW_COMP MIN={v.rf_flow_min|default(pg.flow_min)} MAX={v.rf_flow_max|default(pg.flow_max)} FLOW={v.rf_flow_percent|default(pg.flow_percent)} FEED={v.rf_feed_percent|default(pg.feed_percent)}\n    {% endif %}\n    {% endif %}\n    {% if 'rf_accel' in v %}\n    SET_VELOCITY_LIMIT ACCEL={v.rf_accel}\n    {% endif %}\n    {% if 'rf_velocity' in v %}\n    SET_VELOCITY_LIMIT VELOCITY={v.rf_velocity}\n    {% endif %}\n\n# Werte aus der printer.cfg wiederherstellen und speichern\n[gcode_macro _RF_FACTORY_RESET]\ngcode:\n    {% set c = printer.configfile.settings %}\n    SET_Z_SENSE_OFFSET FORCE_THRESHOLD={c.z_sense_offset.force_threshold} MAX_Z_OFFSET={c.z_sense_offset.max_z_offset}\n    SAVE_VARIABLE VARIABLE=rf_sense_threshold VALUE={c.z_sense_offset.force_threshold}\n    SAVE_VARIABLE VARIABLE=rf_sense_max VALUE={c.z_sense_offset.max_z_offset}\n    SAVE_VARIABLE VARIABLE=rf_sense_autostart VALUE=1\n    {% if 'rf1000_pressure_guard' in c %}\n    {% set g = c.rf1000_pressure_guard %}\n    RF_EMERGENCY_PAUSE MIN={g.emergency_min} MAX={g.emergency_max}\n    RF_FLOW_COMP MIN={g.flow_min} MAX={g.flow_max} FLOW={g.flow_percent} FEED={g.feed_percent}\n    SAVE_VARIABLE VARIABLE=rf_pause_min VALUE={g.emergency_min}\n    SAVE_VARIABLE VARIABLE=rf_pause_max VALUE={g.emergency_max}\n    SAVE_VARIABLE VARIABLE=rf_flow_min VALUE={g.flow_min}\n    SAVE_VARIABLE VARIABLE=rf_flow_max VALUE={g.flow_max}\n    SAVE_VARIABLE VARIABLE=rf_flow_percent VALUE={g.flow_percent}\n    SAVE_VARIABLE VARIABLE=rf_feed_percent VALUE={g.feed_percent}\n    {% endif %}\n    SET_VELOCITY_LIMIT ACCEL={c.printer.max_accel} VELOCITY={c.printer.max_velocity}\n    SAVE_VARIABLE VARIABLE=rf_accel VALUE={c.printer.max_accel}\n    SAVE_VARIABLE VARIABLE=rf_velocity VALUE={c.printer.max_velocity}\n    M117 Werkseinstellungen\n\n# Achse absolut fahren (fuer die Positionsmenues)\n[gcode_macro _RF_MOVE]\ngcode:\n    SAVE_GCODE_STATE NAME=_rf_move\n    G90\n    G1 {params.AXIS}{params.POS} F{params.F|default(3000)}\n    RESTORE_GCODE_STATE NAME=_rf_move\n\n# Objekt ausgeben (Repetier OUTPUT_OBJECT_SCRIPT_PRINT): zurueckziehen, Bett nach\n# unten (Z max - 5 = 185 mm wie PRINT_END) und nach vorne bis position_max, Motoren aus\n[gcode_macro _RF_OUTPUT_OBJECT]\ngcode:\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    RESPOND TYPE=error MSG=\"Objekt ausgeben: Zuerst alle Achsen referenzieren.\"\n    {% else %}\n    {% set th = printer.toolhead %}\n    {% if printer[th.extruder].temperature >= printer.configfile.settings[th.extruder].min_extrude_temp %}\n    M83\n    G1 E-1 F1800\n    {% endif %}\n    G90\n    G1 Z{th.axis_maximum.z - 5} F540\n    G1 Y{th.axis_maximum.y} F4800\n    M400\n    M84\n    M117 Objekt ausgegeben\n    {% endif %}\n\n# Heizbett parken (Repetier PARK_POSITION X0 Y120 Z175)\n[gcode_macro _RF_PARK]\ngcode:\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    G28\n    {% endif %}\n    G90\n    G1 Z{[175, printer.toolhead.axis_maximum.z - 1]|min} F600\n    G1 X0 Y120 F4800\n    M117 Heizbett geparkt\n\n# Vorheizen wie Repetier (PLA 180/60, ABS 210/100) fuer den aktiven Extruder\n[gcode_macro _RF_PREHEAT]\ngcode:\n    {% if params.MATERIAL|default(\"PLA\")|upper == \"ABS\" %}\n    {% set e, b = 210, 100 %}\n    {% else %}\n    {% set e, b = 180, 60 %}\n    {% endif %}\n    M104 S{e}\n    M140 S{b}\n\n[gcode_macro _RF_COOLDOWN]\ngcode:\n    TURN_OFF_HEATERS\n    M107\n\n# Filament laden/entladen wie Repetier \"Durchdruecken\"/\"Oldstyle pull\":\n# laden bei 210 Grad 90 mm langsam, entladen bei 180 Grad 90 mm zurueck.\n# In zwei Schritten, weil max_extrude_only_distance 50 mm ist.\n[gcode_macro _RF_FILAMENT]\ngcode:\n    {% set dir = params.DIR|default(1)|int %}\n    {% set temp = 210 if dir > 0 else 180 %}\n    {% set feed = 100 if dir > 0 else 500 %}\n    M117 Heize auf {temp}...\n    M109 S{temp}\n    SAVE_GCODE_STATE NAME=_rf_fil\n    M83\n    G1 E{45 * dir} F{feed}\n    G1 E{45 * dir} F{feed}\n    RESTORE_GCODE_STATE NAME=_rf_fil\n    M104 S0\n    M117 Filament {'geladen' if dir > 0 else 'entladen'}\n\n# Matrix Scan: referenzieren, optional Bett heizen, dann BED_CALIBRATE\n# (misst Z, erstellt das Bettnetz und speichert mit SAVE_CONFIG)\n[gcode_macro _RF_MATRIX_SCAN]\ngcode:\n    {% if params.BED is defined %}\n    M117 Heize Bett auf {params.BED}...\n    M190 S{params.BED|int}\n    {% endif %}\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    G28\n    {% endif %}\n    M117 Matrix Scan...\n    BED_CALIBRATE\n\n# Z-Offset-Scan in der Bettmitte\n[gcode_macro _RF_Z_OFFSET_SCAN]\ngcode:\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    G28\n    {% endif %}\n    G90\n    G0 Z10 F600\n    G0 X100 Y100 F4800\n    G0 Z2 F600\n    M117 Z-Offset-Scan...\n    Z_OFFSET_SCAN\n",
 "rf_display_rf1000": "################################################################################\n# Display und Menue wie in der RF-Repetier-Firmware (RF1000, 16x4)\n# Erzeugt aus der rf_display.cfg des RF2000 (tools/make_rf1000_display.py),\n# Aenderungen bitte dort machen.\n# Einbinden in printer.cfg mit [include rf_display.cfg]\n# Unter [display] dazu:\n#   display_group: rf_splash   (Startbild, danach rf_page1)\n#   menu_root: rf\n#   menu_pages: rf_page1, rf_page_mod, rf_page2, rf_page3, rf_page4\n#   menu_show_back: False\n#   hd44780_charset: a00\n#   line_length: 16\n# Braucht den Klipper-Fork Dennis02121978/klipper (Umlaute, Seitenwechsel,\n# SET_Z_SENSE_OFFSET). Ausserhalb des Menues blaettern hoch/runter die Seiten,\n# zurueck springt auf Seite 1, OK oeffnet das Menue.\n# Einstellungen aus dem Menue (DMS, Beschleunigung, Feedrate) werden wie im\n# EEPROM in rf_variables.cfg gespeichert und beim Start geladen.\n################################################################################\n\n# [save_variables] steht in der printer.cfg, damit jeder Drucker (auch mehrere an\n# einem Raspberry Pi) seine eigene rf_variables.cfg hat:\n#   [save_variables]\n#   filename: ~/printer_data/config/rf_variables.cfg\n\n################################################################################\n# Startbild beim Verbinden: 3D-Artmaker mit Version und Stand\n# Unter [display] dazu: display_group: rf_splash\n# Ablauf: Balken laeuft ca. 3 s, dann 3 s Version/Stand, dann Seite 1.\n################################################################################\n\n# Version und Stand der Config (bei einem neuen Release anpassen)\n[gcode_macro _RF_INFO]\nvariable_version: \"v1.6.2\"\nvariable_stand: \"12.11.2026\"\ngcode:\n    {% set i = printer[\"gcode_macro _RF_INFO\"] %}\n    RESPOND MSG=\"3D-Artmaker {i.version}, Stand {i.stand}\"\n\n[gcode_macro _RF_SPLASH]\nvariable_step: 0\ngcode:\n    # Nur Variable fuer das Startbild\n\n[delayed_gcode _RF_SPLASH_RUN]\ninitial_duration: 0.5\ngcode:\n    {% set s = printer[\"gcode_macro _RF_SPLASH\"].step %}\n    {% if s < 20 %}\n    SET_GCODE_VARIABLE MACRO=_RF_SPLASH VARIABLE=step VALUE={s + 2 if s < 14 else s + 1}\n    UPDATE_DELAYED_GCODE ID=_RF_SPLASH_RUN DURATION=0.5\n    {% else %}\n    SET_DISPLAY_GROUP GROUP=rf_page1\n    {% endif %}\n\n# Eigene Zeichen (5x8) nur fuer das Startbild. Die Plaetze werden beim\n# Zeichnen belegt, die Seiten danach nutzen ihre eigenen Zeichen wieder.\n# Isometrischer Wuerfel aus 2x2 Zeichen: Deckel als Umriss, links voll,\n# rechts schraffiert\n[display_glyph rf_cube_tl]\nhd44780_slot: 1\nhd44780_data:\n  .....\n  ....*\n  ..**.\n  **...\n  ****.\n  *****\n  *****\n  *****\n\n[display_glyph rf_cube_tr]\nhd44780_slot: 2\nhd44780_data:\n  .....\n  *....\n  .**..\n  ...**\n  .****\n  *.*.*\n  .*.**\n  *.*.*\n\n[display_glyph rf_cube_bl]\nhd44780_slot: 3\nhd44780_data:\n  *****\n  *****\n  *****\n  *****\n  *****\n  ..***\n  ....*\n  .....\n\n[display_glyph rf_cube_br]\nhd44780_slot: 4\nhd44780_data:\n  .*.**\n  *.*.*\n  .*.**\n  *.*.*\n  .*.**\n  ***..\n  *....\n  .....\n\n# Unterstrich unter dem Namen\n[display_glyph rf_line]\nhd44780_slot: 5\nhd44780_data:\n  *****\n  .....\n  .*.*.\n  .....\n  .....\n  .....\n  .....\n  .....\n\n# Fortschrittsbalken: voll und Spitze\n[display_glyph rf_full]\nhd44780_slot: 7\nhd44780_data:\n  *****\n  *****\n  *****\n  *****\n  *****\n  *****\n  *****\n  *****\n\n[display_glyph rf_shade]\nhd44780_slot: 6\nhd44780_data:\n  *.*.*\n  .*.*.\n  *.*.*\n  .*.*.\n  *.*.*\n  .*.*.\n  *.*.*\n  .*.*.\n\n[display_data rf_splash title]\nposition: 0, 0\ntext: ~rf_cube_tl~~rf_cube_tr~ 3D-Artmaker\n\n[display_data rf_splash line]\nposition: 1, 0\ntext: ~rf_cube_bl~~rf_cube_br~ ~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~~rf_line~\n\n[display_data rf_splash version]\nposition: 2, 0\ntext: { \"{:^16}\".format(\"Version \" ~ printer[\"gcode_macro _RF_INFO\"].version) }\n\n[display_data rf_splash bar]\nposition: 3, 0\ntext:\n  {% set s = printer[\"gcode_macro _RF_SPLASH\"].step %}\n  {% if s < 14 %}[{ \"~rf_full~\" * s }{ \"~rf_shade~\" }{ \" \" * (13 - s) }]{% else %}{ \"{:^16}\".format(\"Stand \" ~ printer[\"gcode_macro _RF_INFO\"].stand) }{% endif %}\n\n################################################################################\n# Meldung fuer den Firmware Updater (auch ohne LED, z. B. RF1000)\n#   RF_DISPLAY_SIGNAL MODE=SELECT DURATION=30    Drucker wurde ausgewaehlt\n#   RF_DISPLAY_SIGNAL MODE=UPDATE DURATION=3600  Update laeuft\n#   RF_DISPLAY_SIGNAL MODE=DONE DURATION=15      Update fertig\n#   RF_DISPLAY_SIGNAL MODE=OFF                   zurueck zu Seite 1\n# Blinkender Rahmen aus Blockzeichen. Ist gerade das Menue offen, erscheint\n# die Meldung, sobald es geschlossen wird.\n################################################################################\n\n[gcode_macro _RF_SIGNAL]\n# 0 = keine, 1 = Auswahl, 2 = Update laeuft, 3 = Update fertig\nvariable_mode: 0\nvariable_until: 0.0\nvariable_cols: 16\ngcode:\n    # Nur Variablen fuer die Meldung\n\n[gcode_macro RF_DISPLAY_SIGNAL]\ndescription: Display-Meldung: MODE=SELECT|UPDATE|DONE|OFF DURATION=Sekunden\ngcode:\n    {% set modes = {\"SELECT\": 1, \"UPDATE\": 2, \"DONE\": 3} %}\n    {% set m = modes[params.MODE|default(\"SELECT\")|upper]|default(0) %}\n    {% if m %}\n      {% set dur = params.DURATION|default(30)|float %}\n      SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=mode VALUE={m}\n      SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=until VALUE={printer.toolhead.estimated_print_time|float + dur}\n      UPDATE_DELAYED_GCODE ID=_RF_SIGNAL_END DURATION={dur}\n      SET_DISPLAY_GROUP GROUP=rf_signal\n    {% elif printer[\"gcode_macro _RF_SIGNAL\"].mode %}\n      UPDATE_DELAYED_GCODE ID=_RF_SIGNAL_END DURATION=0\n      SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=mode VALUE=0\n      SET_DISPLAY_GROUP GROUP=rf_page1\n    {% endif %}\n\n[delayed_gcode _RF_SIGNAL_END]\ngcode:\n    SET_GCODE_VARIABLE MACRO=_RF_SIGNAL VARIABLE=mode VALUE=0\n    SET_DISPLAY_GROUP GROUP=rf_page1\n\n# Zeile 1 und 4: Rahmen aus Bloecken, blinkt im Sekundentakt (fertig: steht).\n# Unten bei der Auswahl mittig die restlichen Sekunden.\n[display_template _rf_sig_frame]\nparam_bottom: False\ntext:\n  {% set v = printer[\"gcode_macro _RF_SIGNAL\"] %}\n  {% set now = printer.toolhead.estimated_print_time|float %}\n  {% set b = \"~rf_full~\" if v.mode == 3 or (now|int) % 2 == 0 else \" \" %}\n  {% set t = (\" %ds \" % ([v.until - now, 0]|max)) if param_bottom and v.mode == 1 else \"\" %}\n  {% set l = (v.cols - t|length) // 2 %}\n  { b * l }{ t }{ b * (v.cols - l - t|length) }\n\n# Zeile 2 und 3: Text mit Rahmen links und rechts\n[display_template _rf_sig_text]\nparam_row: 1\ntext:\n  {% set v = printer[\"gcode_macro _RF_SIGNAL\"] %}\n  {% set w = v.cols - 2 %}\n  {% set now = printer.toolhead.estimated_print_time|float %}\n  {% set b = \"~rf_full~\" if v.mode == 3 or (now|int) % 2 == 0 else \" \" %}\n  {% set head = \"FIRMWARE-UPDATE\" if w >= 15 else \"FW-UPDATE\" %}\n  {% set texts = {1: [head, \"DIESER DRUCKER\"], 2: [\"UPDATE LAEUFT\", \"NICHT AUSSCHALTEN\" if w >= 17 else \"NICHT AUS!\"], 3: [head, \"ERFOLGREICH\"]} %}\n  {% set t = texts[v.mode]|default([\"\", \"\"]) %}\n  { b }{ t[param_row - 1]|center(w) }{ b }\n\n[display_data rf_signal top]\nposition: 0, 0\ntext: { render(\"_rf_sig_frame\") }\n\n[display_data rf_signal line1]\nposition: 1, 0\ntext: { render(\"_rf_sig_text\", param_row=1) }\n\n[display_data rf_signal line2]\nposition: 2, 0\ntext: { render(\"_rf_sig_text\", param_row=2) }\n\n[display_data rf_signal bottom]\nposition: 3, 0\ntext: { render(\"_rf_sig_frame\", param_bottom=True) }\n\n################################################################################\n# Startseiten (wie UI_PAGE4 in uimenu.h)\n################################################################################\n\n# Statuszeile: Meldung (M117) oder Zustand\n[display_template _rf_status]\ntext:\n  {% set ps = printer.print_stats.state %}\n  {% if printer.display_status.message %}{ printer.display_status.message }\n  {% elif ps == \"printing\" %}{ \"Druck %3d%%\" % (printer.display_status.progress * 100) }\n  {% elif ps == \"paused\" %}Pause\n  {% else %}Drucker bereit.{% endif %}\n\n# Z-Zeile (Repetier \"Z%hZ%x2%x5 %sC\"): Z:<Position> <Ausgleich durch Mesh/Offset>\n# K = Kompensation (Bettnetz) aktiv; ? statt : = nicht referenziert\n[display_template _rf_z]\ntext:\n  {% set th = printer.toolhead %}{% set gz = printer.gcode_move.gcode_position.z %}\n  { \"Z%s%6.2f %6.2f%s\" % (\":\" if \"z\" in th.homed_axes else \"?\", gz, th.position.z - gz, \"K\" if printer.bed_mesh.profile_name else \"\") }\n\n# Seite 1 (ui_page1): Temperaturen, Z, Kraft und Luefter, Status\n[display_data rf_page1 temps]\nposition: 0, 0\ntext:\n  {% set e = printer[printer.toolhead.extruder] %}{% set b = printer.heater_bed %}\n  ~extruder~{ \"%3.0f/%3.0f\" % (e.temperature, e.target) }{ \"B%3.0f/%3.0f\" % (b.temperature, b.target) }\n\n[display_data rf_page1 z]\nposition: 1, 0\ntext: { render(\"_rf_z\")|trim }\n\n[display_data rf_page1 force]\nposition: 2, 0\ntext: { \"P: %5d L:%3d%%\" % (printer[\"rf1000_load_cell_probe\"].last_force, printer.fan.speed * 100) }\n\n[display_data rf_page1 status]\nposition: 3, 0\ntext: { render(\"_rf_status\")|trim }\n\n# Seite 2 (ui_page_mod): Kraft und Geschwindigkeit, Z-Offset, Sense Offset, Z\n[display_data rf_page_mod force]\nposition: 0, 0\ntext: { \"P:%6d  V:%3d%%\" % (printer[\"rf1000_load_cell_probe\"].last_force, printer.gcode_move.speed_factor * 100) }\n\n[display_data rf_page_mod zoffset]\nposition: 1, 0\ntext: { \"zO:%4dum zM:%s\" % (printer.gcode_move.homing_origin.z * 1000, \"An\" if printer.bed_mesh.profile_name else \"Aus\") }\n\n[display_data rf_page_mod sense]\nposition: 2, 0\ntext:\n  {% set so = printer.z_sense_offset %}\n  { \"sO:%4dum \" % (so.z_offset * 1000) }{ (\"%s%5d\" % (\"@\" if so.enabled else \"^\", so.force_threshold)) if so.enabled or so.z_offset > 0 else \"Aus\" }\n\n[display_data rf_page_mod z]\nposition: 3, 0\ntext: { render(\"_rf_z\")|trim }\n\n# Seite 3 (ui_page2): Positionen und Vorschub\n[display_data rf_page2 x]\nposition: 0, 0\ntext: { \"X%s%7.2f mm\" % (\":\" if \"x\" in printer.toolhead.homed_axes else \"?\", printer.gcode_move.gcode_position.x) }\n\n[display_data rf_page2 y]\nposition: 1, 0\ntext: { \"Y%s%7.2f mm\" % (\":\" if \"y\" in printer.toolhead.homed_axes else \"?\", printer.gcode_move.gcode_position.y) }\n\n[display_data rf_page2 z]\nposition: 2, 0\ntext: { render(\"_rf_z\")|trim }\n\n[display_data rf_page2 speed]\nposition: 3, 0\ntext: { \"F:%3d%% v:%3.0fmm/s\" % (printer.gcode_move.speed_factor * 100, printer.motion_report.live_velocity) }\n\n# Seite 4 (ui_page3): Heizungen mit Leistung\n[display_data rf_page3 e0]\nposition: 0, 0\ntext: { \"E0:%3.0f/%3.0f\" % (printer.extruder.temperature, printer.extruder.target) }~degrees~{ \"C>%3d\" % (printer.extruder.power * 100) }\n\n[display_data rf_page3 e1]\nposition: 1, 0\ntext:\n  {% if 'extruder1' in printer %}{ \"E1:%3.0f/%3.0f\" % (printer.extruder1.temperature, printer.extruder1.target) }~degrees~{ \"C>%3d\" % (printer.extruder1.power * 100) }{% endif %}\n\n[display_data rf_page3 bed]\nposition: 2, 0\ntext: { \"B: %3.0f/%3.0f\" % (printer.heater_bed.temperature, printer.heater_bed.target) }~degrees~{ \"C>%3d\" % (printer.heater_bed.power * 100) }\n\n[display_data rf_page3 status]\nposition: 3, 0\ntext: { render(\"_rf_status\")|trim }\n\n# Seite 5 (ui_page4): aktueller Druck\n[display_data rf_page4 file]\nposition: 0, 0\ntext: { (printer.print_stats.filename or \"Kein Druck\")[:16] }\n\n[display_data rf_page4 time]\nposition: 1, 0\ntext:\n  {% set t = printer.print_stats.print_duration|int %}\n  { \"Zeit %3d:%02d:%02d\" % (t // 3600, (t // 60) % 60, t % 60) }\n\n[display_data rf_page4 filament]\nposition: 2, 0\ntext: { \"Filam.%8.2f m\" % (printer.print_stats.filament_used / 1000) }\n\n[display_data rf_page4 layer]\nposition: 3, 0\ntext:\n  {% set i = printer.print_stats.info %}\n  { \"Layer %s/%s\" % (i.current_layer if i.current_layer is not none else \"-\", i.total_layer if i.total_layer is not none else \"-\") }\n\n################################################################################\n# Menue (wie UI_MENU in uimenu.h, deutsche Texte aus uilang.h)\n################################################################################\n\n[menu rf]\ntype: list\nname: Hauptmenü\n\n# ---------------------------- Schnelleinstellung ----------------------------\n[menu rf quick]\ntype: list\nname: Schnelleinst.\n\n[menu rf quick stop]\ntype: list\nenable: {printer.print_stats.state in [\"printing\", \"paused\"]}\nname: Druck abbr.\n\n[menu rf quick stop yes]\ntype: command\nname: Ja, abbrechen\ngcode:\n    CANCEL_PRINT\n    {menu.exit()}\n\n[menu rf quick stop no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n[menu rf quick home]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Home alle\ngcode: G28\n\n[menu rf quick motors]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Motoren aussch.\ngcode: M84\n\n[menu rf quick output]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Objekt ausgeben\ngcode: _RF_OUTPUT_OBJECT\n\n[menu rf quick speed]\ntype: input\nname: Geschw.Mul:{'%3d' % menu.input}%\ninput: {printer.gcode_move.speed_factor * 100}\ninput_min: 10\ninput_max: 300\ninput_step: 1\nrealtime: True\ngcode: M220 S{menu.input|int}\n\n[menu rf quick flow]\ntype: input\nname: Fluss Mul.:{'%3d' % menu.input}%\ninput: {printer.gcode_move.extrude_factor * 100}\ninput_min: 10\ninput_max: 200\ninput_step: 1\nrealtime: True\ngcode: M221 S{menu.input|int}\n\n[menu rf quick park]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Heizbett parken\ngcode: _RF_PARK\n\n[menu rf quick light]\ntype: input\nenable: {'led led' in printer}\nname: X19 Licht: {'An' if menu.input else 'Aus'}\ninput: {1 if 'led led' in printer and printer[\"led led\"].color_data[0][0:3]|sum > 0 else 0}\ninput_min: 0\ninput_max: 1\ninput_step: 1\nrealtime: True\ngcode: RF_LIGHT S={menu.input|int}\n\n[menu rf quick reset]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Neustart\n\n[menu rf quick reset yes]\ntype: command\nname: Ja, neu starten\ngcode: FIRMWARE_RESTART\n\n[menu rf quick reset no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n# --------------------------------- Position ---------------------------------\n[menu rf pos]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Position\n\n[menu rf pos home]\ntype: command\nname: Home alle\ngcode: G28\n\n[menu rf pos homex]\ntype: command\nname: Home X {'*' if 'x' in printer.toolhead.homed_axes else ''}\ngcode: G28 X\n\n[menu rf pos homey]\ntype: command\nname: Home Y {'*' if 'y' in printer.toolhead.homed_axes else ''}\ngcode: G28 Y\n\n[menu rf pos homez]\ntype: command\nname: Home Z {'*' if 'z' in printer.toolhead.homed_axes else ''}\ngcode: G28 Z\n\n[menu rf pos x]\ntype: input\nenable: {'x' in printer.toolhead.homed_axes}\nname: Pos. X:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.x}\ninput_min: {printer.toolhead.axis_minimum.x}\ninput_max: {printer.toolhead.axis_maximum.x}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=X POS={menu.input} F=3000\n\n[menu rf pos y]\ntype: input\nenable: {'y' in printer.toolhead.homed_axes}\nname: Pos. Y:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.y}\ninput_min: {printer.toolhead.axis_minimum.y}\ninput_max: {printer.toolhead.axis_maximum.y}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=Y POS={menu.input} F=3000\n\n[menu rf pos z]\ntype: input\nenable: {'z' in printer.toolhead.homed_axes}\nname: Pos. Z:{'%7.2f' % menu.input}\ninput: {printer.gcode_move.gcode_position.z}\ninput_min: 0\ninput_max: {printer.toolhead.axis_maximum.z - 1}\ninput_step: 0.1\nrealtime: True\ngcode: _RF_MOVE AXIS=Z POS={menu.input} F=600\n\n[menu rf pos e]\ntype: input\nname: Pos. E:{'%+4.0f' % menu.input}mm\ninput: 0\ninput_min: -50\ninput_max: 50\ninput_step: 5\ngcode:\n    SAVE_GCODE_STATE NAME=_rf_e\n    M83\n    G1 E{menu.input} F240\n    RESTORE_GCODE_STATE NAME=_rf_e\n\n# ------------------------------ Pause Position ------------------------------\n[menu rf pausepos]\ntype: list\nenable: {printer.print_stats.state == \"paused\"}\nname: Pause Position\n\n[menu rf pausepos x]\ntype: input\nname: Pos. X:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.x}\ninput_min: {printer.toolhead.axis_minimum.x}\ninput_max: {printer.toolhead.axis_maximum.x}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=X POS={menu.input} F=3000\n\n[menu rf pausepos y]\ntype: input\nname: Pos. Y:{'%7.1f' % menu.input}\ninput: {printer.gcode_move.gcode_position.y}\ninput_min: {printer.toolhead.axis_minimum.y}\ninput_max: {printer.toolhead.axis_maximum.y}\ninput_step: 1.0\nrealtime: True\ngcode: _RF_MOVE AXIS=Y POS={menu.input} F=3000\n\n[menu rf pausepos z]\ntype: input\nname: Pos. Z:{'%7.2f' % menu.input}\ninput: {printer.gcode_move.gcode_position.z}\ninput_min: {printer.gcode_move.gcode_position.z}\ninput_max: {printer.toolhead.axis_maximum.z - 1}\ninput_step: 0.5\nrealtime: True\ngcode: _RF_MOVE AXIS=Z POS={menu.input} F=600\n\n# --------------------------------- Extruder ---------------------------------\n[menu rf ext]\ntype: list\nname: Extruder\n\n[menu rf ext bed]\ntype: input\nname: Temp. Bed:{'%3d' % menu.input}~degrees~C\ninput: {printer.heater_bed.target}\ninput_min: 0\ninput_max: {printer.configfile.settings.heater_bed.max_temp - 10}\ninput_step: 5\ngcode: M140 S{menu.input|int}\n\n[menu rf ext t0]\ntype: input\nname: Temp. E0 :{'%3d' % menu.input}~degrees~C\ninput: {printer.extruder.target}\ninput_min: 0\ninput_max: {printer.configfile.settings.extruder.max_temp - 10}\ninput_step: 5\ngcode: M104 T0 S{menu.input|int}\n\n[menu rf ext t1]\ntype: input\nenable: {'extruder1' in printer}\nname: Temp. E1 :{'%3d' % menu.input}~degrees~C\ninput: {printer.extruder1.target if 'extruder1' in printer else 0}\ninput_min: 0\ninput_max: {printer.configfile.settings.extruder1.max_temp - 10 if 'extruder1' in printer else 250}\ninput_step: 5\ngcode: M104 T1 S{menu.input|int}\n\n[menu rf ext off0]\ntype: command\nname: Extruder 0 aus\ngcode: M104 T0 S0\n\n[menu rf ext off1]\ntype: command\nenable: {'extruder1' in printer}\nname: Extruder 1 aus\ngcode: M104 T1 S0\n\n[menu rf ext offbed]\ntype: command\nname: Heizbett aus\ngcode: M140 S0\n\n[menu rf ext active]\ntype: input\nenable: {'extruder1' in printer and printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Aktiver Extr. {'%d' % menu.input}\ninput: {1 if printer.toolhead.extruder == \"extruder1\" else 0}\ninput_min: 0\ninput_max: 1\ninput_step: 1\ngcode: T{menu.input|int}\n\n[menu rf ext pla]\ntype: command\nname: Vorheizen PLA\ngcode: _RF_PREHEAT MATERIAL=PLA\n\n[menu rf ext abs]\ntype: command\nname: Vorheizen ABS\ngcode: _RF_PREHEAT MATERIAL=ABS\n\n[menu rf ext cool]\ntype: command\nname: Abkühlen\ngcode: _RF_COOLDOWN\n\n[menu rf ext load]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Filament laden\ngcode: _RF_FILAMENT DIR=1\n\n[menu rf ext unload]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Filament entl.\ngcode: _RF_FILAMENT DIR=-1\n\n[menu rf ext flow]\ntype: input\nname: Fluss Mul.:{'%3d' % menu.input}%\ninput: {printer.gcode_move.extrude_factor * 100}\ninput_min: 10\ninput_max: 200\ninput_step: 1\nrealtime: True\ngcode: M221 S{menu.input|int}\n\n[menu rf ext eorigin]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Setze E Urspr.\ngcode: G92 E0\n\n# ---------------------------------- Luefter ---------------------------------\n[menu rf fan]\ntype: list\nname: Lüfter\n\n[menu rf fan speed]\ntype: input\nname: Lüfter:{'%3d' % menu.input}%\ninput: {printer.fan.speed * 100}\ninput_min: 0\ninput_max: 100\ninput_step: 5\nrealtime: True\ngcode: M106 S{(menu.input * 2.55)|int}\n\n[menu rf fan off]\ntype: command\nname: Lüfter aus\ngcode: M107\n\n[menu rf fan p25]\ntype: command\nname: Lüfter auf 25%\ngcode: M106 S64\n\n[menu rf fan p50]\ntype: command\nname: Lüfter auf 50%\ngcode: M106 S128\n\n[menu rf fan p75]\ntype: command\nname: Lüfter auf 75%\ngcode: M106 S191\n\n[menu rf fan p100]\ntype: command\nname: Lüfter auf 100%\ngcode: M106 S255\n\n# --------------------------------- SD Karte ---------------------------------\n[menu rf sd]\ntype: list\nname: SD Karte\n\n[menu rf sd files]\n# Dateien aus dem G-Code-Ordner des Raspberry Pi (wie in Mainsail unter G-Code-Dateien).\n# Steckt eine SD-Karte im Drucker ([rf_sdcard]), steht oben der Eintrag \"SD-Karte\" mit\n# deren Dateien. Antippen startet den Druck sofort, wie in der RF-Firmware (braucht\n# den Klipper-Fork); Dateien von der Karte werden dafuer zuerst auf den Pi kopiert.\ntype: vsdlist\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Drucke Datei\nstart_print: True\nempty_text: Keine Dateien\ncard_text: SD-Karte\n\n[menu rf sd pause]\ntype: command\nenable: {printer.print_stats.state == \"printing\"}\nname: Druck pausieren\ngcode: PAUSE\n\n[menu rf sd resume]\ntype: command\nenable: {printer.print_stats.state == \"paused\"}\nname: Druck forts.\ngcode: RESUME\n\n[menu rf sd stop]\ntype: list\nenable: {printer.print_stats.state in [\"printing\", \"paused\"]}\nname: Druck abbr.\n\n[menu rf sd stop yes]\ntype: command\nname: Ja, abbrechen\ngcode:\n    CANCEL_PRINT\n    {menu.exit()}\n\n[menu rf sd stop no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n# ------------------------------- Konfiguration ------------------------------\n[menu rf conf]\ntype: list\nname: Konfiguration\n\n# Z Kalibrierung\n[menu rf conf z]\ntype: list\nname: Z Kalibrierung\n\n[menu rf conf z scan]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Matrix Scan\ngcode: _RF_MATRIX_SCAN\n\n[menu rf conf z scanpla]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Matrix Scan PLA\ngcode: _RF_MATRIX_SCAN BED=60\n\n[menu rf conf z scanabs]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Matrix Scan ABS\ngcode: _RF_MATRIX_SCAN BED=100\n\n[menu rf conf z offsetscan]\ntype: command\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Z-Offset-Scan\ngcode: _RF_Z_OFFSET_SCAN\n\n[menu rf conf z offset]\ntype: input\nname: Z Abst.:{'%7.3f' % menu.input}\ninput: {printer.gcode_move.homing_origin.z}\ninput_min: -2\ninput_max: 2\ninput_step: 0.01\nrealtime: True\ngcode: SET_GCODE_OFFSET Z={'%.3f' % menu.input}\n\n# DMS Features\n[menu rf conf dms]\ntype: list\nname: DMS Features\n\n[menu rf conf dms sense]\ntype: list\nname: SenseOffset\n\n[menu rf conf dms sense level]\ntype: input\nname: Level:{'%5d' % menu.input}digi\ninput: {printer.z_sense_offset.force_threshold}\ninput_min: 50\ninput_max: 20000\ninput_step: 50\ngcode:\n    SET_Z_SENSE_OFFSET FORCE_THRESHOLD={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_sense_threshold VALUE={menu.input|int}\n\n[menu rf conf dms sense max]\ntype: input\nname: Max: {'%3d' % menu.input} um\ninput: {printer.z_sense_offset.max_z_offset * 1000}\ninput_min: 0\ninput_max: 500\ninput_step: 10\ngcode:\n    SET_Z_SENSE_OFFSET MAX_Z_OFFSET={'%.3f' % (menu.input / 1000)}\n    SAVE_VARIABLE VARIABLE=rf_sense_max VALUE={'%.3f' % (menu.input / 1000)}\n\n[menu rf conf dms sense auto]\ntype: input\nname: AutoStart: {'An' if menu.input else 'Aus'}\ninput: {printer.save_variables.variables.rf_sense_autostart|default(1)}\ninput_min: 0\ninput_max: 1\ninput_step: 1\ngcode: SAVE_VARIABLE VARIABLE=rf_sense_autostart VALUE={menu.input|int}\n\n[menu rf conf dms pause]\ntype: list\nenable: {'rf1000_pressure_guard' in printer}\nname: Notfall Pause\n\n[menu rf conf dms pause min]\ntype: input\nname: Min:{'%6d' % menu.input} digi\ninput: {printer.rf1000_pressure_guard.emergency_min}\ninput_min: -20000\ninput_max: 0\ninput_step: 100\ngcode:\n    RF_EMERGENCY_PAUSE MIN={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_pause_min VALUE={menu.input|int}\n\n[menu rf conf dms pause max]\ntype: input\nname: Max:{'%6d' % menu.input} digi\ninput: {printer.rf1000_pressure_guard.emergency_max}\ninput_min: 0\ninput_max: 20000\ninput_step: 100\ngcode:\n    RF_EMERGENCY_PAUSE MAX={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_pause_max VALUE={menu.input|int}\n\n[menu rf conf dms flow]\ntype: list\nenable: {'rf1000_pressure_guard' in printer}\nname: Digit Flow CMP\n\n[menu rf conf dms flow min]\ntype: input\nname: Digit Min:{'%5d' % menu.input}\ninput: {printer.rf1000_pressure_guard.flow_min}\ninput_min: 0\ninput_max: 20000\ninput_step: 50\ngcode:\n    RF_FLOW_COMP MIN={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_flow_min VALUE={menu.input|int}\n\n[menu rf conf dms flow max]\ntype: input\nname: Digit Max:{'%5d' % menu.input}\ninput: {printer.rf1000_pressure_guard.flow_max}\ninput_min: 0\ninput_max: 20000\ninput_step: 50\ngcode:\n    RF_FLOW_COMP MAX={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_flow_max VALUE={menu.input|int}\n\n[menu rf conf dms flow df]\ntype: input\nname: dFlow:   :{'%+4d' % menu.input}%\ninput: {printer.rf1000_pressure_guard.flow_percent}\ninput_min: -99\ninput_max: 99\ninput_step: 1\ngcode:\n    RF_FLOW_COMP FLOW={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_flow_percent VALUE={menu.input|int}\n\n[menu rf conf dms flow dv]\ntype: input\nname: dFeed:   :{'%+4d' % menu.input}%\ninput: {printer.rf1000_pressure_guard.feed_percent}\ninput_min: -90\ninput_max: 99\ninput_step: 1\ngcode:\n    RF_FLOW_COMP FEED={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_feed_percent VALUE={menu.input|int}\n\n# Temperaturen: PID-Autotune\n[menu rf conf pid]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Temperatures\n\n[menu rf conf pid e0]\ntype: list\nname: Extruder 0\n\n[menu rf conf pid e0 yes]\ntype: command\nname: PID starten\ngcode:\n    PID_TUNING_HOTEND_1\n    {menu.exit()}\n\n[menu rf conf pid e1]\ntype: list\nenable: {'extruder1' in printer}\nname: Extruder 1\n\n[menu rf conf pid e1 yes]\ntype: command\nname: PID starten\ngcode:\n    PID_TUNING_HOTEND_2\n    {menu.exit()}\n\n[menu rf conf pid bed]\ntype: list\nname: Heizbett\n\n[menu rf conf pid bed yes]\ntype: command\nname: PID starten\ngcode:\n    PID_TUNING_BED\n    {menu.exit()}\n\n# Beschleunigung und Feedrate\n[menu rf conf accel]\ntype: list\nname: Beschleunigung\n\n[menu rf conf accel xy]\ntype: input\nname: Accel:{'%5d' % menu.input}\ninput: {printer.toolhead.max_accel}\ninput_min: 100\ninput_max: 10000\ninput_step: 100\ngcode:\n    SET_VELOCITY_LIMIT ACCEL={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_accel VALUE={menu.input|int}\n\n[menu rf conf feed]\ntype: list\nname: Feedrate\n\n[menu rf conf feed max]\ntype: input\nname: Max v:{'%4d' % menu.input}mm/s\ninput: {printer.toolhead.max_velocity}\ninput_min: 10\ninput_max: 500\ninput_step: 5\ngcode:\n    SET_VELOCITY_LIMIT VELOCITY={menu.input|int}\n    SAVE_VARIABLE VARIABLE=rf_velocity VALUE={menu.input|int}\n\n# Werkseinstellungen\n[menu rf conf defaults]\ntype: list\nenable: {printer.print_stats.state not in [\"printing\", \"paused\"]}\nname: Werkseinstell.\n\n[menu rf conf defaults yes]\ntype: command\nname: Ja, zurücks.\ngcode:\n    _RF_FACTORY_RESET\n    {menu.exit()}\n\n[menu rf conf defaults no]\ntype: command\nname: Nein\ngcode: {menu.back()}\n\n################################################################################\n# Hilfsmakros fuer das Menue\n################################################################################\n\n# Gespeicherte Menue-Einstellungen beim Start uebernehmen\n[delayed_gcode _RF_LOAD_SETTINGS]\ninitial_duration: 1\ngcode:\n    {% set v = printer.save_variables.variables %}\n    {% if 'rf_sense_threshold' in v or 'rf_sense_max' in v %}\n    SET_Z_SENSE_OFFSET FORCE_THRESHOLD={v.rf_sense_threshold|default(printer.z_sense_offset.force_threshold)|int} MAX_Z_OFFSET={v.rf_sense_max|default(printer.z_sense_offset.max_z_offset)}\n    {% endif %}\n    {% if 'rf1000_pressure_guard' in printer %}\n    {% set pg = printer.rf1000_pressure_guard %}\n    {% if 'rf_pause_min' in v or 'rf_pause_max' in v %}\n    RF_EMERGENCY_PAUSE MIN={v.rf_pause_min|default(pg.emergency_min)} MAX={v.rf_pause_max|default(pg.emergency_max)}\n    {% endif %}\n    {% if 'rf_flow_min' in v or 'rf_flow_max' in v or 'rf_flow_percent' in v or 'rf_feed_percent' in v %}\n    RF_FLOW_COMP MIN={v.rf_flow_min|default(pg.flow_min)} MAX={v.rf_flow_max|default(pg.flow_max)} FLOW={v.rf_flow_percent|default(pg.flow_percent)} FEED={v.rf_feed_percent|default(pg.feed_percent)}\n    {% endif %}\n    {% endif %}\n    {% if 'rf_accel' in v %}\n    SET_VELOCITY_LIMIT ACCEL={v.rf_accel}\n    {% endif %}\n    {% if 'rf_velocity' in v %}\n    SET_VELOCITY_LIMIT VELOCITY={v.rf_velocity}\n    {% endif %}\n\n# Werte aus der printer.cfg wiederherstellen und speichern\n[gcode_macro _RF_FACTORY_RESET]\ngcode:\n    {% set c = printer.configfile.settings %}\n    SET_Z_SENSE_OFFSET FORCE_THRESHOLD={c.z_sense_offset.force_threshold} MAX_Z_OFFSET={c.z_sense_offset.max_z_offset}\n    SAVE_VARIABLE VARIABLE=rf_sense_threshold VALUE={c.z_sense_offset.force_threshold}\n    SAVE_VARIABLE VARIABLE=rf_sense_max VALUE={c.z_sense_offset.max_z_offset}\n    SAVE_VARIABLE VARIABLE=rf_sense_autostart VALUE=1\n    {% if 'rf1000_pressure_guard' in c %}\n    {% set g = c.rf1000_pressure_guard %}\n    RF_EMERGENCY_PAUSE MIN={g.emergency_min} MAX={g.emergency_max}\n    RF_FLOW_COMP MIN={g.flow_min} MAX={g.flow_max} FLOW={g.flow_percent} FEED={g.feed_percent}\n    SAVE_VARIABLE VARIABLE=rf_pause_min VALUE={g.emergency_min}\n    SAVE_VARIABLE VARIABLE=rf_pause_max VALUE={g.emergency_max}\n    SAVE_VARIABLE VARIABLE=rf_flow_min VALUE={g.flow_min}\n    SAVE_VARIABLE VARIABLE=rf_flow_max VALUE={g.flow_max}\n    SAVE_VARIABLE VARIABLE=rf_flow_percent VALUE={g.flow_percent}\n    SAVE_VARIABLE VARIABLE=rf_feed_percent VALUE={g.feed_percent}\n    {% endif %}\n    SET_VELOCITY_LIMIT ACCEL={c.printer.max_accel} VELOCITY={c.printer.max_velocity}\n    SAVE_VARIABLE VARIABLE=rf_accel VALUE={c.printer.max_accel}\n    SAVE_VARIABLE VARIABLE=rf_velocity VALUE={c.printer.max_velocity}\n    M117 Werkseinstellungen\n\n# Achse absolut fahren (fuer die Positionsmenues)\n[gcode_macro _RF_MOVE]\ngcode:\n    SAVE_GCODE_STATE NAME=_rf_move\n    G90\n    G1 {params.AXIS}{params.POS} F{params.F|default(3000)}\n    RESTORE_GCODE_STATE NAME=_rf_move\n\n# Objekt ausgeben (Repetier OUTPUT_OBJECT_SCRIPT_PRINT): zurueckziehen, Bett nach\n# unten (Z max - 5 = 185 mm wie PRINT_END) und nach vorne bis position_max, Motoren aus\n[gcode_macro _RF_OUTPUT_OBJECT]\ngcode:\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    RESPOND TYPE=error MSG=\"Objekt ausgeben: Zuerst alle Achsen referenzieren.\"\n    {% else %}\n    {% set th = printer.toolhead %}\n    {% if printer[th.extruder].temperature >= printer.configfile.settings[th.extruder].min_extrude_temp %}\n    M83\n    G1 E-1 F1800\n    {% endif %}\n    G90\n    G1 Z{th.axis_maximum.z - 5} F540\n    G1 Y{th.axis_maximum.y} F4800\n    M400\n    M84\n    M117 Objekt ausgegeben\n    {% endif %}\n\n# Heizbett parken (Repetier PARK_POSITION X0 Y120 Z175)\n[gcode_macro _RF_PARK]\ngcode:\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    G28\n    {% endif %}\n    G90\n    G1 Z{[175, printer.toolhead.axis_maximum.z - 1]|min} F600\n    G1 X0 Y120 F4800\n    M117 Heizbett geparkt\n\n# Vorheizen wie Repetier (PLA 180/60, ABS 210/100) fuer den aktiven Extruder\n[gcode_macro _RF_PREHEAT]\ngcode:\n    {% if params.MATERIAL|default(\"PLA\")|upper == \"ABS\" %}\n    {% set e, b = 210, 100 %}\n    {% else %}\n    {% set e, b = 180, 60 %}\n    {% endif %}\n    M104 S{e}\n    M140 S{b}\n\n[gcode_macro _RF_COOLDOWN]\ngcode:\n    TURN_OFF_HEATERS\n    M107\n\n# Filament laden/entladen wie Repetier \"Durchdruecken\"/\"Oldstyle pull\":\n# laden bei 210 Grad 90 mm langsam, entladen bei 180 Grad 90 mm zurueck.\n# In zwei Schritten, weil max_extrude_only_distance 50 mm ist.\n[gcode_macro _RF_FILAMENT]\ngcode:\n    {% set dir = params.DIR|default(1)|int %}\n    {% set temp = 210 if dir > 0 else 180 %}\n    {% set feed = 100 if dir > 0 else 500 %}\n    M117 Heize auf {temp}...\n    M109 S{temp}\n    SAVE_GCODE_STATE NAME=_rf_fil\n    M83\n    G1 E{45 * dir} F{feed}\n    G1 E{45 * dir} F{feed}\n    RESTORE_GCODE_STATE NAME=_rf_fil\n    M104 S0\n    M117 Filament {'geladen' if dir > 0 else 'entladen'}\n\n# Matrix Scan: referenzieren, optional Bett heizen, dann BED_CALIBRATE\n# (misst Z, erstellt das Bettnetz und speichert mit SAVE_CONFIG)\n[gcode_macro _RF_MATRIX_SCAN]\ngcode:\n    {% if params.BED is defined %}\n    M117 Heize Bett auf {params.BED}...\n    M190 S{params.BED|int}\n    {% endif %}\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    G28\n    {% endif %}\n    M117 Matrix Scan...\n    BED_CALIBRATE\n\n# Z-Offset-Scan in der Bettmitte\n[gcode_macro _RF_Z_OFFSET_SCAN]\ngcode:\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n    G28\n    {% endif %}\n    G90\n    G0 Z10 F600\n    G0 X100 Y100 F4800\n    G0 Z2 F600\n    M117 Z-Offset-Scan...\n    Z_OFFSET_SCAN\n",
 "hotend_2in1": "# ------------------------------------------------------------------\n# EINSTELLUNGEN UND STATUS\n# ------------------------------------------------------------------\n[gcode_macro _TOOL_STATE]\nvariable_active_tool: 0      # Standard beim Start: T0\n# Vom Schalter bis zum Hotend sind es 65 mm, die Parkposition liegt 5 mm hinter dem Schalter.\n# Geparkt ist der Schalter frei und das Filament damit aus dem gemeinsamen Weg.\nvariable_park_dist: 70       # Parkposition: Abstand zum Hotend (mm)\nvariable_load_dist: 65       # Laden beim Werkzeugwechsel (mm), Rest foerdert der Purge-Turm\nvariable_prime_dist: 65      # Strecke Schalter bis Hotend (mm), gemessen\nvariable_prime_purge: 0      # Purge vor dem Druck (mm), laeuft langsam, 0 = aus\nvariable_clear_limit: 120    # Max. Rueckzug, bis der Sensor frei sein muss (mm)\nvariable_feed_limit: 100     # Max. Vorschub, bis der Sensor ausloesen muss (mm)\nvariable_mesh_temp: 150      # Nozzle-Temperatur beim Bed Mesh (C)\nvariable_purge_x: 0          # Purge-Position\nvariable_purge_y: -25\nvariable_purge_z: 15\ngcode:\n    # Nur Variablen - keine Aktion noetig\n\n# ------------------------------------------------------------------\n# HILFSMAKROS\n# ------------------------------------------------------------------\n# Wichtig: Klipper wertet ein Makro komplett aus, bevor der erste Befehl\n# laeuft. Sensorabfragen nach einer Bewegung muessen deshalb in einem\n# eigenen Untermakro stehen - das wird erst beim Aufruf ausgewertet.\n\n[gcode_macro _SYNC_TOOL]\ngcode:\n    {% set tool = params.TOOL|int %}\n    {% if tool == 0 %}\n        SYNC_EXTRUDER_MOTION EXTRUDER=\"extruder\" MOTION_QUEUE=\"extruder\"\n        SYNC_EXTRUDER_MOTION EXTRUDER=\"extruder1\" MOTION_QUEUE=\"\"\n    {% else %}\n        SYNC_EXTRUDER_MOTION EXTRUDER=\"extruder\" MOTION_QUEUE=\"\"\n        SYNC_EXTRUDER_MOTION EXTRUDER=\"extruder1\" MOTION_QUEUE=\"extruder\"\n    {% endif %}\n    SET_GCODE_VARIABLE MACRO=_TOOL_STATE VARIABLE=active_tool VALUE={tool}\n    {% if printer.save_variables.variables.active_tool|default(-1)|int != tool %}\n        SAVE_VARIABLE VARIABLE=active_tool VALUE={tool}\n    {% endif %}\n\n# Aktives Werkzeug bleibt ueber Neustarts erhalten\n[save_variables]\nfilename: ~/printer_data/config/variables.cfg\n\n[delayed_gcode _RESTORE_TOOL]\ninitial_duration: 1\ngcode:\n    _SYNC_TOOL TOOL={printer.save_variables.variables.active_tool|default(0)|int}\n\n[gcode_macro _ASSERT_SENSOR]\ngcode:\n    {% set tool = params.TOOL|int %}\n    {% set sensor = \"filament_sensor_left\" if tool == 0 else \"filament_sensor_right\" %}\n    {% if printer[\"gcode_button \" ~ sensor].state != params.EXPECT %}\n        {% if params.EXPECT == \"PRESSED\" %}\n            {action_raise_error(\"ABBRUCH: T%d Filament erreicht den Sensor nicht (%s).\" % (tool, sensor))}\n        {% else %}\n            {action_raise_error(\"ABBRUCH: T%d Sensor wird nicht frei (%s). Filament und Sensor pruefen.\" % (tool, sensor))}\n        {% endif %}\n    {% endif %}\n\n# Geladenes Werkzeug muss am Sensor Filament melden, sonst Pause statt Luftdruck\n[gcode_macro _PAUSE_IF_NO_FILAMENT]\ngcode:\n    {% set tool = params.TOOL|int %}\n    {% set sensor = \"filament_sensor_left\" if tool == 0 else \"filament_sensor_right\" %}\n    {% if printer[\"gcode_button \" ~ sensor].state != \"PRESSED\" %}\n        RESPOND TYPE=error MSG=\"T{tool} meldet kein Filament - Druck pausiert!\"\n        PAUSE\n    {% endif %}\n\n# ------------------------------------------------------------------\n# TOOLCHANGE MAKROS (FUER DEN DRUCK)\n# ------------------------------------------------------------------\n# SAVE/RESTORE_GCODE_STATE erhaelt E-Modus, Geschwindigkeit und logische\n# E-Position. Der Wechsel funktioniert so mit M82 und M83.\n[gcode_macro _TOOLCHANGE]\ngcode:\n    {% set tool = params.TOOL|int %}\n    {% set state = printer[\"gcode_macro _TOOL_STATE\"] %}\n    {% if state.active_tool != tool %}\n        SAVE_GCODE_STATE NAME=_toolchange\n        M83\n        G1 E-{state.park_dist} F3000\n        G4 P100\n        M400\n        # Altes Filament muss aus dem Zusammenlauf sein, sonst Abbruch statt Stau\n        _ASSERT_SENSOR TOOL={state.active_tool} EXPECT=RELEASED\n        _SYNC_TOOL TOOL={tool}\n        G1 E{state.load_dist} F400\n        G4 P100\n        M400\n        RESTORE_GCODE_STATE NAME=_toolchange\n        _PAUSE_IF_NO_FILAMENT TOOL={tool}\n    {% else %}\n        _SYNC_TOOL TOOL={tool}\n    {% endif %}\n\n[gcode_macro T0]\ndescription: Wechselt auf Extruder Links (T0).\ngcode:\n    _TOOLCHANGE TOOL=0\n\n[gcode_macro T1]\ndescription: Wechselt auf Extruder Rechts (T1).\ngcode:\n    _TOOLCHANGE TOOL=1\n\n# ------------------------------------------------------------------\n# START PRINT\n# ------------------------------------------------------------------\n# OrcaSlicer Start-G-Code:\n# PRINT_START EXTRUDER_TEMP=[nozzle_temperature_initial_layer] BED_TEMP=[bed_temperature_initial_layer_single] PRINT_MIN={first_layer_print_min[0]},{first_layer_print_min[1]} PRINT_MAX={first_layer_print_max[0]},{first_layer_print_max[1]} INITIAL_TOOL=[initial_tool] USED_T0={is_extruder_used[0]} USED_T1={is_extruder_used[1]}\n# Ohne USED_T0/USED_T1 werden beide Werkzeuge geprimt.\n[gcode_macro PRINT_START]\ngcode:\n    {% set state = printer[\"gcode_macro _TOOL_STATE\"] %}\n    {% set bed_temp = params.BED_TEMP|default(60)|float %}\n    {% set hotend_temp = params.EXTRUDER_TEMP|default(200)|float %}\n    {% set mesh_temp = [state.mesh_temp|float, hotend_temp]|min %}\n    {% set initial_tool = params.INITIAL_TOOL|default(0)|int %}\n    {% set used_t0 = initial_tool == 0 or params.USED_T0|default(\"true\")|lower in (\"true\", \"1\") %}\n    {% set used_t1 = initial_tool == 1 or params.USED_T1|default(\"true\")|lower in (\"true\", \"1\") %}\n\n    BED_MESH_CLEAR\n    G28\n\n    # Heizen und Bed Mesh: Nozzle nur vorwaermen, damit sie beim Messen nicht tropft\n    M117 Heating...\n    M140 S{bed_temp}\n    M109 S{mesh_temp}\n    M190 S{bed_temp}\n\n    M117 Abgleich DMS !\n    {% if params.PRINT_MIN is defined and params.PRINT_MAX is defined %}\n        BED_MESH_CALIBRATE PRINT_MIN={params.PRINT_MIN} PRINT_MAX={params.PRINT_MAX} FORCE_PRINT_AREA_BED_MESH=1\n    {% else %}\n        BED_MESH_CALIBRATE\n    {% endif %}\n\n    # Zur Purge-Position und auf Drucktemperatur\n    G90\n    G1 Z{state.purge_z} F600\n    G1 X{state.purge_x} Y{state.purge_y} F6000\n    M117 Heating Nozzle...\n    M109 S{hotend_temp}\n\n    _PREPARE_TOOLS TARGET={initial_tool} PRIME_T0={1 if used_t0 else 0} PRIME_T1={1 if used_t1 else 0}\n    G92 E0\n    M117 Druck startet!\n\n# ------------------------------------------------------------------\n# SENSOR FREIMACHEN UND PRIMEN\n# ------------------------------------------------------------------\n# Alles laeuft synchron im Makro: Der Druck beginnt erst danach.\n[gcode_macro _PREPARE_TOOLS]\ngcode:\n    {% set state = printer[\"gcode_macro _TOOL_STATE\"] %}\n    {% set target = params.TARGET|default(0)|int %}\n    SAVE_GCODE_STATE NAME=_prepare_tools\n    M83\n    _CLEAR_SENSOR TOOL=0\n    _CLEAR_SENSOR TOOL=1\n    {% if params.PRIME_T0|default(1)|int == 1 %}\n        _PRIME_TOOL TOOL=0\n    {% endif %}\n    {% if params.PRIME_T1|default(1)|int == 1 %}\n        _PRIME_TOOL TOOL=1\n    {% endif %}\n    M117 Aktiviere T{target}...\n    _SYNC_TOOL TOOL={target}\n    # Von der Parkposition bis zum Hotend, das sind 65 mm ab Schalter\n    G1 E{state.park_dist} F1000\n    {% if state.prime_purge|float > 0 %}\n        # Schmelze foerdern geht nur langsam, sonst dreht das Filament durch\n        G1 E{state.prime_purge} F120\n    {% endif %}\n    RESTORE_GCODE_STATE NAME=_prepare_tools\n\n[gcode_macro _CLEAR_SENSOR]\ngcode:\n    {% set tool = params.TOOL|int %}\n    M117 T{tool} freimachen...\n    _SYNC_TOOL TOOL={tool}\n    {% for i in range(printer[\"gcode_macro _TOOL_STATE\"].clear_limit|int) %}\n        _CLEAR_STEP TOOL={tool}\n    {% endfor %}\n    _ASSERT_SENSOR TOOL={tool} EXPECT=RELEASED\n\n[gcode_macro _CLEAR_STEP]\ngcode:\n    {% set tool = params.TOOL|int %}\n    {% set sensor = \"filament_sensor_left\" if tool == 0 else \"filament_sensor_right\" %}\n    {% if printer[\"gcode_button \" ~ sensor].state == \"PRESSED\" %}\n        G1 E-1 F3000\n        G4 P50\n        M400\n    {% endif %}\n\n[gcode_macro _PRIME_TOOL]\ngcode:\n    {% set state = printer[\"gcode_macro _TOOL_STATE\"] %}\n    {% set tool = params.TOOL|int %}\n    M117 Prime T{tool}...\n    _SYNC_TOOL TOOL={tool}\n    # Erst bis zum Ausloesen foerdern, dann ist die Lage der Spitze bekannt\n    {% for i in range(state.feed_limit|int) %}\n        _FEED_STEP TOOL={tool}\n    {% endfor %}\n    _ASSERT_SENSOR TOOL={tool} EXPECT=PRESSED\n    G1 E{state.prime_dist} F1000\n    G1 E-{state.park_dist} F3000\n    G4 P100\n    M400\n    _ASSERT_SENSOR TOOL={tool} EXPECT=RELEASED\n\n[gcode_macro _FEED_STEP]\ngcode:\n    {% set tool = params.TOOL|int %}\n    {% set sensor = \"filament_sensor_left\" if tool == 0 else \"filament_sensor_right\" %}\n    {% if printer[\"gcode_button \" ~ sensor].state != \"PRESSED\" %}\n        G1 E1 F300\n        G4 P50\n        M400\n    {% endif %}\n\n# ------------------------------------------------------------------\n# END PRINT\n# ------------------------------------------------------------------\n[gcode_macro PRINT_END]\nvariable_machine_depth: 235\ngcode:\n    # Ziele auf die Achsgrenzen begrenzen, auch mit Z-Offset (Babystepping)\n    {% set pos = printer.gcode_move.gcode_position %}\n    {% set origin = printer.gcode_move.homing_origin %}\n    {% set limit = printer.toolhead.axis_maximum %}\n    {% set x_max = limit.x - origin.x %}\n    {% set y_max = limit.y - origin.y %}\n    {% set z_max = limit.z - origin.z %}\n    M140 S0\n    M104 S0\n    M106 S0\n    G90\n    M83\n    G1 Z{[pos.z + 0.2, z_max]|min} E-2 F2400\n    G1 X{[pos.x + 5, x_max]|min} Y{[pos.y + 5, y_max]|min} F6000\n    G1 Z{[pos.z + 10, z_max]|min} F6000\n    G1 X0 Y200 F6000\n    G1 Z{z_max} F14000\n    M84\n    BED_MESH_CLEAR\n    M117 Druck erfolgreich beendet!\n    SET_LED LED=Led RED=0 GREEN=0 BLUE=0 SYNC=0 TRANSMIT=1\n\n# ------------------------------------------------------------------\n# SENSOREN (ALS BUTTONS DEFINIERT)\n# ------------------------------------------------------------------\n# Ersetzt filament_switch_sensor.\n# Status ist nun lesbar über printer[\"gcode_button Name\"].state\n# state ist entweder \"PRESSED\" (aktiv) oder \"RELEASED\" (inaktiv)\n\n[gcode_button filament_sensor_left]\npin: PE15\npress_gcode:\n  # Optional: Code der beim Drücken ausgeführt wird (Debugging)\n  # M118 Sensor Links PRESSED\nrelease_gcode:\n  # Optional: Code der beim Loslassen ausgeführt wird\n  # M118 Sensor Links RELEASED\n\n[gcode_button filament_sensor_right]\npin: PD9\npress_gcode:\n  # M118 Sensor Rechts PRESSED\nrelease_gcode:\n  # M118 Sensor Rechts RELEASED\n\n#[filament_switch_sensor SENSOR_LINKS]\n#switch_pin: PE15 #!PD9\n#runout_gcode:\n#    M117 KEINS\n#insert_gcode:\n#    M117 VORHANDEN\n#\n#[filament_switch_sensor SENSOR_RECHTS]\n#switch_pin: PD9 #!PE15\n#runout_gcode:\n#    M117 KEINS\n#insert_gcode:\n#    M117 VORHANDEN\n\n\n# ------------------------------------------------------------------\n# MANUELLE EXTRUDER LADEN FUNKTION\n# ------------------------------------------------------------------\n[gcode_macro EXTRUDER_LADEN]\ndescription: Manuelles Laden für Wartung. Ohne TOOL beide Werkzeuge, mit TOOL=0 oder TOOL=1 nur dieses.\ngcode:\n    # Heizt selbst auf mindestens 190 C, eine hoehere Solltemperatur bleibt erhalten\n    M117 Heize Nozzle...\n    M109 S{[190, printer.extruder.target|float]|max}\n    {% if params.TOOL is defined %}\n        {% set tool = params.TOOL|int %}\n        _PREPARE_TOOLS TARGET={tool} PRIME_T0={1 if tool == 0 else 0} PRIME_T1={1 if tool == 1 else 0}\n    {% else %}\n        _PREPARE_TOOLS TARGET={printer[\"gcode_macro _TOOL_STATE\"].active_tool}\n    {% endif %}\n    M117 Laden fertig\n",
 "led_progress": "# use NEOPIXEL_DISPLAY LED=Led_Name TYPE=template_type MODE=template_mode\n\n# for TYPE use:\n# extruder_temp     :extruder temperature progress\n# bed_temp          :bed temperature progress\n# print_percent     :print progress\n# printer_speed     :printer speed\n\n# for MODE use:\n# progress          :the leds will light up one by one\n# glow              :all leds will fade from one color (or non) to other color\n\n# more info: https://github.com/digitalninja-ro/klipper-neopixel/blob/master/README.md\n\n[gcode_macro NEOPIXEL_DISPLAY]\ngcode:\n    {% set led = params.LED %}\n    {% set type = params.TYPE %}\n    {% set mode = params.MODE %}\n    {% set my_neopixel = printer.configfile.config['neopixel ' ~ led] %}\n\n    {% if mode == 'progress' %}\n        {% for i in range(my_neopixel.chain_count|int) %}\n            SET_LED_TEMPLATE LED={led} INDEX={i+1} TEMPLATE={'led_' ~ type ~ '_' ~ mode} param_led_num={i+1} param_led_total={my_neopixel.chain_count|int}\n        {% endfor %}\n    {% endif %}\n    {% if mode == 'glow' %}\n        SET_LED_TEMPLATE LED={led} TEMPLATE={'led_' ~ type ~ '_' ~ mode}\n    {% endif %}\n\n\n[display_template led_extruder_temp_glow]\ntext:\n    {% if printer.extruder.target > 0.0 %}\n        {%  set temp = printer.extruder.target %}\n    {% else %}\n        {% set temp = printer.configfile.config.extruder.max_temp %}\n    {% endif %}\n    {% set ratio = printer.extruder.temperature / temp|float %}\n    {ratio}, 0.0, {1-ratio}, 0.0\n\n[display_template led_extruder_temp_progress]\nparam_led_num:  0\nparam_led_total: 1\ntext:\n    {% if printer.extruder.target > 0.0 %}\n        {%  set temp = printer.extruder.target %}\n    {% else %}\n        {% set temp = printer.configfile.config.extruder.max_temp %}\n    {% endif %}\n    {% set ratio = printer.extruder.temperature / temp|float %}\n    {% set led_ratio = param_led_num|float / param_led_total %}\n    {% if ratio > led_ratio %}\n        {led_ratio}, 0.0, 0.0, 0.0\n    {% else %}\n        0.0, 0.0, 0.0, 0.0\n    {% endif %}\n\n[display_template led_bed_temp_glow]\ntext:\n    {% if printer.heater_bed.target > 0.0 %}\n        {%  set temp = printer.heater_bed.target %}\n    {% else %}\n        {% set temp = printer.configfile.config.heater_bed.max_temp %}\n    {% endif %}\n    {% set ratio = printer.heater_bed.temperature / temp|float %}\n    {ratio}, 0.0, {1-ratio}, 0.0\n\n[display_template led_bed_temp_progress]\nparam_led_num:  0\nparam_led_total: 1\ntext:\n    {% if printer.heater_bed.target > 0.0 %}\n        {%  set temp = printer.heater_bed.target %}\n    {% else %}\n        {% set temp = printer.configfile.config.heater_bed.max_temp %}\n    {% endif %}\n    {% set ratio = printer.heater_bed.temperature / temp|float %}\n    {% set led_ratio = param_led_num|float / param_led_total %}\n    {% if ratio > led_ratio %}\n        {led_ratio}, 0.0, 0.0, 0.0\n    {% else %}\n        0.0, 0.0, 0.0, 0.0\n    {% endif %}\n\n[display_template led_print_percent_glow]\ntext:\n    {% set ratio = printer.virtual_sdcard.progress %}\n    0.0, {ratio}, 0.0, 0.0\n\n[display_template led_print_percent_progress]\nparam_led_num:  0\nparam_led_total: 1\ntext:\n    {% set ratio = printer.virtual_sdcard.progress %}\n    {% set led_ratio   = param_led_num|float / param_led_total %}\n    {% if ratio > led_ratio %}\n        0.0, {led_ratio}, 0.0, 0.0\n    {% else %}\n        0.0, 0.0, 0.0, 0.0\n    {% endif %}\n\n[display_template led_printer_speed_glow]\ntext:\n    {% set ratio  = printer.motion_report.live_velocity|float /  printer.configfile.config.printer.max_velocity|float %}\n    0.0, {ratio}, 0.0, 0.0\n\n[display_template led_printer_speed_progress]\nparam_led_num:  0\nparam_led_total: 1\ntext:\n    {% set ratio  = printer.motion_report.live_velocity|float /  printer.configfile.config.printer.max_velocity|float %}\n    {% set led_ratio    = param_led_num|float / param_led_total %}\n    {% if ratio > led_ratio %}\n        0.0, {led_ratio}, 0.0, 0.0\n    {% else %}\n        0.0, 0.0, 0.0, 0.0\n    {% endif %}",
 "gcode_ignore": "# This is to capture the unknown m201 command that cura adds.\n[gcode_macro m201]\ngcode:\n\n# This is to capture the unknown m201 command that cura adds.\n[gcode_macro m202]\ngcode:\n\n# This is to capture the unknown m203 command that cura adds.\n[gcode_macro m203]\ngcode:\n\n# This is to capture the unknown m205 command that cura adds.\n[gcode_macro m205]\ngcode:\n\n# This is to capture the unknown m3001 command that cura adds.\n[gcode_macro m3001]\ngcode:\n\n# This is to capture the unknown G32 command that cura adds.\n[gcode_macro G32]\ngcode:\n\n# This is to capture the unknown M900 command that cura adds.\n[gcode_macro M900]\ngcode:\n\n# This is to capture the unknown M300 command that cura adds.\n[gcode_macro M300]\ngcode:\n\n# This is to capture the unknown M1 command that cura adds.\n[gcode_macro M1]\ngcode:",
 "adaptives_mesh": "[gcode_macro BED_MESH_CALIBRATE]\n# print surface bed mesh calibrate\n# Works with Klicky Probe on Voron\n# November 24, 2021\n# Steve Turgeon\nrename_existing: _BED_MESH_CALIBRATE\n\nvariable_buffer: 5\n\n; Do not change any of the existing values below.\nvariable_last_area_start_x: -1 ; Do not change\nvariable_last_area_start_y: -1 ; Do not change\nvariable_last_area_end_x: -1 ; Do not change\nvariable_last_area_end_y: -1 ; Do not change\n\n# SAMPLE:\n# =======\n# BED_MESH_CALIBRATE PRINT_MIN={params.PRINT_MIN} PRINT_MAX={params.PRINT_MAX} FORCE_PRINT_AREA_BED_MESH=True MIN_PROBE_COUNT=15 (default 5)\n\ngcode:\n\n    {% if params.FORCE_PRINT_AREA_BED_MESH != null %}\n        { action_respond_info(\"Forcing new Mesh every print. If you don't want that, remove Parameter FORCE_PRINT_AREA_BED_MESH! Set to False won't work.\") }\n    {% endif %}\n    {% if printer[\"bed_mesh\"].profile_name == '' %}\n        { action_respond_info(\"No existing bed mesh found.\") }\n        {% set last_area_end_x=-1 %}\n    {% endif %}\n\n    {% if printer.toolhead.homed_axes != \"xyz\" %}\n        G28\n    {% endif %}\n\n    {% set klicky_available = printer['gcode_macro _Probe_Variables'] != null %}\n    {% set euclid_available = printer['gcode_macro EuclidProbe'] != null %}; Requires v5 macros https://github.com/nionio6915/Euclid_Probe/blob/main/Firmware_Examples/Klipper/00-euclid_exampleV5.cfg\n    {% if params.PRINT_MIN %}\n        { action_respond_info(\"print_min: %s\" % params.PRINT_MIN) }\n        { action_respond_info(\"print_max: %s\" % params.PRINT_MAX) }\n        \n        {% set blTouchConfig = printer['configfile'].config[\"bltouch\"] %}\n        {% if blTouchConfig %}\n            {% set OffsetX = blTouchConfig.x_offset|default(0)|float %}\n            {% set OffsetY = blTouchConfig.y_offset|default(0)|float %}\n        {% endif %}\n        \n        {% set probeConfig = printer['configfile'].config[\"probe\"] %}\n        {% if probeConfig %}\n            {% set OffsetX = probeConfig.x_offset|default(0)|float %}\n            {% set OffsetY = probeConfig.y_offset|default(0)|float %}\n        {% endif %}\n\n        {% set print_min_x = params.PRINT_MIN.split(\",\")[0]|float %}\n        {% set print_min_y = params.PRINT_MIN.split(\",\")[1]|float %}\n        {% set print_max_x = params.PRINT_MAX.split(\",\")[0]|float %}\n        {% set print_max_y = params.PRINT_MAX.split(\",\")[1]|float %}\n\n        {% if last_area_start_x > 0 %}\n            { action_respond_info(\"last_bed_mesh: %s,%s %s,%s\" % (last_area_start_x, last_area_start_y, last_area_end_x, last_area_end_y)) }\n        {% endif %}\n\n        {% if (params.FORCE_PRINT_AREA_BED_MESH != null) or (print_min_x < last_area_start_x) or (print_max_x > last_area_end_x) or (print_min_y < last_area_start_y) or (print_max_y > last_area_end_y)  %}\n            {% if klicky_available %}\n                _CheckProbe action=query\n                Attach_Probe\n            {% elif euclid_available %}\n                DEPLOY_PROBE\n            {% endif %}\n            {% if (params.FORCE_PRINT_AREA_BED_MESH != null) or (print_min_x < print_max_x) and (print_min_y < print_max_y) %}\n                # Get bed_mesh config (probe count, mesh_min and mesh_max for x and y\n                {% set bedMeshConfig = printer['configfile'].config[\"bed_mesh\"] %}\n                {% set minimum_probe_count = 3 %}\n                {% if bedMeshConfig.algorithm == \"bicubic\" %}                     \n                     {% set mpc = params.MIN_PROBE_COUNT|default(0)|int %}\n                     {% if mpc > 0 %}\n                        {% set minimum_probe_count = mpc %}\n                    {% else %}\n                        {% set minimum_probe_count = 5 %}\n                    {% endif %}\n                {% endif %}\n                {% set probe_count = bedMeshConfig.probe_count.split(\",\") %}\n                {% set probe_count_x = probe_count[0]|int %}\n                {% if probe_count.__len__() > 1 %}\n                    {% set probe_count_y = probe_count[1]|int %}\n                {% else %}\n                    {% set probe_count_y = probe_count_x|int %}\n                {% endif %}\n                {% set relative_reference_index = bedMeshConfig.relative_reference_index %}\n                {% set mesh_min_x = bedMeshConfig.mesh_min.split(\",\")[0]|float %}\n                {% set mesh_min_y = bedMeshConfig.mesh_min.split(\",\")[1]|float %}\n                {% set mesh_max_x = bedMeshConfig.mesh_max.split(\",\")[0]|float %}\n                {% set mesh_max_y = bedMeshConfig.mesh_max.split(\",\")[1]|float %}\n\n                # If print area X is smaller than 50% of the bed size, change to to 3 probe counts for X instead of the default \n                {% if print_max_x - print_min_x < (mesh_max_x - mesh_min_x) * 0.50 %}\n                    {% set probe_count_x = minimum_probe_count %}\n                {% endif %}\n\n                # If print area Y is smaller than 50% of the bed size, change to to 3 probe counts for Y instead of the default \n                {% if print_max_y - print_min_y < (mesh_max_y - mesh_min_y) * 0.50 %}\n                    {% set probe_count_y = minimum_probe_count %}\n                {% endif %}\n\n                {% if print_min_x - buffer >= mesh_min_x %}\n                    {% set mesh_min_x = print_min_x - buffer %}\n                {% endif %}\n\n                {% if print_min_y - buffer >= mesh_min_y %}\n                    {% set mesh_min_y = print_min_y - buffer %}\n                {% endif %}\n\n                {% if print_max_x + buffer <= mesh_max_x %}\n                    {% set mesh_max_x = print_max_x + buffer %}\n                {% endif %}\n\n                {% if print_max_y + buffer <= mesh_max_y %}\n                    {% set mesh_max_y = print_max_y + buffer %}\n                {% endif %}\n\n                { action_respond_info(\"mesh_min: %s,%s\" % (mesh_min_x, mesh_min_y)) }\n                { action_respond_info(\"mesh_max: %s,%s\" % (mesh_max_x, mesh_max_y)) }\n                { action_respond_info(\"probe_count: %s,%s\" % (probe_count_x,probe_count_y)) }\n\n                ; Set variables so they're available outside of macro\n                SET_GCODE_VARIABLE MACRO=BED_MESH_CALIBRATE VARIABLE=last_area_start_x VALUE={print_min_x}\n                SET_GCODE_VARIABLE MACRO=BED_MESH_CALIBRATE VARIABLE=last_area_start_y VALUE={print_min_y}\n                SET_GCODE_VARIABLE MACRO=BED_MESH_CALIBRATE VARIABLE=last_area_end_x VALUE={print_max_x}\n                SET_GCODE_VARIABLE MACRO=BED_MESH_CALIBRATE VARIABLE=last_area_end_y VALUE={print_max_y}\n\n                {% if printer[\"gcode_macro status_meshing\"] != null %}\n                    status_meshing\n                {% endif %}\n\n                {% if relative_reference_index == 0 or relative_reference_index == null %}\n                    _BED_MESH_CALIBRATE mesh_min={mesh_min_x},{mesh_min_y} mesh_max={mesh_max_x},{mesh_max_y} probe_count={probe_count_x},{probe_count_y}\n                {% else %}\n                    {% set relative_reference_index = ((probe_count_x * probe_count_y - 1) / 2)|int %}\n                    { action_respond_info(\"relative_reference_index: %s\" % relative_reference_index) }\n                    _BED_MESH_CALIBRATE mesh_min={mesh_min_x},{mesh_min_y} mesh_max={mesh_max_x},{mesh_max_y} probe_count={probe_count_x},{probe_count_y} relative_reference_index={relative_reference_index}\n                {% endif %}\n            {% else %}\n                {% if printer[\"gcode_macro status_meshing\"] != null %}\n                    status_meshing\n                {% endif %}\n                _BED_MESH_CALIBRATE\n            {% endif %}\n            {% if klicky_available %}\n                Dock_Probe\n            {% elif euclid_available %}\n                STOW_PROBE\n            {% endif %}\n        {% else %}\n            { action_respond_info(\"No need to recreate Bed Mesh since it's same as current mesh or smaller\") }\n        {% endif %}\n    {% else %}\n        {% if klicky_available %}\n            _CheckProbe action=query\n            Attach_Probe\n        {% elif euclid_available %}\n            STOW_PROBE\n        {% endif %}\n        {% if printer[\"gcode_macro status_meshing\"] != null %}\n            status_meshing\n        {% endif %}\n        _BED_MESH_CALIBRATE\n        {% if klicky_available %}\n            Dock_Probe\n        {% endif %}\n        {% if euclid_available %}\n            STOW_PROBE\n        {% endif %}\n    {% endif %}\n    {% if printer[\"gcode_macro status_ready\"] != null %}\n        status_ready\n    {% endif %}\n"
};
// END STATIC FILES
function staticFiles(s) {
  const f = { z_tasten: STATIC.z_tasten || '', rf_display: '' };
  if (s.rfdisp) {
    f.rf_display = (s.model === 'RF1000' ? STATIC.rf_display_rf1000 : STATIC.rf_display) || '';
    // Kommentar mit dem Ordner dieses Druckers ([save_variables] steht in der printer.cfg)
    f.rf_display = f.rf_display.replace('~/printer_data/config/rf_variables.cfg', `~/${s.dataDir}/config/rf_variables.cfg`);
  }
  return f;
}
// Alle Dateien eines Druckers (Name -> Inhalt) in der Reihenfolge der Reiter
function allFiles(st) {
  if (st.skipr) return skiprFiles(st);
  const sf = staticFiles(st);
  const f = { 'printer.cfg': buildPrinter(st), 'macros.cfg': buildMacros(st) };
  if (st.dual) f['offset_test.cfg'] = buildOffsetTest(st);
  if (st.led) f['rf_led.cfg'] = buildRfLed(st);
  f['z_tasten.cfg'] = sf.z_tasten;
  if (st.rfdisp) f['rf_display.cfg'] = sf.rf_display;
  return f;
}
function readmeFor(st) {
  return [
    `Drucker ${st.pnum} "${st.pname}" (${st.model} ${st.skipr ? 'mit MKS SKIPR, ' + (st.twoin1 ? '2in1-Hotend' : 'Single Extruder') : (st.dual ? 'Dual' : 'Single') + ' Extruder'}, Filament ${st.fil} mm)`,
    '',
    `Zielordner auf dem ${st.skipr ? 'SKIPR' : 'Raspberry Pi'}: ~/${st.dataDir}/config/`,
    `Moonraker-Port ${st.mport}, Mainsail http://IP-ADRESSE${st.pnum === 1 ? '' : ':' + st.wport}`,
    st.pnum === 1 ? 'Das ist der erste Drucker (klipper.service, ~/printer_data).'
                  : `Zuerst mit "sudo rf-multi" unter dem Namen ${st.pname} einrichten, dann die Dateien im Mainsail dieses Druckers unter Maschine hochladen.`,
    '',
    `Slicer (OrcaSlicer): WLAN-Symbol neben dem Druckerprofil, Hosttyp Octo/Klipper, Hostname IP-ADRESSE${st.pnum === 1 ? '' : ':' + st.wport}`,
    '',
    'Alle .cfg-Dateien aus diesem Ordner gehoeren in den Config-Ordner. Die mainsail.cfg',
    'bringt Mainsail selbst mit, sie fehlt hier absichtlich.',
    '',
    'Alle Werte vor dem ersten Start pruefen, die ersten Bewegungen mit der Hand am Not-Halt.',
    ''
  ].join('\r\n');
}

// ---------- Marlin RFxxxx: Configuration.h (Block RF CONFIG CREATOR), Configuration_adv.h, LIESMICH
// Versatz Düse 2 aus der RF-Firmware (Marlin M218, T1 rechts = positiv)
const MOFF = { rf1000: [33.9, 0.1], rf2000: [33.9, 0.1], rf2000v2: [33.6, 0] };
// DMS-Vorgaben je Firmware: Klipper in LCP_READ-Einheiten, Marlin in Digits der RF-Firmware
const DMS_DEF = {
  klipper: { eon: true, emin: -6000, emax: 6000, fon: true, fmin: 4000, fmax: 5000, fpct: 30, vpct: 30 },
  marlin:  { eon: true, emin: -11000, emax: 11000, fon: false, fmin: 770, fmax: 1540, fpct: 30, vpct: 30 }
};
const MMODEL = { rf1000: 'RF_MODEL_RF1000', rf2000: 'RF_MODEL_RF2000', rf2000v2: 'RF_MODEL_RF2000V2' };
const MREPO = 'https://github.com/Dennis02121978/Marlin-RFxxxx';
function marlinBlock(s) {
  const I = v => String(Math.round(v));
  const d = (on, name, val, c) => { const t = (on ? '' : '//') + '#define ' + name + (val === '' ? '' : ' ' + val); return c ? t.padEnd(38) + ' // ' + c : t; };
  const g = s.guard;
  return [
    '// ==== BEGIN RF CONFIG CREATOR ====',
    '// Renkforce Configurator (Marlin): ' + s.model + ', ' + (s.dual ? 'Dual' : 'Single') + ' Extruder, Filament ' + s.fil + ' mm',
    d(true, 'RF_MODEL', MMODEL[s.mkey] || 'RF_MODEL_RF2000'),
    d(s.dual, 'RF_DUAL_EXTRUDER', ''),
    d(true, 'RF_FILAMENT_DIA', s.fil, 'mm'),
    d(true, 'RF_X_MAX', I(s.xmax), 'mm, X travel (RF Repetier X_MAX_LENGTH_PRINT)'),
    d(true, 'RF_Y_MAX', I(s.ymax), 'mm, Y travel (RF Repetier Y_MAX_LENGTH)'),
    d(true, 'RF_Z_MAX', I(s.zmax), 'mm, Z travel (RF Repetier Z_MAX_LENGTH)'),
    d(true, 'RF_E_STEPS', fmt(s.esteps), 'extruder steps/mm (32 microsteps)'),
    d(s.dual, 'RF_T1_OFFSET_X', fmt(s.offx), 'mm, nozzle 2 (dual)'),
    d(s.dual, 'RF_T1_OFFSET_Y', fmt(s.offy), 'mm'),
    d(true, 'RF_PREHEAT_HOTEND', I(s.ftemp), 'C, preheat 1'),
    d(true, 'RF_PREHEAT_BED', I(s.fbed), 'C'),
    d(s.led, 'RF_RGB_LIGHT', '', 'RGB light (RF2000 / RF2000 v2)'),
    d(true, 'RF_EMERGENCY_PAUSE_MIN', I(g ? s.emin : 0), 'digits, 0 = off (M3075 L)'),
    d(true, 'RF_EMERGENCY_PAUSE_MAX', I(g ? s.emax : 0), 'digits, 0 = off (M3075 H)'),
    d(true, 'RF_FLOW_COMP_FLOW_PERCENT', I(g ? s.fpct : 0), '%, 0 = off (M3911 S)'),
    d(true, 'RF_FLOW_COMP_FEED_PERCENT', I(g ? s.vpct : 0), '%, 0 = off (M3911 F)'),
    d(true, 'RF_FLOW_COMP_MIN', I(s.fmin || 770), 'digits (M3911 L)'),
    d(true, 'RF_FLOW_COMP_MAX', I(s.fmax || 1540), 'digits (M3911 H)'),
    '// ==== END RF CONFIG CREATOR ===='
  ].join('\n');
}
function buildMarlinCfg(s) {
  const t = STATIC.marlin_cfg || '';
  const a = t.indexOf('// ==== BEGIN RF CONFIG CREATOR ===='), b = t.indexOf('// ==== END RF CONFIG CREATOR ====');
  if (a < 0 || b < a) return '// Vorlage fehlt: sync_files.py ausführen';
  return t.slice(0, a) + marlinBlock(s) + t.slice(b + '// ==== END RF CONFIG CREATOR ===='.length);
}
function buildMarlinReadme(s) {
  const v = `${s.model} ${s.dual ? 'Dual' : 'Single'}`;
  return [
    `Marlin RFxxxx fuer ${v} Extruder, Filament ${s.fil} mm`,
    `Erzeugt mit dem Renkforce Configurator (Marlin). Quellcode: ${MREPO}`,
    '',
    'Inhalt:',
    '  Configuration.h       deine Einstellungen (Block RF CONFIG CREATOR)',
    '  Configuration_adv.h   erweiterte Einstellungen (Motorstrom, DMS, Tasten, Startbild)',
    '',
    '1. Quellcode laden: ' + MREPO + ' -> Code -> Download ZIP, entpacken.',
    '2. Beide Dateien nach Marlin/ kopieren (die vorhandenen ersetzen).',
    '3. Mit PlatformIO bauen, NUR mit der Umgebung mega2560ext:',
    '     pio run -e mega2560ext',
    '   Ergebnis: .pio/build/mega2560ext/firmware.hex',
    '   (Mit env:mega2560 bleibt das Display dunkel.)',
    '',
    '4. Host stoppen (Repetier-Server, OctoPrint, Klipper), Drucker per USB anschliessen.',
    '   Altes EEPROM sichern (fuer eine Rueckkehr zur RF-Firmware):',
    '     avrdude -patmega2560 -cwiring -P/dev/ttyUSB0 -b115200 -Ueeprom:r:eeprom_repetier.hex:i',
    '   Flashen:',
    '     avrdude -patmega2560 -cwiring -P/dev/ttyUSB0 -b115200 -D -Uflash:w:firmware.hex:i',
    '   Windows: XLoader oder Cura (Firmware aktualisieren, Benutzerdefiniert), 115200 Baud.',
    '',
    '5. Nach dem ersten Start: M500 (neues EEPROM-Layout).',
    '   Heizbett-Scan mit Aufsicht: M3010 (oder Menue Konfiguration -> Z Kalibrierung -> Matrix Scan), danach M3001.',
    '   PID: Menue Konfiguration -> Temperaturen PID.',
    s.dual ? `   Duesenversatz pruefen: M218 T1 X${fmt(s.offx)} Y${fmt(s.offy)} ist eingestellt, mit Testdruck kontrollieren.` : '',
    '',
    'Host-Verbindung: 250000 Baud, Firmware-Typ Marlin.',
    `Ohne eigene Werte gibt es fertige Firmware unter ${MREPO}/releases/latest`,
    '',
    'Ohne Gewaehr. Alle Werte vor dem ersten Start pruefen, die ersten Bewegungen mit der Hand am Hauptschalter.',
    ''
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\r\n');
}
function marlinFiles(s) {
  return { 'Configuration.h': buildMarlinCfg(s), 'Configuration_adv.h': STATIC.marlin_adv || '', 'LIESMICH.txt': buildMarlinReadme(s) };
}

// Abschnitte für Notfall-Pause, Flow-Kompensation und die Digits-Kurve (nur wenn gewählt)
function guardBlock(s) {
  if (!s.guard) return '';
  let o = `[rf1000_pressure_guard]
# Notfall-Pause und Flow-Kompensation per DMS (Modul rf1000_pressure_guard.py).
# Werte in der Einheit von LCP_READ. 0 = aus.${s.digits ? ' Muss VOR [temperature_sensor Digits] stehen.' : ''}
emergency_min: ${fmt(s.emin)}
emergency_max: ${fmt(s.emax)}
emergency_samples: ${s.esamp}
pause_gcode: PAUSE
flow_min: ${fmt(s.fmin)}
flow_max: ${fmt(s.fmax)}
flow_percent: ${fmt(s.fpct)}
feed_percent: ${fmt(s.vpct)}
flow_min_z: ${fmt(s.fminz)}


`;
  if (s.digits) o += `[temperature_sensor Digits]
# DMS-Kraft als Kurve in Mainsail (Einheit dort fest: °C)
sensor_type: rf1000_force


`;
  return o;
}

function extruderBlock(s, name, o) {
  return `[${name}]
step_pin: ${o.step}
dir_pin: ${o.dir}
enable_pin: ${o.en}
microsteps: 32
rotation_distance: ${fmt(s.rot)}
nozzle_diameter: ${fmt(s.nozzle)}
filament_diameter: ${s.fil}
min_temp: 0
max_temp: 260
min_extrude_temp: 170
heater_pin: ${o.heater}
sensor_type: EPCOS 100K B57550G0104
sensor_pin: ${o.sensor}
pullup_resistor: 4700
inline_resistor: 0
pressure_advance: 0.1
control: pid
pid_kp: 38.710
pid_ki: 2.412
pid_kd: 155.323
max_extrude_cross_section: 50.0
max_extrude_only_distance: 50.0


[drv8711 ${name}]
cs_pin: ${o.cs}
spi_software_sclk_pin: PD5
spi_software_miso_pin: PD4
spi_software_mosi_pin: PD6
current: 1.8
`;
}

// Pins, die beim RF1000 anders verdrahtet sind (Repetier pins.h, DEVICE_TYPE_RF1000)
function boardPins(s) {
  return s.model === 'RF1000'
    ? { xstop: '!PE5', ystop: '!PE4', zstep: 'PL3', zcs: 'PL4', bed: 'PH5', d6: 'PL5', d7: 'PK4', down: '!PE3', right: '!PH3' }
    : { xstop: '!PC2', ystop: '!PC0', zstep: 'PF3', zcs: 'PB6', bed: 'PE2', d6: 'PA1', d7: 'PJ3', down: '!PB7', right: '!PH0' };
}

function buildPrinter(s) {
  const heaters = s.dual ? 'extruder,extruder1,heater_bed' : 'extruder,heater_bed';
  const P = boardPins(s), rf1000 = s.model === 'RF1000';
  let o = `# Renkforce ${s.model} ${s.dual ? 'Dual' : 'Single'} Extruder, Filament ${s.fil} mm
# Erzeugt mit dem Renkforce Configurator
# Wer ein anderes Hotend benutzt, bitte die Rotation Distance anpassen.
${s.pnum > 1 ? `#
# MEHRERE DRUCKER: Das ist Drucker ${s.pnum} "${s.pname}" an einem Raspberry Pi (Paket rf-multi).
# Config-Ordner ~/${s.dataDir}/config, Moonraker-Port ${s.mport}, Mainsail http://<IP>:${s.wport}
` : ''}#
# HAFTUNGSAUSSCHLUSS: Diese Config wird ohne jede Gewaehr bereitgestellt. Die Nutzung
# erfolgt auf eigene Gefahr, eine Haftung fuer Schaeden an Drucker, Umgebung oder
# Personen ist ausgeschlossen. Alle Werte (Pins, Maße, Endstops, Temperaturen) vor der
# Inbetriebnahme selbst pruefen, die ersten Bewegungen mit der Hand am Not-Halt machen.
#
# PIN INVERTIEREN: Ein "!" vor dem Pin kehrt dessen Logik um, z.B. "!PC6" statt "PC6".
# Meldet QUERY_ENDSTOPS im Ruhezustand "triggered", obwohl der Endstop frei ist (oder
# umgekehrt), das "!" einfach entfernen bzw. hinzufuegen. Ohne diesen Test kann die
# Achse in den Anschlag fahren.

[mcu]
serial: ${s.serial}


[exclude_object]

[include mainsail.cfg]
[include macros.cfg]${s.dual ? '\n[include offset_test.cfg]' : ''}
[include z_tasten.cfg]${s.rfdisp ? '\n[include rf_display.cfg]' : ''}${s.led ? '\n[include rf_led.cfg]' : ''}

[printer]
kinematics: cartesian
max_velocity: 200
max_accel: 1500
max_z_velocity: 50
max_z_accel: 70

[safe_z_home]
home_xy_position: 0,-5
z_hop: 2

[force_move]
enable_force_move: True

[stepper_x]
step_pin: PF0
dir_pin: !PF1
enable_pin: PD7
rotation_distance: 42
microsteps: 32
endstop_pin: ${P.xstop}
position_endstop: 0
position_min: 0
position_max: ${fmt(s.xmax)}
homing_speed: 40.0
second_homing_speed: 10.0

[drv8711 stepper_x]
cs_pin: PL0
spi_software_sclk_pin: PD5
spi_software_miso_pin: PD4
spi_software_mosi_pin: PD6
current: 2


[stepper_y]
step_pin: PF6
dir_pin: PF7
enable_pin: PF2
rotation_distance: 42
microsteps: 32
endstop_pin: ${P.ystop}
# Y=0 ist die Vorderkante des Betts, beim Home-Schalter steht die Duese ${fmt(s.yhome)} mm davor
# position_max = Fahrweg ab Schalter (${fmt(s.ytravel)} mm) minus ${fmt(s.yhome)} mm
position_endstop: ${fmt(-s.yhome)}
position_min: ${fmt(-s.yhome)}
position_max: ${fmt(s.ymax)}
homing_speed: 35.0
second_homing_speed: 10.0

[drv8711 stepper_y]
cs_pin: PL2
spi_software_sclk_pin: PD5
spi_software_miso_pin: PD4
spi_software_mosi_pin: PD6
current: 2

[stepper_z]
step_pin: ${P.zstep}
dir_pin: PL1
enable_pin: PK0
rotation_distance: 2.5
microsteps: 32
endstop_pin: ${s.zpin}
# Endstop liegt bei Z=0. Mit position_min wird festgelegt, wie weit die Achse
# darunter weiterfahren darf (Ueberfahrweg), weil der Schalter erst ausloest,
# wenn der Tisch schon etwas unter der Duese liegt.
# ${s.light ? 'Lichtschranke: ca. 1,2 mm Ueberfahrweg' : 'Mechanischer Endschalter: ca. 0,8 mm Ueberfahrweg'}
position_endstop: 0
position_min: ${fmt(s.zmin)}
position_max: ${fmt(s.zmax)}
homing_speed: 8.0
second_homing_speed: 2.0

[drv8711 stepper_z]
cs_pin: ${P.zcs}
spi_software_sclk_pin: PD5
spi_software_miso_pin: PD4
spi_software_mosi_pin: PD6
current: 2

`;
  o += extruderBlock(s, 'extruder', { step: 'PA4', dir: 'PA6', en: 'PA2', heater: 'PB4', sensor: 'PK5', cs: 'PL6' });
  if (s.dual) {
    o += `
################################################################################################
# Zweiter Extruder                                                                             #
################################################################################################
`;
    o += extruderBlock(s, 'extruder1', { step: 'PC1', dir: '!PC3', en: 'PC7', heater: 'PH6', sensor: 'PK6', cs: 'PJ7' });
  }
  o += `
################################################################################################

[thermistor EPCOS 100K B57550G0104]
temperature1: 25
resistance1: 100000
beta: 4150

[heater_bed]
control: pid
pid_kp: 58.098
pid_ki: 0.656
pid_kd: 1285.418
heater_pin: ${P.bed}
sensor_type: EPCOS 100K B57550G0104
sensor_pin: PK7
min_temp: 5
max_temp: 130


[fan]
pin: PA5
max_power: 1.0
kick_start_time: 0.100

${rf1000 ? `# Der RF1000 hat keinen eigenen Gehaeuseluefter-Ausgang (in der RF-Firmware nur
# bei Single Extruder auf dem Heizausgang des zweiten Extruders, PH6).
` : `[controller_fan fan2]
pin: PF4
fan_speed: 0.5
heater: ${heaters}
`}
`;
  if (s.led) o += `[led led]
red_pin: PH3
green_pin: PH4
blue_pin: PH5
cycle_time: 0.010
hardware_pwm: False
initial_RED: 1.0
initial_GREEN: 1.0
initial_BLUE: 1.0


`;
  o += `[virtual_sdcard]
path: ~/${s.dataDir}/gcodes

# SD-Karte im Kartenleser des Druckers (Modul rf_sdcard aus dem Klipper-Fork).
# Display: SD Karte > Drucke Datei > SD-Karte. Konsole: RF_SD_LIST, RF_SD_PRINT FILE=...
# Gedruckt wird eine Kopie im G-Code-Ordner (Unterordner SD-Karte).
[rf_sdcard]
cs_pin: PB0
${s.model === 'RF1000' ? '# Der RF1000 hat keine Kartenerkennung: die Karte wird beim Oeffnen des Menues gesucht\n' : 'detect_pin: ^!PD2\n'}${s.rfdisp ? `
# Einstellungen aus dem Display-Menue (rf_display.cfg), wie im EEPROM der RF-Firmware
[save_variables]
filename: ~/${s.dataDir}/config/rf_variables.cfg
` : ''}
[pause_resume]

[display]
lcd_type: hd44780
rs_pin: PK1
e_pin: PK3
d4_pin: PF5
d5_pin: PK2
d6_pin: ${P.d6}
d7_pin: ${P.d7}
${rf1000 ? 'line_length: 16\n' : ''}${s.rfdisp ? `# Startanzeige und Menue wie in der RF-Repetier-Firmware (rf_display.cfg)
display_group: rf_splash
menu_root: rf
menu_pages: rf_page1, rf_page_mod, rf_page2, rf_page3, rf_page4
${rf1000 ? `# RF1000-Display: 16x4, Zurueck-Taste statt ".."-Eintrag, japanischer Zeichensatz (A00) fuer Umlaute
menu_show_back: False
hd44780_charset: a00` : `# RF2000-Display: 20x4, Zurueck-Taste statt ".."-Eintrag, westlicher Zeichensatz fuer Umlaute
menu_show_back: False
hd44780_charset: western`}
# Werte im Menue aendern: Taste hoch erhoeht, Taste runter verringert
menu_reverse_input: True` : 'display_group: _default_16x4'}

#RE=TAST3:${P.right.slice(1)}, Ok=TAST1:PG5, DN=TAST2:${P.down.slice(1)}, LE=TAST4:PB5, UP=TAST5:PL7,
#PAUSE=TAST_E6:PH2, Z-DN=TAST_E2:PJ4, CONT=TAST_E5:PH7,
#F_REV=TAST_E3:PJ5, F-FWD=TAST_E4:PJ6, Z-UP=TAST_E1:PJ2
click_pin: !PG5
back_pin: !PB5
up_pin: !PL7
down_pin: ${P.down}
#kill_pin: ${P.right} # This is the right arrow key, otherwise unused



[ads1100 load_cell]
gain: 2

${guardBlock(s)}[rf1000_load_cell_probe]
adc: load_cell:None
adc_rate: 16
max_abs_force: 5000
# Bereichsschutz des ADC: Shutdown erst oberhalb dieses Werts. Muss ueber den Grenzen der Notfall-Pause liegen,
# sonst stoppt Klipper (ADC out of range) statt zu pausieren. Messkraft beim PROBE bleibt durch max_abs_force bestimmt.
adc_max_abs_force: 8000
noise_level = 1.5
force_calibration = 8500
stiffness = 6200


[bed_mesh]
speed: 100
horizontal_move_z: 2
mesh_min: 10,50
mesh_max: ${fmt(s.xmax)},${fmt(s.meshy)}
algorithm: ${s.model === 'RF2000 v2' ? 'bicubic' : 'lagrange'}
probe_count: ${s.model === 'RF2000 v2' ? '6,9' : '5,5'}
fade_start: 1.0
fade_end: 10.0


[z_sense_offset]
# Sense Offset: hebt das Bett im ersten Layer an, wenn die Kraft ueber der Schwelle liegt.
# Wird mit Z_SENSE_OFFSET in PRINT_START eingeschaltet (Homing schaltet ihn wieder aus).
force_threshold: 4000
max_z_offset: 0.2
max_z_height: 0.33


[display_template _load_cell_digits]
text:
  { "F%5d" % (printer["rf1000_load_cell_probe"].last_force) }

[display_data _default_16x4 load_cell_digits]
position: 0, 10
text: { render("_load_cell_digits") }

# Zeile 4: Statustext, rechts der Sense Offset in mm (S0.000), solange er an ist oder einen Wert hat
[display_data _default_16x4 print_status]
position: 3, 0
# (eine Zeile, damit keine Leerzeichen aus der Vorlage mitgezaehlt werden)
text:
  {% set so = printer.z_sense_offset %}{% set st = render("_print_status")|trim %}{% if so.enabled or so.z_offset > 0 %}{ "%-10.10s" % st }{ "S%5.3f" % so.z_offset }{% else %}{ st }{% endif %}
`;
  return o;
}

// Eigene Include-Datei offset_test.cfg (nur Dual): Testdruck und Korrektur des Duesenversatzes
function buildOffsetTest(s) {
  // Schichthoehe = halber Duesendurchmesser (mind. 0.1), Linienbreite = 1.25 x Duese
  const offH = Math.max(0.1, Math.round(s.nozzle * 0.5 * 100) / 100);
  const offE = Math.round(s.nozzle * 1.25 * offH / (Math.PI * Math.pow(parseFloat(s.fil) / 2, 2)) * 100000) / 100000;
  return `################################################################################
# Duesenversatz-Test fuer ${s.model} Dual Extruder (erzeugt mit dem Config Creator)
# Wird in der printer.cfg mit [include offset_test.cfg] eingebunden.
# Braucht die Makros T0 und T1 aus der macros.cfg.
################################################################################

# ---------------------- Duesenversatz einstellen ----------------------
# 0) Aufruf: OFFSET_TEST  (Vorgabe aus dem Creator: ${fmt(s.ftemp)} Grad, Bett ${fmt(s.fbed)} Grad)
#            OFFSET_TEST MATERIAL=PLA  (195 Grad, Bett 65 Grad)
#            OFFSET_TEST MATERIAL=PETG (220 Grad, Bett 75 Grad)
#            OFFSET_TEST BED_TEMP=70 TEMP0=205 TEMP1=205  (manuell, TEMP= setzt beide Duesen)
# 1) OFFSET_TEST druckt zwei Messfelder (Duese ${fmt(s.nozzle)} mm, Filament ${s.fil} mm):
#    11 Linien je Richtung. T0 druckt die untere Haelfte, T1 die obere Haelfte jeder Linie.
#    Linie 6 liegt genau auf dem aktuellen Versatz, jede Linie daneben ist um 0.1 mm verschoben.
#    Die Linie, bei der oben und unten ohne Knick ineinander uebergehen, zeigt die Korrektur:
#    Korrektur = (Linien-Nr - 6) x 0.1 mm.
# 2) NOZZLE_OFFSET_ADJUST X=<Korrektur> Y=<Korrektur> uebernimmt sie bis zum Neustart.
# 3) Danach den angezeigten Wert dauerhaft in [gcode_macro T1] (variable_offset_x/y) eintragen.
[gcode_macro OFFSET_TEST]
description: Duesenversatz-Testdruck (MATERIAL=PLA oder PETG, oder manuell BED_TEMP/TEMP0/TEMP1)
gcode:
    # Vorgabe aus dem Creator: ${s.ftype === 'pla' ? 'PLA' : s.ftype === 'petg' ? 'PETG' : 'manuell'}, ${fmt(s.ftemp)} Grad, Bett ${fmt(s.fbed)} Grad.
    # MATERIAL=PLA (195/65) oder MATERIAL=PETG (220/75) ueberschreibt die Vorgabe,
    # manuelle Werte ueberschreiben alles, z.B. OFFSET_TEST BED_TEMP=70 TEMP0=205 TEMP1=205
    {% set mat = params.MATERIAL|default("")|upper %}
    {% if mat not in ["", "PLA", "PETG"] %}
    {action_raise_error("MATERIAL muss PLA oder PETG sein. Fuer andere Werte BED_TEMP, TEMP0 und TEMP1 angeben.")}
    {% endif %}
    {% set pext = 220.0 if mat == "PETG" else (195.0 if mat == "PLA" else ${fmt(s.ftemp)}) %}
    {% set pbed = 75.0 if mat == "PETG" else (65.0 if mat == "PLA" else ${fmt(s.fbed)}) %}
    {% set bed = params.BED_TEMP|default(pbed)|float %}
    {% set t0 = params.TEMP0|default(params.TEMP|default(pext))|float %}
    {% set t1 = params.TEMP1|default(params.TEMP|default(pext))|float %}
    {% set h = ${fmt(offH)} %}
    {% set epm = ${fmt(offE)} %}
    {% set x0 = 25.0 %}
    {% set y0 = 30.0 %}
    {% set bx = 110.0 %}
    {% set by = 30.0 %}

    {% if "xyz" not in printer.toolhead.homed_axes %}
    G28
    {% endif %}
    BED_MESH_PROFILE LOAD="default"
    M140 S{bed}
    SET_HEATER_TEMPERATURE HEATER=extruder TARGET={t0}
    SET_HEATER_TEMPERATURE HEATER=extruder1 TARGET={t1}
    M190 S{bed}
    TEMPERATURE_WAIT SENSOR=extruder MINIMUM={t0 - 3}
    TEMPERATURE_WAIT SENSOR=extruder1 MINIMUM={t1 - 3}
    M83

    # Erst Duese 1 (Referenz), dann Duese 2 mit dem Versatz aus T1
    {% for tool in [0, 1] %}
      {% if tool == 0 %}
      T0
      {% else %}
      T1
      {% endif %}
      # Feld X: senkrechte Linien, Abstand 5 mm
      {% for i in range(11) %}
        {% set xv = x0 + i * 5 + (i - 5) * 0.1 * tool %}
        {% set ya = y0 + 10 * tool %}
        G1 Z{h + 0.5} F3000
        G1 X{"%.2f" % xv} Y{"%.2f" % ya} F6000
        G1 Z{h} F600
        G1 E0.4 F1800
        G1 Y{"%.2f" % (ya + 10)} E{"%.4f" % (10 * epm)} F1200
        G1 E-0.4 F1800
      {% endfor %}
      # Feld Y: waagerechte Linien, Abstand 5 mm
      {% for i in range(11) %}
        {% set yv = by + i * 5 + (i - 5) * 0.1 * tool %}
        {% set xa = bx + 10 * tool %}
        G1 Z{h + 0.5} F3000
        G1 X{"%.2f" % xa} Y{"%.2f" % yv} F6000
        G1 Z{h} F600
        G1 E0.4 F1800
        G1 X{"%.2f" % (xa + 10)} E{"%.4f" % (10 * epm)} F1200
        G1 E-0.4 F1800
      {% endfor %}
    {% endfor %}

    G1 Z10 F3000
    T0
    TURN_OFF_HEATERS
    M82
    G92 E0
    G1 X0 Y0 F6000
    RESPOND MSG="Fertig. Linie 6 = aktueller Versatz. Beste Linie ablesen: Korrektur = (Nr - 6) x 0.1 mm. Dann NOZZLE_OFFSET_ADJUST X=.. Y=.. ausfuehren."


[gcode_macro NOZZLE_OFFSET_ADJUST]
description: Duesenversatz von T1 aendern (X/Y = Korrektur in mm aus dem OFFSET_TEST)
gcode:
    {% set nx = printer["gcode_macro T1"].offset_x|float + params.X|default(0)|float %}
    {% set ny = printer["gcode_macro T1"].offset_y|float + params.Y|default(0)|float %}
    SET_GCODE_VARIABLE MACRO=T1 VARIABLE=offset_x VALUE={nx}
    SET_GCODE_VARIABLE MACRO=T1 VARIABLE=offset_y VALUE={ny}
    {% if printer.toolhead.extruder == "extruder1" %}
    SET_GCODE_OFFSET X={nx} Y={ny} MOVE=0
    {% endif %}
    RESPOND MSG="Neuer Versatz T1: X={"%.2f" % nx} Y={"%.2f" % ny} (gilt bis zum Neustart). Dauerhaft in macros.cfg bei [gcode_macro T1] eintragen."
`;
}

function buildMacros(s) {
  const f = Math.pow(1.75 / parseFloat(s.fil), 2);   // gleiches Volumen bei dickerem Filament
  const prime1 = Math.round(13 * f * 10) / 10, prime2 = Math.round(25 * f * 10) / 10, prime3 = Math.round(37 * f * 10) / 10;
  const parkY = s.ymax - 5;
  const parkZ = s.zmax - 5;
  const led = (r, g, b) => `    SET_LED LED="led" RED=${r} GREEN=${g} BLUE=${b} SYNC=0 TRANSMIT=1`;

  let o = `################################################################################
# Makros für ${s.model} ${s.dual ? 'Dual' : 'Single'} Extruder (erzeugt mit dem Config Creator)
# - PAUSE: Speichert den Zustand, fährt den Kopf weg und verlängert das Timeout.
# - RESUME: Kehrt zum Druck zurück, stellt Filament und Zustand wieder her.
# - M600: Filamentwechsel-Assistent (ruft PAUSE auf).
################################################################################

[pause_resume]
# Geschwindigkeit, mit der der Werkzeugkopf beim Wiederherstellen aus einer Pause
# fahren darf. Ein niedriger Wert sorgt für sanftere Rückkehr.
recover_velocity: 50.0

[gcode_macro PAUSE]
description: Pausiert den Druck, parkt den Kopf sicher. Ignoriert erneutes Drücken.
rename_existing: PAUSE_BASE
variable_extrude: 1.0
gcode:
    # Nur ausführen, wenn NICHT bereits pausiert
    {% if not printer.pause_resume.is_paused %}

        ##### Parameter #####
        {% set z_hop = params.Z|default(10)|float %} ; Z-Anhebung

        ##### Berechnung der Parkpositionen #####
        {% set max_x = printer.toolhead.axis_maximum.x|float %}
        {% set max_y = printer.toolhead.axis_maximum.y|float %}
        {% set max_z = printer.toolhead.axis_maximum.z|float %}
        {% set act_z = printer.toolhead.position.z|float %}

        # Parkposition: Max - 10mm Puffer
        {% set x_park = max_x - 10.0 %}
        {% set y_park = max_y - 10.0 %}

        # Nicht über Max-Z hinausfahren beim Hop
        {% if act_z < (max_z - z_hop) %}
            {% set z_safe = z_hop %}
        {% else %}
            {% set z_safe = max_z - act_z %}
        {% endif %}

        ##### Hauptlogik #####
        PAUSE_BASE

        # WICHTIG: Status speichern BEVOR wir wegfahren!
        SAVE_GCODE_STATE NAME=PAUSE_STATE
`;
  if (s.dual) o += `        # Parken ohne Duesenversatz, RESUME stellt ihn wieder her
        SET_GCODE_OFFSET X=0 Y=0 MOVE=0
`;
  o += `
        G91

        # Retract, wenn Extruder heiß genug ist
        {% if printer[printer.toolhead.extruder].can_extrude|lower == 'true' %}
            G1 E-{extrude} F2100
        {% else %}
            {action_respond_info("Extruder nicht heiß genug")}
        {% endif %}

        # Z anheben und zur Parkposition fahren
        {% if "xyz" in printer.toolhead.homed_axes %}
            G1 Z{z_safe} F900
            G90
            G1 X{x_park} Y{y_park} F6000
        {% else %}
            {action_respond_info("Drucker nicht gehomed")}
        {% endif %}

        # Timeout massiv verlängern (12h)
        SET_IDLE_TIMEOUT TIMEOUT=43200

        RESPOND MSG="Druck pausiert. Kopf geparkt."

    {% else %}
        RESPOND MSG="Druck ist bereits pausiert - Befehl ignoriert."
    {% endif %}

[gcode_macro RESUME]
description: Setzt den Druck fort und stellt Position wieder her
rename_existing: RESUME_BASE
gcode:
    ##### Parameter #####
    {% set e = params.E|default(1)|float %} ; Extra Filament beim Start (Purge)

    #### Status wiederherstellen #####
    {% set default_timeout = printer.configfile.settings.idle_timeout.timeout|default(600) %}
    SET_IDLE_TIMEOUT TIMEOUT={default_timeout}

    G91

    # Filament wieder vorschieben (Prime), wenn heiß genug
    {% if printer[printer.toolhead.extruder].can_extrude|lower == 'true' %}
        G1 E{e} F2100
    {% else %}
        {action_respond_info("Extruder nicht heiß genug")}
    {% endif %}

    # MOVE=1 fährt zur alten XYZ Position zurück (MOVE_SPEED in mm/s)
    RESTORE_GCODE_STATE NAME=PAUSE_STATE MOVE=1 MOVE_SPEED=100

    RESUME_BASE
    RESPOND MSG="Druck fortgesetzt."

[gcode_macro CANCEL_PRINT]
description: Bricht den Druck sicher ab
rename_existing: CANCEL_PRINT_BASE
gcode:
    TURN_OFF_HEATERS
    CLEAR_PAUSE
    SDCARD_RESET_FILE

    ##### Berechnung der Positionen #####
    {% set max_x = printer.toolhead.axis_maximum.x|float %}
    {% set max_y = printer.toolhead.axis_maximum.y|float %}
    {% set max_z = printer.toolhead.axis_maximum.z|float %}
    {% set act_z = printer.toolhead.position.z|float %}

    {% set x_park = max_x - 10.0 %}
    {% set y_park = max_y - 10.0 %}

    # Sicherer Z-Hop beim Abbruch
    {% if act_z < (max_z - 10) %}
        G91
        G1 Z10 F900
    {% endif %}

    G90
`;
  if (s.dual) o += `    SET_GCODE_OFFSET X=0 Y=0 MOVE=0
`;
  o += `    G1 X{x_park} Y{y_park} F6000

    M84 ; Motoren aus
    CANCEL_PRINT_BASE
    RESPOND MSG="Druck abgebrochen."


[gcode_macro M600]
description: Filamentwechsel-Assistent (ruft PAUSE auf, bewegt und wartet)
gcode:
    ##### Parameter #####
    {% set X = params.X|default(50)|float %}        ; X-Position zum Parken
    {% set Y = params.Y|default(50)|float %}        ; Y-Position zum Parken
    {% set Z = params.Z|default(10)|float %}        ; Z-Hop

    PAUSE
    G91
    G1 E-5 F2700
    G1 Z{Z} F1000
    G90
    G1 X{X} Y{Y} F6000

    RESPOND MSG="M600: Filamentwechsel. Wechseln Sie das Filament, und rufen Sie dann RESUME auf."


############################
#  Druck Start und Ende
############################

# --------------------------- Start Print ----------------------------
[gcode_macro PRINT_START]
gcode:
    # Absolute Werte fuer die Prime Line
    G90
    M82
`;
  if (s.dual) o += `    SET_GCODE_OFFSET X=0 Y=0 MOVE=0
`;
  if (s.led) o += `
    # LED auf Rot (Druck startet)
${led(1, 0, 0)}
`;
  o += `
    # Homen aller Achsen
    G28 F1500

    # Mesh laden (optional, kann auch vorher neu kalibriert werden)
    BED_MESH_PROFILE LOAD="default"

    # Temperaturen aus Übergabeparametern
    {% set Betttemperatur = params.BED_TEMP|float %}
    {% set Extrudertemperatur = params.EXTRUDER_TEMP|float %}

    M117 Heize Bett und Hotend...

    M190 S{Betttemperatur}
    M109 S{Extrudertemperatur}
`;
  if (s.hp) o += `
    # Heissmessung: Hotend dehnt sich aus, Z-Offset an zufaelligem Punkt (${fmt(s.hpmin)} bis ${fmt(s.hpmax)} mm) neu bestimmen
    M117 Hotend ausdehnen lassen...
    G4 P${Math.round(s.hpwait * 1000)}
    HOT_Z_PROBE MIN=${fmt(s.hpmin)} MAX=${fmt(s.hpmax)}
`;
  o += `
    # Sense Offset einschalten (nach G28 noetig, Homing schaltet ihn aus; setzt den Offset auf 0)
    # Im Display-Menue unter DMS Features > SenseOffset > AutoStart abschaltbar
    {% set sv = printer.save_variables.variables if 'save_variables' in printer else {} %}
    {% if sv.rf_sense_autostart|default(1)|int %}
    Z_SENSE_OFFSET
    {% else %}
    RESPOND MSG="Sense Offset: AutoStart aus"
    {% endif %}
`;
  if (s.led) o += `
    # LED auf Lila/Blau = Bereit
${led(1, 0.2353, 0.8824)}
`;
  o += `
    # Extruder zurücksetzen & leichter Retract
    G92 E0
    G1 E-1 F1800
    G1 F300 E-0.5

    # Prime Line (Menge auf ${s.fil} mm Filament umgerechnet): rechts nach links bei Y3,
    # 1 mm versetzt bei Y4 wieder zurueck, damit mehr Material durch die Duese geht
    G1 X${Math.min(180, s.xmax - 20)} Y3 Z0.35 F5000
    G1 F800 E${prime1}
    G1 X20 E${prime2} F1000
    G1 Y4 F1000
    G1 X${Math.min(180, s.xmax - 20)} E${prime3} F1000

    G92 E0

    # Z etwas anheben
    G1 Z2.0 F3000
`;
  if (s.dual) o += `
    # Duesenversatz des aktiven Werkzeugs wieder setzen
    {% if printer.toolhead.extruder == "extruder1" %}
    T1
    {% else %}
    T0
    {% endif %}
`;
  o += `
    M117 ${s.model} Klipper bereit!
# --------------------------------------------------------------------


# ---------------------------- End Print -----------------------------
[gcode_macro PRINT_END]
gcode:
    {% set z = printer.toolhead.position.z|float %}
    {% set max_z = printer.toolhead.axis_maximum.z|float %}
    {% set lift = [[10.0, max_z - z - 0.5]|min, 0.0]|max %}

    # Alle Heizungen und Luefter ausschalten
    TURN_OFF_HEATERS
    M106 S0

    # Erst zurueckziehen und anheben, damit die Duese nicht ueber das Teil schleift
    G91
    G1 E-2 F1800
    G1 Z{lift} F900
    G90
`;
  if (s.dual) o += `
    # Parken ohne Duesenversatz, sonst waere die Position ausserhalb des Fahrwegs
    SET_GCODE_OFFSET X=0 Y=0 MOVE=0
`;
  o += `
    # Z anheben, um Platz zu schaffen
    {% if z + lift < ${fmt(parkZ)} %}
    G1 Z${fmt(parkZ)} F1200
    {% endif %}

    # Druckobjekt praesentieren
    G1 X0 Y${fmt(parkY)} F6000

    # Stepper deaktivieren
    M84

    M117 Druck erfolgreich beendet!
`;
  if (s.led) o += `${led(0, 1, 0)}
`;
  o += `
    # Mesh entfernen (für automatisches Leveln beim nächsten Druck)
    BED_MESH_CLEAR
# --------------------------------------------------------------------

`;
  if (s.dual) {
    o += `
[gcode_macro T0]
gcode:
 {% if (printer.toolhead.extruder) != "extruder"  %}
 ACTIVATE_EXTRUDER EXTRUDER=extruder
 {% endif %}
 SET_GCODE_OFFSET X=0 Y=0 MOVE=0


[gcode_macro T1]
# Versatz von Duese 2 gegenueber Duese 1 in mm. Klipper addiert ihn zu den Koordinaten:
# Liegt Duese 2 rechts von Duese 1, ist offset_x negativ. Mit einem Testdruck pruefen.
variable_offset_x: ${s.offx.toFixed(2)}
variable_offset_y: ${s.offy.toFixed(2)}
gcode:
 {% if (printer.toolhead.extruder) != "extruder1"  %}
 ACTIVATE_EXTRUDER EXTRUDER=extruder1
 {% endif %}
 SET_GCODE_OFFSET X={offset_x} Y={offset_y} MOVE=0


`;
  }
  o += `
[delayed_gcode bed_mesh_init]
initial_duration: .01
gcode:
  BED_MESH_PROFILE LOAD=default


[gcode_macro PID_Tuning_Hotend_1]
gcode:
 PID_CALIBRATE HEATER=extruder TARGET=200
 SAVE_CONFIG
`;
  if (s.dual) o += `
[gcode_macro PID_Tuning_Hotend_2]
gcode:
 PID_CALIBRATE HEATER=extruder1 TARGET=200
 SAVE_CONFIG
`;
  o += `
[gcode_macro PID_Tuning_Bed]
gcode:
 PID_CALIBRATE HEATER=heater_bed TARGET=60
 SAVE_CONFIG



# Extruder-Tasten F-FWD und F-REV (wie in der RF-Firmware)
# Kurz druecken: 2 mm vor bzw. zurueck. Gedrueckt halten: nach 1 s laeuft der Extruder
# weiter, bis die Taste losgelassen wird. Waehrend eines Drucks: Fluss +1 % bzw. -1 %.
# Ist die Duese zu kalt (min_extrude_temp), passiert nichts ausser einer Meldung.
[gcode_button F_FWD]
pin: !PJ6
press_gcode: _E_KEY_PRESS DIR=1
release_gcode: _E_KEY_RELEASE

[gcode_button F_RWD]
pin: !PJ5
press_gcode: _E_KEY_PRESS DIR=-1
release_gcode: _E_KEY_RELEASE

[gcode_macro _E_KEY]
variable_step: 2.0
variable_speed: 5.0
variable_hold_delay: 1.0
variable_hold_chunk: 0.25
variable_dir: 0
gcode:
    # Nur Variablen: step = kurzer Druck (mm), speed = mm/s, hold_delay = Sekunden bis
    # zum Dauerlauf, hold_chunk = Sekunden je Teilstueck im Dauerlauf (so weit laeuft
    # der Extruder nach dem Loslassen hoechstens nach), dir = gedrueckte Taste (intern)

[gcode_macro _E_KEY_PRESS]
gcode:
    {% set k = printer["gcode_macro _E_KEY"] %}
    {% set dir = params.DIR|int %}
    {% set ext = printer.toolhead.extruder %}
    {% if printer.print_stats.state == "printing" %}
        M221 S{[(printer.gcode_move.extrude_factor * 100 + dir)|round|int, 1]|max}
    {% elif not printer[ext].can_extrude %}
        RESPOND TYPE=error MSG="Extruder-Tasten: Düse zu kalt, mindestens {printer.configfile.settings[ext].min_extrude_temp|int} °C."
    {% else %}
        SET_GCODE_VARIABLE MACRO=_E_KEY VARIABLE=dir VALUE={dir}
        _E_KEY_MOVE DIST={k.step * dir}
        UPDATE_DELAYED_GCODE ID=_e_key_hold DURATION={k.hold_delay}
    {% endif %}

[gcode_macro _E_KEY_RELEASE]
gcode:
    SET_GCODE_VARIABLE MACRO=_E_KEY VARIABLE=dir VALUE=0
    UPDATE_DELAYED_GCODE ID=_e_key_hold DURATION=0

[gcode_macro _E_KEY_MOVE]
gcode:
    SAVE_GCODE_STATE NAME=_e_key
    M83
    G1 E{params.DIST|float} F{printer["gcode_macro _E_KEY"].speed * 60}
    RESTORE_GCODE_STATE NAME=_e_key

# Dauerlauf: solange die Taste gedrueckt ist, je ein kurzes Stueck nachschieben
[delayed_gcode _e_key_hold]
gcode:
    {% set k = printer["gcode_macro _E_KEY"] %}
    {% if k.dir != 0 and printer.print_stats.state != "printing" and printer[printer.toolhead.extruder].can_extrude %}
        _E_KEY_MOVE DIST={k.speed * k.hold_chunk * k.dir}
        UPDATE_DELAYED_GCODE ID=_e_key_hold DURATION={k.hold_chunk}
    {% endif %}

[gcode_button B_PAUSE]
pin: !PH2
press_gcode: PAUSE

[gcode_button B_RESUME]
pin: !PH7
press_gcode: RESUME


[gcode_macro z_offset_from_probe_result]
gcode:
    SET_GCODE_OFFSET Z={printer["rf1000_load_cell_probe"].last_z_result}

[gcode_macro z_offset_scan]
gcode:
    PROBE
    Z_OFFSET_FROM_PROBE_RESULT
    Z_OFFSET_APPLY_ENDSTOP
    G0 Z2

[gcode_macro bed_calibrate]
gcode:
    G0 Z10
    G0 X100 Y100
    G0 Z2
    PROBE
    Z_OFFSET_FROM_PROBE_RESULT
    Z_OFFSET_APPLY_ENDSTOP
    SET_KINEMATIC_POSITION Z=0
    G0 Z2
    BED_MESH_CALIBRATE
    SAVE_CONFIG

[gcode_macro z_calibrate]
gcode:
    G0 Z10
    G0 X100 Y100
    G0 Z2
    Z_OFFSET_SCAN
`;
  if (s.hp) o += hotProbeBlock('printer["rf1000_load_cell_probe"].last_z_result');
  return o;
}

// rf_led.cfg: RGB-Licht wie RF-Repetier und LED-Signale fuer das Firmware-Update (nur mit LED)
function buildRfLed(s) {
  return `# --------------------------------------------------------------------
# RGB-Licht wie RF-Repetier (RGB_MODE_AUTOMATIC, RF.cpp updateRGBLightStatus)
#
# Ausserhalb eines Drucks:
#   Heizen (Ziel > 40 °C, noch nicht erreicht)  -> Rot
#   Temperatur erreicht (+/- 5 °C)              -> Weiss
#   Abkuehlen (mehr als 40 °C ueber dem Ziel)   -> Blau
#   Ruhe                                        -> Weiss, nach 30 s
#     Farbwechsel Rot > Gelb > Gruen > Cyan > Blau > Magenta > Rot ...
# Jeder Wechsel wird weich ueberblendet (ca. 2,5 s je Farbe, wie Repetier).
# Waehrend eines Drucks bleiben die Farben aus PRINT_START/PRINT_END.
# Menue "Licht Aus" schaltet die Automatik ab, "An" wieder ein.
# RF_LED_SIGNAL (z. B. vom Firmware-Update) hat Vorrang vor allem anderen:
#   RF_LED_SIGNAL MODE=BLINK COLOR=RED DURATION=30   Drucker erkennen
#   RF_LED_SIGNAL MODE=ON COLOR=RED DURATION=3600    Update laeuft
#   RF_LED_SIGNAL MODE=ON COLOR=GREEN DURATION=5     Update fertig
#   RF_LED_SIGNAL MODE=OFF                           zurueck zur Automatik
# --------------------------------------------------------------------

[gcode_macro _RF_LED]
variable_enabled: 1
# -1 = neu bewerten, 0 = Ruhe, 1 = Heizen, 2 = Temperatur erreicht,
#  3 = Abkuehlen, 4 = Farbwechsel
variable_status: -1
variable_idle_since: 0.0
variable_tr: 1.0
variable_tg: 1.0
variable_tb: 1.0
# Einstellungen (Repetier: RGB_LIGHT_COLOR_CHANGE_DELAY, RGB_LIGHT_TEMP_TOLERANCE,
# COOLDOWN_THRESHOLD, MAX_ROOM_TEMPERATURE)
variable_change_delay: 30.0
variable_tick: 0.1
variable_fade_time: 2.55
# Signal: 0 = keins, 1 = Dauerlicht, 2 = Blinken (1 Hz)
variable_sig_mode: 0
variable_sig_r: 0.0
variable_sig_g: 0.0
variable_sig_b: 0.0
variable_sig_until: 0.0
gcode:
    {% set v = printer["gcode_macro _RF_LED"] %}
    {% set ps = printer.print_stats.state %}
    {% set now = printer.toolhead.estimated_print_time|float %}
    {% if v.sig_mode and now < v.sig_until %}
      {% set on = v.sig_mode == 1 or (now * 2)|int % 2 == 0 %}
      {% set want = [v.sig_r, v.sig_g, v.sig_b] if on else [0.0, 0.0, 0.0] %}
      {% set cur = printer["led led"].color_data[0] %}
      {% if (cur[0] - want[0])|abs > 0.001 or (cur[1] - want[1])|abs > 0.001 or (cur[2] - want[2])|abs > 0.001 %}
        SET_LED LED=led RED={want[0]} GREEN={want[1]} BLUE={want[2]} SYNC=0 TRANSMIT=1
      {% endif %}
      UPDATE_DELAYED_GCODE ID=_rf_led_loop DURATION=0.1
    {% elif v.sig_mode %}
      # Signal abgelaufen: zurueck zur Automatik
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_mode VALUE=0
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=status VALUE=-1
      UPDATE_DELAYED_GCODE ID=_rf_led_loop DURATION=0.1
    {% elif not v.enabled or ps in ["printing", "paused"] %}
      {% if v.status != -1 %}
        SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=status VALUE=-1
      {% endif %}
      UPDATE_DELAYED_GCODE ID=_rf_led_loop DURATION=1
    {% else %}
      # --- Status bestimmen (wie Repetier) ---
      {% set ns = namespace(new=0) %}
      {% for h in ["extruder", "extruder1"] if h in printer %}
        {% set t = printer[h].target|float %}{% set c = printer[h].temperature|float %}
        {% if t > 40 %}
          {% if (t - c)|abs < 5 %}{% set ns.new = 2 %}
          {% elif t > c %}{% set ns.new = 1 %}{% endif %}
        {% endif %}
      {% endfor %}
      {% if "heater_bed" in printer %}
        {% set t = printer.heater_bed.target|float %}{% set c = printer.heater_bed.temperature|float %}
        {% if t > 40 %}
          {% if (t - c)|abs < 5 %}{% if ns.new == 0 %}{% set ns.new = 2 %}{% endif %}
          {% elif t > c %}{% set ns.new = 1 %}{% endif %}
        {% endif %}
      {% endif %}
      {% for h in ["extruder", "extruder1", "heater_bed"] if h in printer %}
        {% if printer[h].temperature|float - printer[h].target|float > 40 and ns.new == 0 %}
          {% set ns.new = 3 %}
        {% endif %}
      {% endfor %}

      {% set st = namespace(s=v.status, tr=v.tr, tg=v.tg, tb=v.tb, since=v.idle_since, dirty=0) %}
      {% if ns.new != st.s and not (ns.new == 0 and st.s == 4) %}
        {% set st.s = ns.new %}{% set st.dirty = 1 %}
        {% if st.s == 1 %}{% set st.tr = 1.0 %}{% set st.tg = 0.0 %}{% set st.tb = 0.0 %}
        {% elif st.s == 3 %}{% set st.tr = 0.0 %}{% set st.tg = 0.0 %}{% set st.tb = 1.0 %}
        {% else %}{% set st.tr = 1.0 %}{% set st.tg = 1.0 %}{% set st.tb = 1.0 %}{% endif %}
        {% if st.s == 0 %}{% set st.since = now %}{% endif %}
      {% endif %}

      # --- Nach der Ruhezeit in den Farbwechsel ---
      {% if st.s == 0 and now - st.since > v.change_delay %}
        {% set st.s = 4 %}{% set st.dirty = 1 %}
        {% set st.tr = 1.0 %}{% set st.tg = 0.0 %}{% set st.tb = 0.0 %}
      {% endif %}

      # --- Aktuelle Farbe ---
      {% set cur = printer["led led"].color_data[0] %}
      {% set r, g, b = cur[0]|float, cur[1]|float, cur[2]|float %}

      # --- Farbwechsel: Ziel erreicht -> naechste Farbe ---
      {% if st.s == 4 and (r - st.tr)|abs < 0.001 and (g - st.tg)|abs < 0.001 and (b - st.tb)|abs < 0.001 %}
        {% set key = "%d%d%d" % (st.tr|round|int, st.tg|round|int, st.tb|round|int) %}
        {% set nxt = {"100": (1,1,0), "110": (0,1,0), "010": (0,1,1),
                      "011": (0,0,1), "001": (1,0,1), "101": (1,0,0)} %}
        {% set n = nxt[key] if key in nxt else (1,0,0) %}
        {% set st.tr = n[0]|float %}{% set st.tg = n[1]|float %}{% set st.tb = n[2]|float %}
        {% set st.dirty = 1 %}
      {% endif %}

      {% if st.dirty %}
        SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=status VALUE={st.s}
        SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=idle_since VALUE={st.since}
        SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=tr VALUE={st.tr}
        SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=tg VALUE={st.tg}
        SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=tb VALUE={st.tb}
      {% endif %}

      # --- Weich ueberblenden ---
      {% set s = v.tick / v.fade_time %}
      {% set nr = r + [[st.tr - r, s]|min, -s]|max %}
      {% set ng = g + [[st.tg - g, s]|min, -s]|max %}
      {% set nb = b + [[st.tb - b, s]|min, -s]|max %}
      {% if (nr - r)|abs > 0.0001 or (ng - g)|abs > 0.0001 or (nb - b)|abs > 0.0001 %}
        SET_LED LED=led RED={"%.4f" % nr} GREEN={"%.4f" % ng} BLUE={"%.4f" % nb} SYNC=0 TRANSMIT=1
        UPDATE_DELAYED_GCODE ID=_rf_led_loop DURATION={v.tick}
      {% else %}
        # nichts zu tun: seltener pruefen, im Ruhezustand bis zum Farbwechsel
        UPDATE_DELAYED_GCODE ID=_rf_led_loop DURATION={0.1 if st.s == 4 else 0.5}
      {% endif %}
    {% endif %}

[delayed_gcode _rf_led_loop]
initial_duration: 3
gcode:
    _RF_LED

# Licht An/Aus (Menue): Aus schaltet auch die Automatik ab
[gcode_macro RF_LIGHT]
gcode:
    {% set on = params.S|default(1)|int %}
    SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=enabled VALUE={1 if on else 0}
    SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=status VALUE=-1
    SET_LED LED=led RED={on} GREEN={on} BLUE={on} SYNC=0 TRANSMIT=1

# Signal fuer Firmware-Update und Druckerauswahl, siehe oben
[gcode_macro RF_LED_SIGNAL]
description: LED-Signal: MODE=BLINK|ON|OFF COLOR=RED|GREEN|BLUE|WHITE DURATION=Sekunden
gcode:
    {% set mode = params.MODE|default("BLINK")|upper %}
    {% set colors = {"RED": (1, 0, 0), "GREEN": (0, 1, 0), "BLUE": (0, 0, 1), "WHITE": (1, 1, 1)} %}
    {% set c = colors[params.COLOR|default("RED")|upper]|default((1, 0, 0)) %}
    {% set until = printer.toolhead.estimated_print_time|float + params.DURATION|default(30)|float %}
    {% if mode == "OFF" %}
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_until VALUE=0
    {% else %}
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_r VALUE={c[0]}
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_g VALUE={c[1]}
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_b VALUE={c[2]}
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_until VALUE={until}
      SET_GCODE_VARIABLE MACRO=_RF_LED VARIABLE=sig_mode VALUE={2 if mode == "BLINK" else 1}
    {% endif %}
    UPDATE_DELAYED_GCODE ID=_rf_led_loop DURATION=0.05
`;
}

// Heissmessung vor dem Druck (HOT_Z_PROBE); res = Ausdruck fuer den letzten PROBE-Messwert
function hotProbeBlock(res) {
  return `

############################
#  Z-Offset vor dem Druck (Heissmessung)
############################
# Ablauf: zufaelligen Punkt waehlen, 1. PROBE (reinigt die Duese), 2. PROBE 2 mm weiter in X (zaehlt),
# Offset = Messwert - Meshhoehe am 2. Punkt. Gilt nur fuer diesen Druck.
# Voraussetzung: Das Mesh wurde wie in bed_calibrate aufgenommen (Z=0 am Bezugspunkt, Mesh geladen).
# Liegt der Punkt ausserhalb des Mesh-Bereichs (mesh_min), wird am Rand gerechnet.
# Sicherung: PROBE nur mit aufgeheizter aktiver Duese (Soll und Ist mindestens MINTEMP, Standard 170 Grad)
[gcode_macro _HOT_Z_CHECK]
gcode:
    {% set ex = printer.toolhead.extruder %}
    {% set t = printer[ex].temperature %}
    {% set tg = printer[ex].target %}
    {% set mt = params.MINTEMP|default(170)|float %}
    {% if tg < mt or t < mt - 5 %}
    {action_raise_error("HOT_Z_PROBE: Extruder %s ist nicht heiss (Ist %.0f, Soll %.0f, mindestens %.0f Grad). PROBE nur mit aufgeheizter Duese." % (ex, t, tg, mt))}
    {% endif %}

[gcode_macro HOT_Z_PROBE]
description: Z-Offset heiss messen, 2 Messungen (MIN=30 MAX=50 Zufallspunkt, 2. Messung 2 mm weiter in X)
gcode:
    _HOT_Z_CHECK
    {% set lo = params.MIN|default(30)|float %}
    {% set hi = params.MAX|default(50)|float %}
    # Klipper kennt kein random: Nachkommastellen der CPU-Zeit als Zufallswert
    {% set ct = printer.system_stats.cputime * 1000 %}
    {% set px = lo + (hi - lo) * ((ct|int % 1000) / 1000.0) %}
    {% set py = lo + (hi - lo) * (((ct * 7.919)|int % 1000) / 1000.0) %}
    SET_GCODE_OFFSET Z=0
    G90
    G1 Z10 F3000
    G1 X{"%.1f" % px} Y{"%.1f" % py} F6000
    G1 Z1 F1200
    _HOT_Z_PROBE_STEP2 X={px} Y={py}

# 1. Messung: reinigt die Duese (Filamentreste werden gegen das Bett gedrueckt), Ergebnis wird nur angezeigt
[gcode_macro _HOT_Z_PROBE_STEP2]
gcode:
    _HOT_Z_CHECK
    PROBE
    _HOT_Z_PROBE_STEP3 X={params.X|float + 2.0} Y={params.Y} Z1={${res}}

# 2. Messung: 2 mm weiter in X (frische Stelle), diese zaehlt
[gcode_macro _HOT_Z_PROBE_STEP3]
gcode:
    G1 Z5 F3000
    G1 X{"%.1f" % (params.X|float)} Y{"%.1f" % (params.Y|float)} F6000
    G1 Z1 F1200
    _HOT_Z_PROBE_STEP4 X={params.X} Y={params.Y} Z1={params.Z1}

[gcode_macro _HOT_Z_PROBE_STEP4]
gcode:
    # Differenz toolhead-Z zu G-Code-Z ist der Mesh-Anteil an diesem Punkt
    {% set mz = printer.toolhead.position.z - printer.gcode_move.gcode_position.z %}
    _HOT_Z_CHECK
    PROBE
    _HOT_Z_PROBE_STEP5 MZ={mz} Z1={params.Z1}

[gcode_macro _HOT_Z_PROBE_STEP5]
gcode:
    {% set z2 = ${res} %}
    {% set d = z2 - params.MZ|float %}
    {% if d|abs > 0.5 %}
    G1 Z10 F3000
    {action_raise_error("HOT_Z_PROBE: Offset %.3f mm ist unplausibel (>0.5). Abbruch. Mesh/Bezugspunkt und Duese pruefen." % d)}
    {% endif %}
    SET_GCODE_OFFSET Z={d}
    RESPOND MSG="Heissmessung: 1. Messung {"%.3f" % (params.Z1|float)} mm, 2. Messung {"%.3f" % z2} mm. Z-Offset {"%.3f" % d} mm (gilt fuer diesen Druck)"
    G1 Z10 F3000
`;
}

// ---------- MKS SKIPR: printer.cfg und macros.cfg (Vorlage: laufende Config eines RF2000 mit 2in1-Hotend)
function buildSkiprPrinter(s) {
  const two = s.twoin1;
  const meshx = Math.max(20, s.xmax - 10), meshy = Math.max(20, s.ymax - 10);
  let o = `# Renkforce ${s.model} mit MKS SKIPR, ${two ? '2in1-Hotend (zwei Extruder, eine Duese)' : 'Single Extruder'}, Filament ${s.fil} mm
# Erzeugt mit dem Renkforce Configurator
# Wer ein anderes Hotend benutzt, bitte die Rotation Distance anpassen.
#
# HAFTUNGSAUSSCHLUSS: Diese Config wird ohne jede Gewaehr bereitgestellt. Die Nutzung
# erfolgt auf eigene Gefahr, eine Haftung fuer Schaeden an Drucker, Umgebung oder
# Personen ist ausgeschlossen. Alle Werte (Pins, Maße, Endstops, Temperaturen) vor der
# Inbetriebnahme selbst pruefen, die ersten Bewegungen mit der Hand am Not-Halt machen.
#
# PIN INVERTIEREN: Ein "!" vor dem Pin kehrt dessen Logik um, z.B. "!PB15" statt "PB15".
# Meldet QUERY_ENDSTOPS im Ruhezustand "triggered", obwohl der Endstop frei ist (oder
# umgekehrt), das "!" einfach entfernen bzw. hinzufuegen. Ohne diesen Test kann die
# Achse in den Anschlag fahren.
#
# Firmware fuer das SKIPR (STM32F407): 48KiB Bootloader, "Serial on USART1 PA10/PA9".
# "make flash" geht beim SKIPR nicht: out/klipper.bin als mks_skipr.bin auf eine SD-Karte
# kopieren und das SKIPR damit neu starten (oder Paket skipr-update in Mainsail).

[include mainsail.cfg]
[include gcode_ignore.cfg]
${s.led ? '[include led_progress.cfg]\n' : ''}[include macros.cfg]
${two ? '[include 2in1_hotend.cfg]\n[include adaptives_mesh.cfg]\n' : ''}
[mcu]
# Das SKIPR-Board haengt intern an USART1 (PA10/PA9) des RK3328
serial: ${s.serial}
restart_method: command

[mcu rpi]
serial: /tmp/klipper_host_mcu


[printer]
kinematics: cartesian
max_velocity: 300
max_accel: 1200
max_z_velocity: 15
max_z_accel: 100


[exclude_object]

[safe_z_home]
home_xy_position: 0,${fmt(-s.yhome)}
z_hop: 2

[force_move]
enable_force_move: True


[stepper_x]
step_pin: PC14
dir_pin: PC13
enable_pin: !PC15
endstop_pin: !PA14
rotation_distance: 42
microsteps: 16
position_endstop: 0
position_min: 0
position_max: ${fmt(s.xmax)}
homing_speed: 60


[stepper_y]
step_pin: PE5
dir_pin: !PE4
enable_pin: !PD14
endstop_pin: !PA15
rotation_distance: 42
microsteps: 16
# Y=0 ist die Vorderkante des Betts, beim Home-Schalter steht die Duese ${fmt(s.yhome)} mm davor
# position_max = Fahrweg ab Schalter (${fmt(s.ytravel)} mm) minus ${fmt(s.yhome)} mm
position_endstop: ${fmt(-s.yhome)}
position_min: ${fmt(-s.yhome)}
position_max: ${fmt(s.ymax)}
homing_speed: 50


[stepper_z]
step_pin: PE1
dir_pin: !PE0
enable_pin: !PE2
endstop_pin: ${s.zpin}
rotation_distance: 2.5
microsteps: 16
# position_endstop wird kalibriert (bed_calibrate oder Z_ENDSTOP_CALIBRATE) und mit SAVE_CONFIG
# unten in der Datei gespeichert. Der Wert dort hat Vorrang vor dem Wert hier.
# position_min: wie weit Z unter 0 weiterfahren darf (Ueberfahrweg)
position_endstop: 0
position_min: ${fmt(s.zmin)}
position_max: ${fmt(s.zmax)}
homing_speed: 5.0
second_homing_speed: 2

[extruder]
step_pin: PB5
dir_pin: PB4
enable_pin: !PB6
microsteps: 16
rotation_distance: ${fmt(s.rot)}
nozzle_diameter: ${fmt(s.nozzle)}
filament_diameter: ${s.fil}
min_temp: 0
max_temp: 290
heater_pin: PB1
sensor_type: NTC 100K MGB18-104F39050L32
sensor_pin: PC1
max_extrude_only_distance: 150.0
max_extrude_cross_section: 6
control: pid
pid_kp: 13.336
pid_ki: 0.502
pid_kd: 88.516

`;
  if (two) o += `
# 2in1-Hotend: zweiter Extruder-Motor, foerdert in dieselbe Duese.
# Umschalten mit T0 / T1 aus der 2in1_hotend.cfg (SYNC_EXTRUDER_MOTION).
[extruder_stepper extruder1]
extruder:
step_pin: PD6
dir_pin: !PD5
enable_pin: !PD7
microsteps: 16
rotation_distance: ${fmt(s.rot)}

`;
  o += `

[thermistor EPCOS 100K B57550G0104]
temperature1: 25
resistance1: 100000
beta: 4150

[heater_bed]
heater_pin: PD12
sensor_type: EPCOS 100K B57550G0104
sensor_pin: PC0
max_power: 1.0
control: pid
pid_kp: 44.470
pid_ki: 0.812
pid_kd: 608.682
min_temp: 0
max_temp: 130

# Luefter der Schrittmotortreiber
[controller_fan Stepstick_fan]
pin: PA0
fan_speed: 1
idle_timeout: 60
heater: extruder

# Bauteilluefter
[fan]
pin: PB0
max_power: 1.0
kick_start_time: 0.300
cycle_time: 0.010
hardware_pwm: true

# Kuehlkoerper-Luefter des Hotends
[heater_fan Cooler_fan]
pin: PA2
heater: extruder
heater_temp: 50.0
fan_speed: 0.75


#####################################################################
#   Sonde: DMS ueber den ADS-EMU (3D-Artmaker) am Probe-Eingang
#####################################################################
[probe]
pin: !PA13
x_offset: 0
y_offset: 0
z_offset: 0
speed: 0.3
samples: 4
sample_retract_dist: 0.5
lift_speed: 1
samples_result: average
samples_tolerance: 0.02
samples_tolerance_retries: 3
activate_gcode:
    probe_reset

[output_pin probe_reset_pin]
pin: PA8

[gcode_macro probe_reset]
gcode:
    SET_PIN PIN=probe_reset_pin VALUE=1
    G4 P600
    SET_PIN PIN=probe_reset_pin VALUE=0
    G4 P100

[bed_mesh]
mesh_min: 0,10
mesh_max: ${fmt(meshx)},${fmt(meshy)}
probe_count: 5,5
mesh_pps: 2,3
algorithm: bicubic
bicubic_tension: 0.2
speed: 50
horizontal_move_z: 1

`;
  if (s.led) o += `
# LED-Streifen (Neopixel, 10 LEDs), Fortschrittsanzeige mit led_progress.cfg
[neopixel Led]
pin: PC5
chain_count: 10
initial_RED: 0
initial_GREEN: 1
initial_BLUE: 1

`;
  const tmc = (name, cs, cur, hold) => `
[tmc2240 ${name}]
cs_pin: ${cs}
spi_software_sclk_pin: PE12
spi_software_mosi_pin: PE14
spi_software_miso_pin: PE13
run_current: ${cur}
${hold ? 'hold_current: ' + hold + '\n' : ''}interpolate: false
`;
  o += `
########################################
# Schrittmotortreiber TMC2240 (SPI)
########################################
` + tmc('stepper_x', 'PE6', '1.1') + tmc('stepper_y', 'PE3', '1.1') + tmc('stepper_z', 'PB7', '1.1') +
    tmc('extruder', 'PB3', '0.6', '0.500') + (two ? tmc('extruder_stepper extruder1', 'PD4', '0.6', '0.500') : '');
  o += `

[virtual_sdcard]
path: ~/printer_data/gcodes

[pause_resume]

# PAUSE, RESUME und CANCEL_PRINT kommen aus mainsail.cfg.

[display_status]
`;
  return o;
}

function buildSkiprMacros(s) {
  const two = s.twoin1;
  const f = Math.pow(1.75 / parseFloat(s.fil), 2);   // gleiches Volumen bei dickerem Filament
  const prime1 = Math.round(13 * f * 10) / 10, prime2 = Math.round(25 * f * 10) / 10, prime3 = Math.round(37 * f * 10) / 10;
  const parkY = s.ymax - 5, parkZ = s.zmax - 5;
  let o = `################################################################################
# Makros für ${s.model} mit MKS SKIPR, ${two ? '2in1-Hotend' : 'Single Extruder'} (erzeugt mit dem Config Creator)
# PAUSE, RESUME und CANCEL_PRINT kommen aus mainsail.cfg.
# Anpassungen dafuer ueber [gcode_macro _CLIENT_VARIABLE] vornehmen.
${two ? '# PRINT_START, PRINT_END, T0 und T1 stehen in der 2in1_hotend.cfg.\n' : ''}################################################################################

[gcode_macro PID_Tuning_Hotend]
gcode:
 PID_CALIBRATE HEATER=extruder TARGET=200
 SAVE_CONFIG

[gcode_macro PID_Tuning_Bed]
gcode:
 PID_CALIBRATE HEATER=heater_bed TARGET=60
 SAVE_CONFIG

`;
  if (s.led) o += `
[gcode_macro Licht_an]
gcode:
    SET_LED LED=Led GREEN=1 RED=1 BLUE=1

[gcode_macro Licht_aus]
gcode:
    SET_LED LED=Led RED=0 GREEN=0.4 BLUE=1 SYNC=0 TRANSMIT=1

[gcode_macro Led_aus]
gcode:
    SET_LED LED=Led RED=0 GREEN=0 BLUE=0 SYNC=0 TRANSMIT=1

`;
  o += `
# Bezugspunkt und Mesh aufnehmen: Z=0 dort, wo die Sonde in der Bettmitte ausloest
[gcode_macro z_offset_from_probe_result]
gcode:
    SET_GCODE_OFFSET Z={printer.probe.last_z_result}

[gcode_macro bed_calibrate]
gcode:
    {% if "xyz" not in printer.toolhead.homed_axes %}
    G28
    {% endif %}
    G0 Z10
    G0 X${fmt(Math.round(s.xmax / 2))} Y${fmt(Math.round(s.ymax / 2))}
    G0 Z2
    PROBE
    Z_OFFSET_FROM_PROBE_RESULT
    Z_OFFSET_APPLY_ENDSTOP
    SET_KINEMATIC_POSITION Z=0
    G0 Z2
    BED_MESH_CALIBRATE
    SAVE_CONFIG
`;
  if (two) return o;
  o += `

[delayed_gcode bed_mesh_init]
initial_duration: .01
gcode:
  BED_MESH_PROFILE LOAD=default


############################
#  Druck Start und Ende
############################

# --------------------------- Start Print ----------------------------
[gcode_macro PRINT_START]
gcode:
    {% set Betttemperatur = params.BED_TEMP|default(60)|float %}
    {% set Extrudertemperatur = params.EXTRUDER_TEMP|default(200)|float %}
    # Absolute Werte fuer die Prime Line
    G90
    M82

    # Homen aller Achsen
    G28
`;
  if (s.led) o += `    NEOPIXEL_DISPLAY LED=Led TYPE=extruder_temp MODE=glow
`;
  o += `
    # Mesh laden (vorher einmal bed_calibrate)
    BED_MESH_PROFILE LOAD="default"

    M117 Heize Bett und Hotend...
    M190 S{Betttemperatur}
    M109 S{Extrudertemperatur}

    # Sonde (ADS-EMU) zuruecksetzen
    PROBE_RESET
`;
  if (s.hp) o += `
    # Heissmessung: Hotend dehnt sich aus, Z-Offset an zufaelligem Punkt (${fmt(s.hpmin)} bis ${fmt(s.hpmax)} mm) neu bestimmen
    M117 Hotend ausdehnen lassen...
    G4 P${Math.round(s.hpwait * 1000)}
    HOT_Z_PROBE MIN=${fmt(s.hpmin)} MAX=${fmt(s.hpmax)}
`;
  o += `
    # Extruder zurücksetzen & leichter Retract
    G92 E0
    G1 E-1 F1800
    G1 F300 E-0.5

    # Prime Line (Menge auf ${s.fil} mm Filament umgerechnet): rechts nach links bei Y3,
    # 1 mm versetzt bei Y4 wieder zurueck, damit mehr Material durch die Duese geht
    G1 X${Math.min(180, s.xmax - 20)} Y3 Z0.35 F5000
    G1 F800 E${prime1}
    G1 X20 E${prime2} F1000
    G1 Y4 F1000
    G1 X${Math.min(180, s.xmax - 20)} E${prime3} F1000

    G92 E0

    # Z etwas anheben
    G1 Z2.0 F3000

    M117 ${s.model} Klipper bereit!
# --------------------------------------------------------------------


# ---------------------------- End Print -----------------------------
[gcode_macro PRINT_END]
gcode:
    {% set z = printer.toolhead.position.z|float %}
    {% set max_z = printer.toolhead.axis_maximum.z|float %}
    {% set lift = [[10.0, max_z - z - 0.5]|min, 0.0]|max %}

    # Alle Heizungen und Luefter ausschalten
    TURN_OFF_HEATERS
    M106 S0

    # Erst zurueckziehen und anheben, damit die Duese nicht ueber das Teil schleift
    G91
    G1 E-2 F1800
    G1 Z{lift} F900
    G90

    # Z anheben, um Platz zu schaffen
    {% if z + lift < ${fmt(parkZ)} %}
    G1 Z${fmt(parkZ)} F1200
    {% endif %}

    # Druckobjekt praesentieren
    G1 X0 Y${fmt(parkY)} F6000

    # Stepper deaktivieren
    M84

    M117 Druck erfolgreich beendet!
`;
  if (s.led) o += `    SET_LED LED=Led RED=0 GREEN=0 BLUE=0 SYNC=0 TRANSMIT=1
`;
  o += `
    # Mesh entfernen (für automatisches Leveln beim nächsten Druck)
    BED_MESH_CLEAR
# --------------------------------------------------------------------


[gcode_macro M600]
description: Filamentwechsel-Assistent (ruft PAUSE auf, bewegt und wartet)
gcode:
    {% set X = params.X|default(50)|float %}
    {% set Y = params.Y|default(50)|float %}
    {% set Z = params.Z|default(10)|float %}
    PAUSE
    G91
    G1 E-5 F2700
    G1 Z{Z} F1000
    G90
    G1 X{X} Y{Y} F6000
    RESPOND MSG="M600: Filamentwechsel. Wechseln Sie das Filament, und rufen Sie dann RESUME auf."
`;
  if (s.hp) o += hotProbeBlock('printer.probe.last_z_result');
  return o;
}

// Alle Dateien eines SKIPR-Druckers
function skiprFiles(s) {
  const f = { 'printer.cfg': buildSkiprPrinter(s), 'macros.cfg': buildSkiprMacros(s), 'gcode_ignore.cfg': STATIC.gcode_ignore || '' };
  if (s.led) f['led_progress.cfg'] = STATIC.led_progress || '';
  if (s.twoin1) {
    let h = STATIC.hotend_2in1 || '';
    // Purge-Position vor dem Bett: am Y-Schalter
    h = h.replace(/variable_purge_y: *-?[0-9.]+/, 'variable_purge_y: ' + fmt(-s.yhome));
    if (!s.led) h = h.replace(/\n *SET_LED LED=Led[^\n]*/g, '');
    f['2in1_hotend.cfg'] = h;
    f['adaptives_mesh.cfg'] = STATIC.adaptives_mesh || '';
  }
  return f;
}

// Slicer (OrcaSlicer): Start-G-Code und Werkzeugwechsel passend zur Config
function slicerStartCode(s) {
  if (s.twoin1) return 'PRINT_START EXTRUDER_TEMP=[nozzle_temperature_initial_layer] BED_TEMP=[bed_temperature_initial_layer_single] PRINT_MIN={first_layer_print_min[0]},{first_layer_print_min[1]} PRINT_MAX={first_layer_print_max[0]},{first_layer_print_max[1]} INITIAL_TOOL=[initial_tool] USED_T0={is_extruder_used[0]} USED_T1={is_extruder_used[1]}';
  return s.dual
    ? 'PRINT_START BED_TEMP=[bed_temperature_initial_layer_single] EXTRUDER_TEMP={nozzle_temperature_initial_layer[initial_tool]}'
    : 'PRINT_START BED_TEMP=[bed_temperature_initial_layer_single] EXTRUDER_TEMP=[nozzle_temperature_initial_layer]';
}
function slicerToolChange(s) { return s.dual || s.twoin1 ? 'T[next_extruder]' : 'M600'; }
// Kurzfassung fuer den Installer (Text)
function slicerText(s) {
  const t = [
    'G-Code-Variante: Klipper',
    `Druckbett: ${fmt(s.xmax)} x ${fmt(s.ymax)} mm, Ursprung 0 / 0 (vordere linke Ecke des Betts)`,
    `Druckhöhe: ${fmt(s.zmax - 5)} mm`,
    `Düse ${fmt(s.nozzle)} mm, Filament ${s.fil} mm, Extruder: ${s.dual ? '2' : s.twoin1 ? '2 (Single Extruder Multi Material)' : '1'}`
  ];
  if (s.yfront > 0) t.push(`Sperrbereich: 0x0,${fmt(s.xmax)}x0,${fmt(s.xmax)}x${fmt(s.yfront)},0x${fmt(s.yfront)}`);
  t.push('Start-G-Code: ' + slicerStartCode(s), 'End-G-Code: PRINT_END', 'Pause-G-Code: PAUSE', 'Filamentwechsel: ' + slicerToolChange(s));
  return t.join('\n');
}

const FORM_DEFAULTS = {
 "v:pname": "RF2000v2",
 "r:ext": "single",
 "v:model": "rf1000",
 "v:xmax": "",
 "v:ytravel": "",
 "v:zmax": "190",
 "v:yhome": "",
 "v:yfront": "",
 "c:led": false,
 "c:rfdisp": false,
 "r:fil": "1.75",
 "v:nozzle": "0.4",
 "v:esteps": "280",
 "v:offx": "35",
 "v:offy": "0",
 "r:ftype": "pla",
 "v:ftemp": "195",
 "v:fbed": "65",
 "v:serial": "/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_AL03P23U-if00-port0",
 "v:zpin": "PC6",
 "v:zmin": "",
 "c:zinv": true,
 "c:hp": false,
 "v:hpmin": "30",
 "v:hpmax": "50",
 "v:hpwait": "45",
 "c:guard": true,
 "c:eon": true,
 "v:emin": "-6000",
 "v:emax": "6000",
 "v:esamp": "5",
 "c:fon": true,
 "v:fmin": "4000",
 "v:fmax": "5000",
 "v:fpct": "30",
 "v:vpct": "30",
 "v:fminz": "0.2",
 "c:digits": true
};

// ---------------------------------------------------------------- Kommandozeile (3D-Artmaker Installer)
//   defaults BOARD EXT MODEL      Formularwerte (JSON) mit den Vorgaben fuer Board, Extruder und Modell
//   generate FORM.json ORDNER     Dateien wie der Creator schreiben, Dateinamen ausgeben
//   state FORM.json               berechnete Werte (JSON)
//   slicer FORM.json              Slicer-Einstellungen (Text)
(function () {
  let args, read, write, out;
  if (typeof scriptArgs !== 'undefined' && typeof std !== 'undefined') {          // qjs --std
    args = scriptArgs.slice(1);
    read = p => std.loadFile(p);
    write = (p, t) => { const fh = std.open(p, 'w'); fh.puts(t); fh.close(); };
    out = t => std.out.puts(t + '\n');
  } else if (typeof process !== 'undefined' && typeof require === 'function') {   // node
    const fs = require('fs');
    args = process.argv.slice(2);
    read = p => fs.readFileSync(p, 'utf8');
    write = (p, t) => fs.writeFileSync(p, t);
    out = t => process.stdout.write(t + '\n');
  } else return;
  const form = p => JSON.parse(read(p));
  const cmd = args[0];
  if (cmd === 'defaults') {
    const board = args[1] === 'skipr' ? 'skipr' : 'atmega';
    const f = Object.assign({}, FORM_DEFAULTS, { board: board, fw: 'klipper', pcount: 1, pnum: 1 });
    f['r:ext'] = args[2] || (board === 'skipr' ? '2in1' : 'single');
    f['v:model'] = args[3] || 'rf2000';
    boardDefaults(f, board);
    if (args[2]) f['r:ext'] = args[2];
    applyDefaults(f, modelDefaults(board, false, f['r:ext'], f['v:model']));
    out(JSON.stringify(f));
  } else if (cmd === 'generate') {
    const st = stateFrom(form(args[1]));
    const files = allFiles(st);
    files['LIESMICH.txt'] = readmeFor(st);
    for (const n in files) { write(args[2] + '/' + n, files[n]); out(n); }
  } else if (cmd === 'state') {
    out(JSON.stringify(stateFrom(form(args[1]))));
  } else if (cmd === 'slicer') {
    out(slicerText(stateFrom(form(args[1]))));
  } else {
    out('Befehle: defaults BOARD EXT MODEL | generate FORM.json ORDNER | state FORM.json | slicer FORM.json');
  }
})();
