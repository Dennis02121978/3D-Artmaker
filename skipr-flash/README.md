# skipr_flash: Firmware-Update für MKS SKIPR im Terminal

Ein Skript für das Terminal. Es macht dasselbe wie die Seite **Firmware-Update** in Mainsail (Paket `skipr-update`), nur ohne Browser.

Die Flash-Dateien kommen aus dem neuesten Release dieses Repos und werden vor der Benutzung mit `SHA256SUMS` geprüft. Früher lagen sie auf `dev-it.de`.

| Datei im Release | Quelle im Repo |
|---|---|
| `skipr_flash` | `skipr-flash/skipr_flash` |
| `flash_card`, `board_defs.py`, `mcu-build-config-skipr`, `linux_process` | `skipr-update/files/` |

## Benutzen

Auf dem SKIPR per SSH:

```bash
cd ~
wget -qO skipr_flash https://github.com/Dennis02121978/3D-Artmaker/releases/latest/download/skipr_flash
bash skipr_flash
```

Am Ende startet der Drucker neu.
