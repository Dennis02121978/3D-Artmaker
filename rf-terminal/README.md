# rf-terminal: System-Terminal in Mainsail

Fügt Mainsail links den Menüpunkt **System Terminal** hinzu. Die Seite zeigt links das 3D-Artmaker-Logo mit kurzer Anleitung und den Knöpfen „Zurück zu Mainsail“ und „Forum“, rechts in einem Rahmen das Terminal, in dem du alles machen kannst wie per SSH. „Neu verbinden“ startet eine neue Sitzung.

## Sicherheit

- Jede Sitzung beginnt mit der normalen Linux-Anmeldung: Benutzername und Passwort, wie bei SSH. Ein falsches Passwort wird abgewiesen.
- Das Terminal (ttyd) lauscht nur auf `127.0.0.1:7683` und ist nur über nginx unter `/terminal/` erreichbar.
- Verbindungen von fremden Webseiten lehnt ttyd ab (`--check-origin`). Höchstens 4 Sitzungen gleichzeitig.
- Wer das Passwort kennt, hat vollen Zugriff, genau wie per SSH. Ändere deshalb das Standard-Passwort (`passwd`) und gib den Drucker **nicht** im Router für das Internet frei.

## Technik

- ttyd 1.7.7 von [tsl0922/ttyd](https://github.com/tsl0922/ttyd/releases/tag/1.7.7) (MIT-Lizenz), statisch gebaut für arm64, armhf und amd64. Debian 13 hat kein ttyd-Paket mehr. Die Prüfsummen stehen in `files/SHA256SUMS`, `build_deb.sh` prüft sie.
- Dienst `rf-terminal.service` (root), Befehl `script -qfc /bin/login /dev/null`. `script` gibt `login` ein eigenes Terminal. Direkt unter ttyd trennt `login` sein Terminal beim Start (vhangup), danach käme keine Ausgabe mehr im Browser an.
- Seite `/terminal/` (`/usr/share/rf-terminal/index.html` mit `logo.png` aus `skipr-bootlogo`), darin als iframe das Terminal unter `/terminal/tty/`.
- nginx: Block `# BEGIN rf-terminal … # END rf-terminal` in jeder Mainsail-Seite (`mainsail` und `mainsail-NAME` von rf-multi).
- Mainsail: Eintrag in `.theme/navi.json` jedes Druckers (`~/printer_data`, `~/printer_NAME_data`).
- Kein Eintrag im Update-Manager. Neue Versionen kommen per `.deb`.

Einen Drucker, den du **nach** rf-terminal mit `sudo rf-multi` einrichtest, bekommt Menüpunkt und nginx-Eintrag automatisch mit, weil rf-multi beides vom ersten Drucker übernimmt.

## Entfernen

```bash
sudo apt remove rf-terminal
```
