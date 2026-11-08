# Firmware-Update für ATmega2560 über Mainsail

Fügt Mainsail den Menüpunkt **Firmware-Update** hinzu. Die Klipper-Firmware eines ATmega2560-Boards lässt sich damit per Knopfdruck aktualisieren.

Der Ablauf holt den neuesten Stand des Repos, aus dem `~/klipper` stammt, baut die Firmware und schreibt sie mit `avrdude` auf das Board. Der Anschluss kommt aus dem Abschnitt `[mcu]` der `printer.cfg`.

## Mehrere Drucker an einem Raspberry Pi

Laufen mehrere Klipper-Instanzen (`klipper.service`, `klipper-<Name>.service`, zum Beispiel mit dem Paket `rf-multi`), zeigt die Update-Seite alle Drucker zur Auswahl:

- Tippst du einen Drucker an, blinkt seine LED 30 Sekunden rot. So siehst du, welcher es ist.
- Während des Updates leuchtet die LED rot. Beim Schreiben der Firmware startet das Board neu, dann ist sie kurz aus.
- Ist das Update fertig, leuchtet sie 5 Sekunden grün.
- Angehalten wird nur der gewählte Drucker. Weil sich alle Drucker `~/klipper` teilen, zeigt die Seite danach, welcher Drucker ebenfalls die neue Firmware braucht.

Die LED-Signale kommen vom Makro `RF_LED_SIGNAL` aus `rf_led.cfg`. Fehlt es, schaltet die Seite die LED mit `SET_LED`.

Die Update-Seite prüft Prozessor, Takt und Baudrate gegen `files/mcu-build-config-atmega2560`. Scheitert der Firmware-Bau, geht `~/klipper` auf den alten Stand zurück.

Bauen auf einem Linux-System mit `dpkg-deb`: `./build_deb.sh 1.3.0`
