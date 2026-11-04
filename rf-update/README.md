# Firmware-Update für ATmega2560 über Mainsail

Fügt Mainsail den Menüpunkt **Firmware-Update** hinzu. Die Klipper-Firmware eines ATmega2560-Boards lässt sich damit per Knopfdruck aktualisieren.

Der Ablauf holt den neuesten Stand des Repos, aus dem `~/klipper` stammt, baut die Firmware und schreibt sie mit `avrdude` auf das Board. Der Anschluss kommt aus dem Abschnitt `[mcu]` der `printer.cfg`.

Die Update-Seite prüft Prozessor, Takt und Baudrate gegen `files/mcu-build-config-atmega2560`. Scheitert der Firmware-Bau, geht `~/klipper` auf den alten Stand zurück.

Bauen auf einem Linux-System mit `dpkg-deb`: `./build_deb.sh 1.3.0`
