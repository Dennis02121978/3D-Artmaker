# Installationsanleitung für Einsteiger

Diese Anleitung führt dich Schritt für Schritt durch die Installation. Du brauchst keine Linux-Kenntnisse. Alle Befehle kannst du einfach kopieren und einfügen.

**Das dauert etwa 10 Minuten pro Paket.** Beim Firmware Updater kann es etwas länger dauern, weil dein Drucker dafür zusätzliche Programme herunterlädt.

## Inhalt

1. [Welches Paket brauche ich?](#1-welches-paket-brauche-ich)
2. [Das brauchst du vorher](#2-das-brauchst-du-vorher)
3. [Mit dem Drucker verbinden](#3-mit-dem-drucker-verbinden)
4. [Paket installieren](#4-paket-installieren)
   - [2in1-Config für Klipper](#2in1-config-für-klipper)
   - [3D-Artmaker 2in1 Hotend](#3d-artmaker-2in1-hotend)
   - [3D-Artmaker Firmware Updater](#3d-artmaker-firmware-updater)
   - [3D-Artmaker Firmware Updater ATmega](#3d-artmaker-firmware-updater-atmega)
   - [Mehrere Drucker an einem Raspberry Pi](#mehrere-drucker-an-einem-raspberry-pi)
   - [3D-Artmaker BootScreen](#3d-artmaker-bootscreen)
   - [3D-Artmaker BootScreen Pi](#3d-artmaker-bootscreen-pi)
   - [System Terminal](#system-terminal)
5. [Updates installieren](#5-updates-installieren)
6. [Wenn etwas nicht klappt](#6-wenn-etwas-nicht-klappt)
7. [Paket wieder entfernen](#7-paket-wieder-entfernen)
8. [Häufige Fragen](#8-häufige-fragen)

## 1. Welches Paket brauche ich?

Du kannst dir aussuchen, was du haben möchtest. Jedes Paket funktioniert allein, du musst also nicht alle installieren.

| Paket | Was es macht | Passt für dich, wenn … |
|---|---|---|
| **3D-Artmaker 2in1 Hotend** | Zeigt in Mainsail die beiden Extruder, die Filamentschalter und das Hotend live an. Mit Knöpfen startest du das Laden des Filaments. | du zwei Extruder an einem 2in1-Hotend hast und deine Klipper-Config [die nötigen Einträge](#3d-artmaker-2in1-hotend) enthält. |
| **3D-Artmaker Firmware Updater** | Aktualisiert die Klipper-Firmware deines Boards per Knopfdruck in Mainsail. | du ein MKS-SKIPR-Board mit Micro-SD im MCU-Slot hast. |
| **3D-Artmaker Firmware Updater ATmega** | Aktualisiert die Klipper-Firmware deines ATmega-Boards per Knopfdruck in Mainsail. | dein Board einen ATmega2560 mit 16 MHz hat und mit 250000 Baud läuft, zum Beispiel beim RF1000 oder RF2000. |
| **3D-Artmaker BootScreen** | Zeigt beim Einschalten das 3D-Artmaker-Logo auf dem Display. | du Armbian, KlipperScreen und ein 480x320-Display mit dem Treiber `fb_st7796` hast. |
| **3D-Artmaker BootScreen Pi** | Zeigt beim Einschalten das 3D-Artmaker-Logo auf dem Display. | du einen Raspberry Pi mit KlipperScreen und einem funktionierenden 480x320-SPI-Display hast, zum Beispiel einem 3,5-Zoll-RPi-LCD. |
| **System Terminal** | Fügt Mainsail den Menüpunkt **System Terminal** hinzu: ein Terminal im Browser wie per SSH, mit Anmeldung über Benutzername und Passwort. | du ohne PowerShell oder Terminal-Programm Befehle auf dem Drucker eingeben willst. |
| **Mehrere Drucker (rf-multi)** | Betreibt bis zu 4 Drucker an einem Raspberry Pi, jeden mit eigenem Mainsail und mit Druckerauswahl in KlipperScreen. | du weitere RF-Drucker per USB an denselben Raspberry Pi anschließen willst. |

Für das 2in1-Hotend gibt es außerdem eine fertige [Klipper-Config](#2in1-config-für-klipper) mit den Makros für Werkzeugwechsel, Druckstart und Laden. Sie ist für den RF2000 mit 2in1-Umbau gemacht. Hast du schon eine passende Config, brauchst du sie nicht.

> [!CAUTION]
> Den **Firmware Updater** nur auf dem **MKS-SKIPR-Board** verwenden. Die Update-Seite prüft den Prozessor des Boards und sperrt das Update bei anderen Prozessoren. Installiere das Paket trotzdem nicht auf anderen Druckern.

## 2. Das brauchst du vorher

- [ ] Dein Drucker ist **eingeschaltet** und mit dem **Internet** verbunden.
- [ ] Dein Computer ist im **selben Netzwerk** wie der Drucker.
- [ ] Du nutzt **Klipper** und **Mainsail**.
- [ ] Es läuft gerade **kein Druck**.
- [ ] Du hast deine Einstellungen gesichert: Öffne in Mainsail links **Maschine** und lade zumindest die `printer.cfg` und die `moonraker.conf` herunter.

### Die IP-Adresse deines Druckers finden

Die IP-Adresse ist die „Hausnummer“ deines Druckers im Netzwerk. Öffne Mainsail im Browser und schau in die Adresszeile ganz oben. Dort steht zum Beispiel:

```text
http://192.168.1.50
```

Dann ist **192.168.1.50** deine IP-Adresse. Merke sie dir, du brauchst sie gleich.

> [!NOTE]
> Steht dort ein Name statt einer Zahl, zum Beispiel `mkspi.local`, kannst du diesen Namen genauso verwenden.

## 3. Mit dem Drucker verbinden

Die Befehle gibst du in einem Terminal ein. Das ist ein Fenster, in dem du deinem Computer oder Drucker Befehle als Text gibst.

### Terminal öffnen

| Dein Computer | So geht es |
|---|---|
| **Windows** | Windows-Taste drücken, `PowerShell` eingeben und mit Enter öffnen. |
| **Mac** | Cmd + Leertaste drücken, `Terminal` eingeben und mit Enter öffnen. |
| **Linux** | Das Programm **Terminal** öffnen. |

### Befehle einfügen

Auf GitHub erscheint rechts oben an jedem Befehlsblock ein kleines Kopier-Symbol, wenn du mit der Maus darüberfährst. Klicke darauf und füge den Befehl dann im Terminal ein:

| Dein Computer | Einfügen im Terminal |
|---|---|
| **Windows** | Rechtsklick ins Fenster |
| **Mac** | Cmd + V |
| **Linux** | Strg + Umschalt + V |

Drücke danach **Enter**, damit der Befehl startet.

### Verbindung herstellen

Gib diesen Befehl ein und **ersetze die Beispiel-IP durch deine eigene**:

```bash
ssh mks@192.168.1.50
```

Jetzt passiert Folgendes:

1. Bei der ersten Verbindung fragt das Terminal etwas mit `yes/no`. Tippe `yes` aus und drücke Enter.
2. Dann fragt es nach dem Passwort. Bei MKS-Boards ist es oft `makerbase`.
3. Tippe das Passwort ein und drücke Enter.

> [!IMPORTANT]
> Beim Tippen des Passworts siehst du **gar nichts**, auch keine Sternchen. Das ist normal, dein Tippen kommt trotzdem an.

**Geklappt?** Vorne in der Zeile steht jetzt so etwas wie `mks@mkspi:~$`. Alle weiteren Befehle laufen jetzt auf deinem Drucker und nicht auf deinem Computer.

## 4. Paket installieren

Wähle unten dein Paket aus und führe die Blöcke **der Reihe nach** aus. Warte jeweils, bis wieder die Zeile mit `mks@…:~$` erscheint.

Möchtest du mehrere Pakete haben, gehst du die Abschnitte einfach nacheinander durch. Die Verbindung aus Schritt 3 kann dabei offen bleiben.

---

### 2in1-Config für Klipper

Diese Datei bringt alles mit, was das 2in1-Hotend in Klipper braucht: Werkzeugwechsel, `PRINT_START`, `PRINT_END`, die Filamentschalter und `EXTRUDER_LADEN`.

> [!WARNING]
> Die Config ist für einen **RF2000 mit MKS-SKIPR-Board und 2in1-Umbau** gemacht und dort gemessen. Auf einem anderen Drucker können falsche Werte zu Filamentstau oder einer Kollision führen. Prüfe deshalb die folgende Liste, bevor du die Datei aktivierst.

**1. Das muss schon in deiner `printer.cfg` stehen:**

```ini
[extruder]
max_extrude_only_distance: 150.0

[extruder_stepper extruder1]
extruder:
```

Unter `[extruder_stepper extruder1]` kommen noch die Pins deines zweiten Extruders. Wichtig ist, dass hinter `extruder:` nichts steht. Außerdem muss deine `printer.cfg` die Zeile `[include mainsail.cfg]` enthalten, weil die Config die Pause und Meldungen von dort nutzt.

**2. Passe diese Werte in `2in1_hotend.cfg` an, falls dein Drucker abweicht:**

| Eintrag | Wert in der Datei | Bedeutung |
|---|---|---|
| `pin:` bei den beiden `gcode_button` | `PE15` und `PD9` | Anschlüsse der Filamentschalter |
| `variable_prime_dist`, `variable_load_dist` | `65` | Strecke vom Schalter bis zum Hotend in mm. **Miss sie an deinem Drucker nach.** |
| `variable_park_dist` | `70` | Parkposition: 5 mm hinter dem Schalter |
| `variable_purge_y` | `-25` | Geht nur, wenn deine Y-Achse `position_min: -25` hat |
| `G1 X0 Y200` in `PRINT_END` | | Position am Druckende, muss auf deinem Bett erreichbar sein |
| `SET_LED LED=Led …` in `PRINT_END` | | Braucht `[neopixel Led]`. Ohne diese LED löschst du die Zeile. |

**3. Prüfe, ob etwas doppelt vorkommt.** Entferne aus deinen anderen Config-Dateien:

- einen `filament_switch_sensor`, der dieselben Pins nutzt
- eigene Makros mit diesen Namen: `PRINT_START`, `PRINT_END`, `T0`, `T1`, `EXTRUDER_LADEN`

**4. Datei auf den Drucker laden.** Gibt es dort schon eine Datei mit diesem Namen, wird sie vorher als `.bak` gesichert:

```bash
cd ~/printer_data/config
[ -f 2in1_hotend.cfg ] && cp 2in1_hotend.cfg 2in1_hotend.cfg.bak
wget -O 2in1_hotend.cfg https://raw.githubusercontent.com/Dennis02121978/3D-Artmaker/8774fffaa6127eeb4bd9101de120080e8603965d/config/2in1_hotend.cfg
cd ~
```

**5. Datei prüfen:**

```bash
echo "b644d45514473574fa77f121dc7d8036331e89c24f9c9b230f3c624b6a27c9ce  printer_data/config/2in1_hotend.cfg" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Änderst du die Datei später, passt die Prüfsumme natürlich nicht mehr.

**6. Config aktivieren:**

1. Öffne in Mainsail links **Maschine**.
2. Öffne unter **Konfigurationsdateien** die Datei `printer.cfg`.
3. Füge bei den anderen `[include …]`-Zeilen diese Zeile hinzu:

   ```ini
   [include 2in1_hotend.cfg]
   ```

4. Klicke oben auf **Speichern & Neustart**.

**Geklappt?** Klipper startet ohne Fehlermeldung neu. Meldet Klipper einen Fehler, lies zuerst den Text. Schau dazu in die [Fehlertabelle](#bei-der-2in1-config). Um alles rückgängig zu machen, löschst du die Zeile wieder und klickst noch einmal auf **Speichern & Neustart**.

**7. Slicer einstellen.** Trage in OrcaSlicer beim Drucker unter **Maschinen-G-Code** ein:

Start-G-Code:

```text
PRINT_START EXTRUDER_TEMP=[nozzle_temperature_initial_layer] BED_TEMP=[bed_temperature_initial_layer_single] PRINT_MIN={first_layer_print_min[0]},{first_layer_print_min[1]} PRINT_MAX={first_layer_print_max[0]},{first_layer_print_max[1]} INITIAL_TOOL=[initial_tool] USED_T0={is_extruder_used[0]} USED_T1={is_extruder_used[1]}
```

End-G-Code:

```text
PRINT_END
```

> [!NOTE]
> `PRINT_MIN` und `PRINT_MAX` sind für ein adaptives Bettnetz gedacht, das ein eigenes `BED_MESH_CALIBRATE`-Makro braucht. Hast du keines, lass diese beiden Angaben weg. Dann wird das normale Bettnetz gemessen.

**8. Vorsichtig testen:**

1. Lege beide Filamente ein. Die Düse muss frei über dem Bett stehen.
2. Halte den **Not-Halt** in Mainsail bereit.
3. Gib in der Mainsail-Konsole `EXTRUDER_LADEN` ein. Der Drucker heizt selbst auf mindestens 190 °C und lädt dann beide Filamente.
4. Dreht das Filament durch oder staut es sich, drücke den Not-Halt und prüfe die Strecken aus Schritt 2.

> [!IMPORTANT]
> Bleib beim ersten Druck mit Werkzeugwechsel am Drucker und beobachte die Wechsel.

---

### 3D-Artmaker 2in1 Hotend

**Prüfe zuerst deine Klipper-Config.** Die Seite ändert sie nicht, deshalb müssen diese Einträge schon vorhanden sein. Mit der [2in1-Config](#2in1-config-für-klipper) sind sie es bereits:

```ini
[gcode_button filament_sensor_left]
[gcode_button filament_sensor_right]
[gcode_macro _TOOL_STATE]
[gcode_macro EXTRUDER_LADEN]
```

- `_TOOL_STATE` muss die Variablen `active_tool`, `prime_dist` und `park_dist` enthalten.
- `EXTRUDER_LADEN` muss den Parameter `TOOL` kennen, sonst funktionieren die Knöpfe **Nur T0 laden** und **Nur T1 laden** nicht.

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/skipr-filament_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "176d923a94d852ec83b391310d1ad1b4839efe943a5cd0c0da33575f7c208906  skipr-filament_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./skipr-filament_1.5.9_all.deb
```

Wird nach einem Passwort gefragt, gib es noch einmal ein. Kommt eine Frage mit `J/n` oder `Y/n`, drücke `J` oder `Y` und dann Enter.

**Geklappt?** Am Ende steht `Filament-Anzeige ist installiert`. Mainsail verliert dabei kurz die Verbindung, das ist normal.

**4. Seite öffnen:** Lade Mainsail mit **F5** neu. Links erscheint der Menüpunkt **Filament 2in1**.

> [!WARNING]
> Das Laden startet **sofort nach dem Klick**, ohne Rückfrage. Die Düse muss frei über dem Bett stehen, weil Material austreten kann. Zum Stoppen benutzt du den **Not-Halt** in Mainsail.

---

### 3D-Artmaker Firmware Updater

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/skipr-update_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "9c7b4a4ac3d87e344b09901cd36b4715b821a799200c743502ce8ec85f527a13  skipr-update_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./skipr-update_1.5.9_all.deb
```

Wird nach einem Passwort gefragt, gib es noch einmal ein. Kommt eine Frage mit `J/n` oder `Y/n`, drücke `J` oder `Y` und dann Enter. Das kann ein paar Minuten dauern.

**Geklappt?** Am Ende steht `Firmware-Update ist installiert`. Mainsail verliert dabei kurz die Verbindung, das ist normal.

**4. Firmware aktualisieren:**

1. Lade Mainsail mit **F5** neu.
2. Klicke links auf **Firmware-Update**. Fehlt der Punkt, öffne direkt `http://192.168.1.50/update/` mit deiner eigenen IP.
3. Klicke auf **Update starten** und dann auf **Ja, jetzt starten**.
4. Warte, bis der Drucker neu gestartet hat und **Update erfolgreich** erscheint.

> [!CAUTION]
> **Schalte den Drucker während des Firmware-Updates nicht aus!** Das Browserfenster darfst du schließen, das Update läuft trotzdem weiter. Mainsail ist zwischendurch nicht erreichbar, das ist normal.

---

### 3D-Artmaker Firmware Updater ATmega

Dieses Paket gehört zu Boards mit **ATmega2560**. Pro Drucker kannst du nur einen der beiden Firmware Updater installieren.

> [!IMPORTANT]
> Der Knopf holt den neuesten Stand des Repos, aus dem dein `~/klipper` stammt, und schreibt ihn auf das Board. Der Update-Stand hängt also von diesem Repo ab. Dein Klipper-Ordner darf keine eigenen Änderungen enthalten.

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/rf-update_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "7e1cad45206bdc3d8b754c6b4c6e6a212771d9c6088fa68ef098a24c9ed12670  rf-update_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./rf-update_1.5.9_all.deb
```

Wird nach einem Passwort gefragt, gib es noch einmal ein. Kommt eine Frage mit `J/n` oder `Y/n`, drücke `J` oder `Y` und dann Enter.

**Geklappt?** Am Ende steht `Firmware-Update ist installiert`. Mainsail verliert dabei kurz die Verbindung, das ist normal.

**4. Firmware aktualisieren:**

1. Lade Mainsail mit **F5** neu.
2. Klicke links auf **Firmware-Update**.
3. Hängen mehrere Drucker am Raspberry Pi, tippe den Drucker an, den du aktualisieren willst. Auf seinem Display blinkt dann 30 Sekunden ein Rahmen mit **FIRMWARE-UPDATE – DIESER DRUCKER**, dazu blinkt die LED rot. Der RF1000 hat keine LED, dort zeigt nur das Display die Meldung. So siehst du, welcher es ist. Ist schon ein Drucker gewählt (zum Beispiel nach einem Update), blinkt er gleich beim Öffnen der Seite. Sind alle Drucker aktuell, steht dort **Alle Drucker sind auf dem neuesten Stand**.
4. Klicke auf **Update starten** und dann auf **Ja, jetzt starten**. Während des Updates steht **UPDATE LAEUFT – NICHT AUSSCHALTEN** auf dem Display und die LED leuchtet rot. Beim Schreiben der Firmware sind beide kurz aus, weil das Board neu startet.
5. Warte, bis **Update erfolgreich** erscheint. Bei mehreren Druckern bleibt die Auswahl darunter stehen, du kannst gleich den nächsten Drucker aktualisieren. Auch ein Drucker, der schon die aktuelle Firmware hat, lässt sich mit **Firmware neu aufspielen** noch einmal flashen. Das Display zeigt dann kurz **ERFOLGREICH**, die LED leuchtet 5 Sekunden grün. Das dauert meist nur wenige Minuten. Der Raspberry Pi startet dabei nicht neu.
6. Bei zwei Druckern: Zeigt die Seite danach an, dass auch der andere Drucker die neue Firmware braucht, aktualisiere ihn gleich mit. Beide nutzen dasselbe Klipper.

Ab v1.5.6 stellt das Paket außerdem die USB-Wandler (FTDI) der Drucker auf 1 ms Wartezeit. Klipper reagiert dadurch schneller, und die SD-Karte im Drucker lässt sich etwa dreimal so schnell lesen.

Die Display-Meldung braucht die `rf_display.cfg` (RF1000: `rf_display_rf1000.cfg`) ab v1.5.9, die LED-Signale die `rf_led.cfg` ab v1.5.0. Ohne sie schaltet die Seite die LED nur ein und aus. Läuft auf einem Drucker noch die Repetier-Firmware, gibt es weder Meldung noch LED-Signal. Das Update schreibt die Klipper-Firmware trotzdem.

> [!CAUTION]
> **Schalte den Drucker während des Firmware-Updates nicht aus!** Bricht das Schreiben trotzdem ab, schalte den Drucker aus und wieder ein und starte das Update erneut.

---

### Mehrere Drucker an einem Raspberry Pi

Mit dem Paket **rf-multi** laufen bis zu 4 Drucker an einem Raspberry Pi. Jeder Drucker bekommt eigenes Klipper, eigenes Moonraker und ein eigenes Mainsail. Der erste Drucker bleibt, wie er ist.

> [!IMPORTANT]
> Der erste Drucker muss schon laufen (Klipper, Moonraker, Mainsail), zum Beispiel mit dem Image für den RF2000 v2. Der zweite Drucker wird per USB angeschlossen und eingeschaltet, bevor du anfängst.

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/rf-multi_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "dd74fb76d190a78177f44153e2e10edbafae959ac215f28c9555bc4442617ed4  rf-multi_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen.

**3. Installieren:**

```bash
sudo apt install ./rf-multi_1.5.9_all.deb
```

**4. Weiteren Drucker einrichten:**

```bash
sudo rf-multi
```

Der Assistent fragt nacheinander:

1. **Anschluss:** Es erscheinen nur Anschlüsse, die noch keinem Drucker gehören. Hängt nur der neue Drucker zusätzlich am Pi, gibt es genau einen. Drücke Enter.
2. **Config-Vorlage:** `RF2000 v2 Dual Extruder, Filament 1,75 mm` oder `RF2000 Dual Extruder, Filament 3 mm`. Zahl eingeben und Enter.
3. **Name:** zum Beispiel `RF2000`. Nur Buchstaben, Ziffern, `-` und `_`, keine Leerzeichen.
4. **Jetzt einrichten?** Enter.

**Geklappt?** Am Ende steht `Fertig. Der Drucker RF2000 ist eingerichtet` mit der Adresse des neuen Mainsail.

**5. Drucker benutzen:**

- **Mainsail:** Den ersten Drucker erreichst du wie bisher unter `http://<IP>`, den zweiten unter `http://<IP>:81`, den dritten unter `:82` und den vierten unter `:83`. Außerdem steht in jedem Mainsail links ganz oben der Menüpunkt **Drucker**. Dort siehst du beide Drucker und wechselst mit einem Klick.
- **KlipperScreen:** Beim Start erscheint eine Auswahl der Drucker. Später wechselst du über das Drucker-Symbol in der Leiste am linken Rand.
- **Firmware-Update:** Der Menüpunkt **Firmware-Update** zeigt beide Drucker zur Auswahl (siehe oben).

> [!WARNING]
> Prüfe die Config des neuen Druckers vor dem ersten Druck: Endstops, Fahrwege, Temperaturen, PID und Bettnetz. Die Config für den RF2000 mit 3 mm ist noch an keinem echten RF2000 getestet. Was zu prüfen ist, steht in der README im Config-Ordner.

Für den dritten und vierten Drucker wiederholst du Schritt 4. Ein Raspberry Pi 3 schafft zwei Drucker gut. Sollen drei oder vier gleichzeitig drucken, nimm einen Raspberry Pi 4 oder 5.

**Eigene Config aus dem Config Creator:** Stelle im Creator auf der ersten Seite ein, wie viele Drucker am Raspberry Pi hängen. Jeder Drucker hat eigene Einstellungen (Modell, Single oder Dual, Filament, Anschluss …), oben wechselst du per Leiste zwischen ihnen. Verwende dieselben Namen wie in `sudo rf-multi`. Mit **Alle Drucker als ZIP** lädst du alles auf einmal, mit einem Ordner pro Drucker. Lade die erzeugten Dateien dann im Mainsail dieses Druckers (zum Beispiel `http://<IP>:81`) unter **Maschine** hoch und klicke auf **Speichern & Neustart**.

Einen Drucker wieder entfernen: `sudo rf-multi remove RF2000`. Der Ordner mit Config und G-Codes bleibt dabei erhalten.

---

### 3D-Artmaker BootScreen

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/skipr-bootlogo_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "4722d0d66b13635f3b9d1b7aff571a9e5919ec9b248cef8a8279182eb997fe1b  skipr-bootlogo_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./skipr-bootlogo_1.5.9_all.deb
```

Wird nach einem Passwort gefragt, gib es noch einmal ein. Kommt eine Frage mit `J/n` oder `Y/n`, drücke `J` oder `Y` und dann Enter.

**Geklappt?** Am Ende steht `Logo ist installiert`. Mainsail verliert dabei kurz die Verbindung, das ist normal.

**4. Drucker neu starten:**

```bash
sudo reboot
```

Das Logo erscheint jetzt beim Start, bis KlipperScreen geladen ist. Die Verbindung im Terminal bricht dabei ab, das Fenster kannst du schließen.

---

### 3D-Artmaker BootScreen Pi

Dieses Paket ist für den Raspberry Pi. Das Display muss schon funktionieren, das Paket richtet es nicht ein.

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/rf-bootlogo_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "e99352adfe5ce186951872e2d518b5605856f71a21ae0ef08451b49f13935b5f  rf-bootlogo_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./rf-bootlogo_1.5.9_all.deb
```

Wird nach einem Passwort gefragt, gib es noch einmal ein. Kommt eine Frage mit `J/n` oder `Y/n`, drücke `J` oder `Y` und dann Enter. Dein Drucker lädt dabei ImageMagick nach, das dauert einen Moment.

**Geklappt?** Am Ende steht `Logo ist installiert`. Mainsail verliert dabei kurz die Verbindung, das ist normal.

**4. Drucker neu starten:**

```bash
sudo reboot
```

Die Verbindung im Terminal bricht dabei ab, das Fenster kannst du schließen.

**So sieht der Start danach aus** (gemessen auf einem Raspberry Pi 3):

1. Das Display bleibt etwa 13 Sekunden weiß, bis der Treiber geladen ist. Das lässt sich mit diesem Paket nicht ändern.
2. Das Logo erscheint.
3. Kurz bevor KlipperScreen kommt, wird das Bild für einen Moment schwarz, dann ist das Logo wieder da.
4. KlipperScreen erscheint, auf dem Pi 3 nach etwa 40 Sekunden.

> [!NOTE]
> Die Startmeldungen werden ausgeblendet. Hängt ein HDMI-Monitor am Pi, siehst du dort beim Start voraussichtlich auch keinen Text mehr.

---

### System Terminal

Dieses Paket fügt Mainsail links den Menüpunkt **System Terminal** hinzu. Dort bekommst du ein Terminal im Browser und kannst alles machen wie per SSH. Es passt für den Raspberry Pi und für das MKS-SKIPR-Board.

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.5.9/rf-terminal_1.5.9_all.deb
```

**2. Datei prüfen:**

```bash
echo "db9f0fb135ff8df363fa847e570538449c219ab9ae0abda00dad70e60bcb6bfa  rf-terminal_1.5.9_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt install ./rf-terminal_1.5.9_all.deb
```

**Geklappt?** Am Ende steht `System-Terminal ist installiert`.

**4. Benutzen:** Lade Mainsail mit **F5** neu und klicke links auf **System Terminal**. Melde dich mit demselben Benutzer und Passwort an wie bei SSH (beim Raspberry-Pi-Image `pi`, beim SKIPR `mks`). Beim Tippen des Passworts siehst du nichts, das ist normal. Mit `exit` meldest du dich ab.

> [!WARNING]
> Wer das Passwort kennt, kann über diese Seite alles auf dem Drucker ändern. Ändere deshalb das Standard-Passwort mit `passwd` und gib den Drucker **nicht** im Router für das Internet frei.

---

### Fertig: Verbindung trennen

Hast du alles installiert, gibst du das hier ein und schließt danach das Fenster:

```bash
exit
```

## 5. Updates installieren

Jedes installierte Paket hat in Mainsail einen eigenen Eintrag. Für Updates brauchst du kein Terminal:

1. Öffne in Mainsail links **Maschine**.
2. Suche den Bereich **Update Manager**.
3. Klicke dort auf das Symbol **auf Aktualisierungen prüfen**.
4. Steht bei einem 3D-Artmaker-Eintrag ein Update bereit, klicke dort auf **update**.
5. Lade die Seite danach mit **F5** neu.

Starte Updates am besten nur, wenn kein Druck läuft.

| Eintrag | Was der Klick erneuert | Was du sonst noch tun musst |
|---|---|---|
| **3D-Artmaker 2in1 Hotend** | Die Anzeige-Seite | Bei Änderungen am Installationsteil die neue `.deb` installieren |
| **3D-Artmaker Firmware Updater** | Nur die Webseite | Bei einem Hinweis auf der Update-Seite die neue `.deb` installieren |
| **3D-Artmaker Firmware Updater ATmega** | Nur die Webseite | Bei einem Hinweis auf der Update-Seite die neue `.deb` installieren |
| **3D-Artmaker BootScreen** | Nur das Logo, es erscheint beim nächsten Start | Bei Änderungen an den Start-Einstellungen die neue `.deb` installieren |
| **3D-Artmaker BootScreen Pi** | Nur das Logo, es erscheint beim nächsten Start | Bei Änderungen an den Start-Einstellungen die neue `.deb` installieren |

Ob eine neue `.deb` nötig ist und wie sie heißt, steht beim jeweiligen [Release](https://github.com/Dennis02121978/3D-Artmaker/releases). Du wiederholst dann die Schritte aus [Abschnitt 4](#4-paket-installieren) mit dem neuen Dateinamen und der neuen Prüfsumme aus der Datei `SHA256SUMS`. Das alte Paket musst du vorher nicht entfernen.

> [!NOTE]
> Alle Pakete haben dieselbe Versionsnummer. Mainsail bietet deshalb auch dann ein Update an, wenn sich bei deinem Paket gar nichts geändert hat. Das schadet nicht.

### Warum wird nicht alles per Klick aktualisiert?

Das ist Absicht und dient deiner Sicherheit. Manche Teile laufen mit Administratorrechten. Könnte der Update Manager sie einfach ersetzen, wäre das eine Sicherheitslücke auf deinem Drucker.

## 6. Wenn etwas nicht klappt

### Beim Verbinden

| Meldung | Was du tun kannst |
|---|---|
| `Connection refused` oder `Connection timed out` | Prüfe die IP-Adresse und ob dein Computer im selben Netzwerk ist. |
| `Permission denied` | Das Passwort stimmt nicht. Tippe es noch einmal in Ruhe ein. |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | Das kommt oft nach einer Neuinstallation des Druckers vor. Wenn das auf dich zutrifft, gib auf deinem Computer `ssh-keygen -R 192.168.1.50` mit deiner IP ein und verbinde dich neu. Sonst frage lieber zuerst nach. |
| `ssh` wird nicht erkannt (Windows) | Nutze ein aktuelles Windows 10 oder 11 und die PowerShell. |

### Beim Installieren

| Meldung | Was du tun kannst |
|---|---|
| `Unable to locate package` oder `Datei nicht gefunden` | Du bist vermutlich im falschen Ordner, oder `./` fehlt vor dem Dateinamen. Gib `cd ~` ein und kopiere den Befehl noch einmal. |
| `sha256sum` meldet `FAILED` | Die Datei ist beschädigt. Lösche sie mit `rm` und dem Dateinamen, und lade sie neu herunter. Klappt es dann immer noch nicht, installiere nicht weiter. |
| `Failed to fetch` oder `Temporary failure resolving` | Dein Drucker erreicht das Internet nicht. Prüfe die Verbindung und versuche es noch einmal. |
| `Der Dienst klipper.service wurde nicht gefunden` | Klipper ist nicht wie erwartet installiert. |
| `Mainsail mit nginx wurde nicht gefunden` | Die Pakete 2in1 Hotend und Firmware Updater brauchen Mainsail mit nginx. Fluidd allein reicht nicht. |
| `Die nginx-Konfiguration von Mainsail hat ein unbekanntes Format` | Deine Mainsail-Einstellungen weichen vom Standard ab. Es wurde nichts geändert. |
| `Klipper wurde nicht unter … gefunden` | Der Firmware Updater erwartet Klipper im Home-Ordner des Klipper-Benutzers. |
| `Dieses Paket ist nur fuer Armbian` | Der BootScreen läuft auf deinem System nicht. |
| `Der Displaytreiber fb_st7796 wurde nicht gefunden` | Dein Display wird vom BootScreen nicht unterstützt. |
| `Dieses Paket ist nur fuer den Raspberry Pi` | Du hast den BootScreen Pi auf einem anderen System installiert. Unter Armbian nimmst du `skipr-bootlogo`. |
| `Kein SPI-Display gefunden` | Das Display läuft noch nicht. Richte es zuerst ein, oder es wird nicht unterstützt. |
| `Das Logo passt nur auf ein 480x320-Display im Querformat` | Dein Display hat eine andere Auflösung oder steht im Hochformat. |
| `KlipperScreen laeuft mit Wayland` | Der BootScreen Pi funktioniert nur, wenn KlipperScreen mit X11 läuft. |
| `KlipperScreen wurde nicht gefunden` | Installiere zuerst KlipperScreen. |
| `Das Logo passt nur auf ein 480x320-Display` | Dein Display hat eine andere Auflösung. |

> [!TIP]
> Bricht die Installation mit einer dieser Prüfungen ab, wurde an deinem Drucker noch nichts geändert.

Taucht während der Installation eine Zeile auf, die mit `N:` beginnt und `unsandboxed` enthält, kannst du sie ignorieren. Das ist nur ein Hinweis und kein Fehler.

### Bei der 2in1-Config

| Meldung | Was du tun kannst |
|---|---|
| `pin PE15 used multiple times` oder ähnlich | Ein anderer Eintrag nutzt denselben Pin, oft ein alter `filament_switch_sensor`. Entferne ihn. |
| `Unknown pin` oder ein Fehler beim Pin | Der Pin passt nicht zu deinem Board. Trage deine eigenen Pins ein. |
| `Extrude only move too long` | In `[extruder]` fehlt `max_extrude_only_distance: 150.0`. |
| Fehler mit `SYNC_EXTRUDER_MOTION` oder `extruder1` | In deiner `printer.cfg` fehlt `[extruder_stepper extruder1]` oder der Name ist anders. |
| `Move out of range` | Eine Position passt nicht zu deinem Drucker, oft `variable_purge_y` oder `G1 X0 Y200`. |
| Fehler mit `SET_LED` | Du hast keine LED namens `Led`. Lösche die Zeile in `PRINT_END`. |
| `T0 Filament erreicht den Sensor nicht` oder ein ähnlicher Abbruch | Prüfe, ob das Filament eingelegt ist und der Schalter auslöst. Das gilt genauso für T1. |
| `T0 Sensor wird nicht frei` | Das Filament kommt beim Rückzug nicht vom Schalter weg. Prüfe Filament, Schalter und die Strecken. |

### Nach der Installation

| Problem | Was du tun kannst |
|---|---|
| Der Menüpunkt fehlt | Lade Mainsail mit **F5** neu. |
| Die Filament-Anzeige bleibt leer, oder ein Knopf meldet einen Fehler | In deiner Klipper-Config fehlt einer der [nötigen Einträge](#3d-artmaker-2in1-hotend). |
| `Dieses Update ist nur für das MKS-SKIPR-Board` | Das Paket passt nicht zu deinem Board. Bitte nicht weiter versuchen. |
| `Gerade läuft ein Druck` | Warte, bis der Druck fertig ist. |
| `Dieses Update ist nur für Boards mit ATmega2560` oder `Die Firmware passt nicht zu deinem Board` | Das ATmega-Paket passt nicht zu deinem Board. Bitte nicht weiter versuchen. |
| `Im Klipper-Ordner gibt es eigene Änderungen` | Im Ordner `~/klipper` wurden Dateien geändert. Kläre das zuerst, sonst könnten deine Änderungen verloren gehen. |
| Das Firmware-Update hat nicht geklappt | Befolge den Hinweis auf der Seite und klicke auf **Erneut versuchen**. Hilft das nicht, öffne **Technische Details anzeigen**. |
| Die Seite bleibt lange bei „Der Drucker startet neu“ | Warte mindestens 5 Minuten. Schalte den Drucker dann einmal aus und wieder ein. |
| Das Logo erscheint nicht | Hast du den Drucker neu gestartet? Das Logo erscheint erst danach. |

### Hilfe bekommen

Kommst du nicht weiter, öffne ein [Issue auf GitHub](https://github.com/Dennis02121978/3D-Artmaker/issues). Schreibe dazu, welches Paket du installieren wolltest, und kopiere die genaue Fehlermeldung hinein.

> [!WARNING]
> Poste dabei niemals dein Passwort.

## 7. Paket wieder entfernen

[Verbinde dich mit dem Drucker](#verbindung-herstellen) und gib den passenden Befehl ein. Deine Klipper-Config bleibt dabei unverändert.

**3D-Artmaker 2in1 Hotend:**

```bash
sudo apt remove skipr-filament
```

**2in1-Config:** Die wird nicht mit einem Befehl entfernt. Lösche in der `printer.cfg` die Zeile `[include 2in1_hotend.cfg]` und klicke auf **Speichern & Neustart**. Danach fehlen die Makros und Schalter wieder, dein Drucker braucht dann eine andere Config für den Betrieb.

**3D-Artmaker Firmware Updater:**

```bash
sudo apt purge skipr-update
```

**3D-Artmaker Firmware Updater ATmega:**

```bash
sudo apt purge rf-update
```

**Mehrere Drucker (rf-multi):** Erst die weiteren Drucker entfernen, dann das Paket:

```bash
sudo rf-multi remove RF2000
sudo apt remove rf-multi
```

**3D-Artmaker BootScreen:**

```bash
sudo apt remove skipr-bootlogo
sudo reboot
```

**3D-Artmaker BootScreen Pi:**

```bash
sudo apt remove rf-bootlogo
sudo reboot
```

**System Terminal:**

```bash
sudo apt remove rf-terminal
```

ImageMagick bleibt dabei installiert. Mit `sudo apt autoremove` kannst du es ebenfalls entfernen, falls nichts anderes es braucht.

Der Eintrag im Update Manager und der Menüpunkt verschwinden damit ebenfalls. Lade Mainsail danach mit **F5** neu.

## 8. Häufige Fragen

**Kann ich etwas kaputt machen?**
Die Installation prüft vorher, ob das Paket zu deinem Drucker passt. Am riskantesten ist das eigentliche Firmware-Update, deshalb den Drucker dabei nicht ausschalten. Sichere vorher deine Config-Dateien wie in [Abschnitt 2](#2-das-brauchst-du-vorher) beschrieben.

**Ändert ein Paket meine `printer.cfg`?**
Nein. Die [2in1-Config](#2in1-config-für-klipper) aktivierst du selbst. In die `moonraker.conf` kommt aber der Eintrag für den Update Manager. Beim Entfernen des Pakets wird er wieder gelöscht.

**Muss ich danach Klipper neu starten?**
Nein. Nur beim BootScreen ist ein Neustart des Druckers nötig, damit das Logo erscheint.

**Darf ich die Pakete während eines Drucks installieren?**
Nein, warte das Ende des Drucks ab.

**Ist die Update-Seite im Internet erreichbar?**
Gib deinen Drucker **nicht** im Router für das Internet frei. Die Update-Seite hat kein eigenes Passwort. Jeder in deinem Netzwerk kann sie öffnen, genau wie Mainsail meist auch.

**Ich nutze noch das Standard-Passwort. Soll ich es ändern?**
Am besten ja. Gib nach dem Verbinden `passwd` ein und folge den Anweisungen.
