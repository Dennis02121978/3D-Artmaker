# Bis zu 4 Drucker an einem Raspberry Pi

Das Paket `rf-multi` richtet für jeden weiteren Drucker eine eigene Klipper- und Moonraker-Instanz ein. Der erste Drucker bleibt dabei unverändert.

| | Erster Drucker | Jeder weitere Drucker |
|---|---|---|
| Ordner | `~/printer_data` | `~/printer_<Name>_data` |
| Dienste | `klipper`, `moonraker` | `klipper-<Name>`, `moonraker-<Name>` |
| Moonraker-Port | 7125 | 7126, 7127, 7128 |
| Mainsail | `http://<IP>` | `http://<IP>:81`, `:82`, `:83` |

Außerdem:

- **Mainsail:** Jedes Mainsail zeigt links ganz oben den Menüpunkt „Drucker“ mit allen Druckern zum Wechseln.
- **KlipperScreen:** Beim Start erscheint die Druckerauswahl (`[printer …]`-Abschnitte in `KlipperScreen.conf`). Gewechselt wird über das Drucker-Symbol in der Leiste am linken Rand.
- **Firmware-Update (`rf-update`):** Die Update-Seite zeigt alle Drucker. Tippst du einen an, blinkt seine LED rot. Während des Updates leuchtet sie rot, danach 5 Sekunden grün.
- **Config:** Vorlagen für den RF2000 v2 Dual (1,75 mm) und den RF2000 Dual (3 mm), beide aus dem Renkforce Klipper Config Creator. Anschluss und Pfade werden automatisch eingetragen. Eigene Dateien aus dem Creator (dort Nummer und Name des Druckers wählen) lädst du danach im Mainsail des Druckers hoch.

## Bedienung

```bash
sudo rf-multi            # Assistent: Anschluss, Config-Vorlage und Name wählen
sudo rf-multi list       # Drucker und freie Anschlüsse anzeigen
sudo rf-multi sync       # Mainsail und KlipperScreen neu abgleichen
sudo rf-multi remove RF2000
```

Ohne Rückfragen:

```bash
sudo rf-multi add --name RF2000 \
  --serial /dev/serial/by-id/usb-FTDI_FT232R_USB_UART_A104N1FC-if00-port0 \
  --config RF2000_DualExtruder_3mm
```

`remove` hält die Dienste an und entfernt sie samt Mainsail-Port. Der Ordner `~/printer_<Name>_data` mit Config und G-Codes bleibt erhalten.

## Hinweise

- Alle Drucker nutzen dasselbe `~/klipper`. Nach einem Firmware-Update eines Druckers braucht meist auch der andere die neue Firmware. Die Update-Seite zeigt das an.
- Updates von Klipper, Moonraker und Mainsail laufen über den Update-Manager des ersten Druckers.
- Höchstens 4 Drucker pro Raspberry Pi. Ein Pi 3 schafft zwei Drucker gut. Für drei oder vier gleichzeitig druckende Drucker ist ein Pi 4 oder Pi 5 besser.
- Die Druckerauswahl in Mainsail enthält die IP-Adresse des Pi. Ändert sie sich, `sudo rf-multi sync` ausführen. `http://<IP>:81` funktioniert immer.

Bauen auf einem Linux-System mit `dpkg-deb`: `./build_deb.sh 1.5.0`
