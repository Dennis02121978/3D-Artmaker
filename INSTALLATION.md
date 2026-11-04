# Installationsanleitung für Einsteiger

Diese Anleitung führt dich Schritt für Schritt durch die Installation. Du brauchst keine Linux-Kenntnisse. Alle Befehle kannst du einfach kopieren und einfügen.

**Das dauert etwa 10 Minuten pro Paket.** Beim Firmware Updater kann es etwas länger dauern, weil dein Drucker dafür zusätzliche Programme herunterlädt.

## Inhalt

1. [Welches Paket brauche ich?](#1-welches-paket-brauche-ich)
2. [Das brauchst du vorher](#2-das-brauchst-du-vorher)
3. [Mit dem Drucker verbinden](#3-mit-dem-drucker-verbinden)
4. [Paket installieren](#4-paket-installieren)
   - [3D-Artmaker 2in1 Hotend](#3d-artmaker-2in1-hotend)
   - [3D-Artmaker Firmware Updater](#3d-artmaker-firmware-updater)
   - [3D-Artmaker BootScreen](#3d-artmaker-bootscreen)
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
| **3D-Artmaker BootScreen** | Zeigt beim Einschalten das 3D-Artmaker-Logo auf dem Display. | du Armbian, KlipperScreen und ein 480x320-Display mit dem Treiber `fb_st7796` hast. |

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

### 3D-Artmaker 2in1 Hotend

**Prüfe zuerst deine Klipper-Config.** Die Seite ändert sie nicht, deshalb müssen diese Einträge schon vorhanden sein:

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
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.2.0/skipr-filament_1.2.0_all.deb
```

**2. Datei prüfen:**

```bash
echo "56b73c7d08ae43c7760e4ae5f17d3d46ccec3304cbc18fbae22076686e46fc1b  skipr-filament_1.2.0_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./skipr-filament_1.2.0_all.deb
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
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.2.0/skipr-update_1.2.0_all.deb
```

**2. Datei prüfen:**

```bash
echo "dfa65d45aaba5d7d6ec65d1a6585b9d4fe228c2b97e9cf5de5c5b66c9ee2d56b  skipr-update_1.2.0_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./skipr-update_1.2.0_all.deb
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

### 3D-Artmaker BootScreen

**1. Paket herunterladen:**

```bash
cd ~
wget https://github.com/Dennis02121978/3D-Artmaker/releases/download/v1.2.0/skipr-bootlogo_1.2.0_all.deb
```

**2. Datei prüfen:**

```bash
echo "2d3e095cad568d2296191e068de6eb4d5744308eeb5855e61ffff4eef1e441ff  skipr-bootlogo_1.2.0_all.deb" | sha256sum -c
```

Am Ende der Ausgabe muss `OK` stehen. Steht dort etwas anderes, installiere nicht weiter.

**3. Installieren:**

```bash
sudo apt update
sudo apt install ./skipr-bootlogo_1.2.0_all.deb
```

Wird nach einem Passwort gefragt, gib es noch einmal ein. Kommt eine Frage mit `J/n` oder `Y/n`, drücke `J` oder `Y` und dann Enter.

**Geklappt?** Am Ende steht `Logo ist installiert`. Mainsail verliert dabei kurz die Verbindung, das ist normal.

**4. Drucker neu starten:**

```bash
sudo reboot
```

Das Logo erscheint jetzt beim Start, bis KlipperScreen geladen ist. Die Verbindung im Terminal bricht dabei ab, das Fenster kannst du schließen.

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
| **3D-Artmaker BootScreen** | Nur das Logo, es erscheint beim nächsten Start | Bei Änderungen an den Start-Einstellungen die neue `.deb` installieren |

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
| `KlipperScreen wurde nicht gefunden` | Installiere zuerst KlipperScreen. |
| `Das Logo passt nur auf ein 480x320-Display` | Dein Display hat eine andere Auflösung. |

> [!TIP]
> Bricht die Installation mit einer dieser Prüfungen ab, wurde an deinem Drucker noch nichts geändert.

Taucht während der Installation eine Zeile auf, die mit `N:` beginnt und `unsandboxed` enthält, kannst du sie ignorieren. Das ist nur ein Hinweis und kein Fehler.

### Nach der Installation

| Problem | Was du tun kannst |
|---|---|
| Der Menüpunkt fehlt | Lade Mainsail mit **F5** neu. |
| Die Filament-Anzeige bleibt leer, oder ein Knopf meldet einen Fehler | In deiner Klipper-Config fehlt einer der [nötigen Einträge](#3d-artmaker-2in1-hotend). |
| `Dieses Update ist nur für das MKS-SKIPR-Board` | Das Paket passt nicht zu deinem Board. Bitte nicht weiter versuchen. |
| `Gerade läuft ein Druck` | Warte, bis der Druck fertig ist. |
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

**3D-Artmaker Firmware Updater:**

```bash
sudo apt purge skipr-update
```

**3D-Artmaker BootScreen:**

```bash
sudo apt remove skipr-bootlogo
sudo reboot
```

Der Eintrag im Update Manager und der Menüpunkt verschwinden damit ebenfalls. Lade Mainsail danach mit **F5** neu.

## 8. Häufige Fragen

**Kann ich etwas kaputt machen?**
Die Installation prüft vorher, ob das Paket zu deinem Drucker passt. Am riskantesten ist das eigentliche Firmware-Update, deshalb den Drucker dabei nicht ausschalten. Sichere vorher deine Config-Dateien wie in [Abschnitt 2](#2-das-brauchst-du-vorher) beschrieben.

**Ändert ein Paket meine `printer.cfg`?**
Nein. In die `moonraker.conf` kommt aber der Eintrag für den Update Manager. Beim Entfernen des Pakets wird er wieder gelöscht.

**Muss ich danach Klipper neu starten?**
Nein. Nur beim BootScreen ist ein Neustart des Druckers nötig, damit das Logo erscheint.

**Darf ich die Pakete während eines Drucks installieren?**
Nein, warte das Ende des Drucks ab.

**Ist die Update-Seite im Internet erreichbar?**
Gib deinen Drucker **nicht** im Router für das Internet frei. Die Update-Seite hat kein eigenes Passwort. Jeder in deinem Netzwerk kann sie öffnen, genau wie Mainsail meist auch.

**Ich nutze noch das Standard-Passwort. Soll ich es ändern?**
Am besten ja. Gib nach dem Verbinden `passwd` ein und folge den Anweisungen.
