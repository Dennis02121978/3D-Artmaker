#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/skipr-filament_${VERSION}_all.deb"
ZIP="dist/skipr-filament.zip"

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
mkdir -p "$ROOT/usr/share/skipr-filament" "$ROOT/usr/lib/skipr-filament" "$ROOT/DEBIAN" dist

install -m 644 index.html "$ROOT/usr/share/skipr-filament/"
printf '{"project_name":"3D-Artmaker","project_owner":"Dennis02121978","version":"v%s","asset_name":"skipr-filament.zip"}\n' \
    "$VERSION" > "$ROOT/usr/share/skipr-filament/release_info.json"
chmod 644 "$ROOT/usr/share/skipr-filament/release_info.json"
install -m 755 setup_host.py "$ROOT/usr/lib/skipr-filament/"
install -m 755 packaging/preinst packaging/postinst packaging/prerm packaging/postrm "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null

# Dieselben Dateien fuer den Update-Manager von Moonraker
rm -f "$ZIP"
ABS_ZIP="$PWD/$ZIP"
(cd "$ROOT/usr/share/skipr-filament" && python3 -m zipfile -c "$ABS_ZIP" index.html release_info.json)
echo "Erstellt: $OUT und $ZIP"
