#!/bin/bash
# Legt die von Moonraker verwalteten Dateien im Paket ab und packt dieselben Dateien fuer das Release.
# Aufruf aus dem Paketordner: ../shared/make_web_files.sh NAME VERSION ZIELORDNER DATEI...
set -euo pipefail
NAME=$1; VERSION=$2; TARGET=$3; shift 3

mkdir -p "$TARGET" dist
install -m 644 "$@" "$TARGET/"
printf '{"project_name":"3D-Artmaker","project_owner":"Dennis02121978","version":"v%s","asset_name":"%s.zip"}\n' \
    "$VERSION" "$NAME" > "$TARGET/release_info.json"
chmod 644 "$TARGET/release_info.json"

ZIP="$PWD/dist/$NAME.zip"
rm -f "$ZIP"
(cd "$TARGET" && python3 -m zipfile -c "$ZIP" ./*)
