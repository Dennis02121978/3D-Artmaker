# Firmware-Update für ATmega2560 über Mainsail

Fügt Mainsail den Menüpunkt **Firmware-Update** hinzu. Die Klipper-Firmware eines ATmega2560-Boards lässt sich damit per Knopfdruck aktualisieren.

Der Ablauf holt den neuesten Stand des Repos, aus dem `~/klipper` stammt, baut die Firmware und schreibt sie mit `avrdude` auf das Board. Der Anschluss kommt aus dem Abschnitt `[mcu]` der `printer.cfg`.

## Mehrere Drucker an einem Raspberry Pi

Laufen mehrere Klipper-Instanzen (`klipper.service`, `klipper-<Name>.service`, zum Beispiel mit dem Paket `rf-multi`), zeigt die Update-Seite alle Drucker zur Auswahl:

- Tippst du einen Drucker an, blinkt auf seinem Display 30 Sekunden ein Rahmen mit „FIRMWARE-UPDATE – DIESER DRUCKER“ und dem Countdown, dazu blinkt die LED rot. Der RF1000 hat keine LED, dort zeigt nur das Display die Meldung. So siehst du, welcher Drucker es ist.
- Während des Updates steht „UPDATE LAEUFT – NICHT AUSSCHALTEN“ auf dem Display und die LED leuchtet rot. Beim Schreiben der Firmware startet das Board neu, dann sind Display und LED kurz aus. Danach zeigt das Display 15 Sekunden „ERFOLGREICH“, die LED leuchtet 5 Sekunden grün.
- Ist das Update fertig, leuchtet sie 5 Sekunden grün.
- Angehalten wird nur der gewählte Drucker. Weil sich alle Drucker `~/klipper` teilen, zeigt die Seite danach, welcher Drucker ebenfalls die neue Firmware braucht.

Die Display-Meldung kommt vom Makro `RF_DISPLAY_SIGNAL` aus `rf_display.cfg` bzw. `rf_display_rf1000.cfg` (ab v1.5.8), die LED-Signale vom Makro `RF_LED_SIGNAL` aus `rf_led.cfg`. Fehlt dieses, schaltet die Seite die LED mit `SET_LED`.

Die Update-Seite prüft Prozessor, Takt und Baudrate gegen `files/mcu-build-config-atmega2560`. Scheitert der Firmware-Bau, geht `~/klipper` auf den alten Stand zurück.

Bauen auf einem Linux-System mit `dpkg-deb`: `./build_deb.sh 1.3.0`
