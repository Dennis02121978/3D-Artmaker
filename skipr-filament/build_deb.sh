#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/skipr-filament_${VERSION}_all.deb"

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
mkdir -p "$ROOT/usr/share/skipr-filament" "$ROOT/usr/lib/skipr-filament" "$ROOT/DEBIAN" dist

../shared/make_web_files.sh skipr-filament "$VERSION" "$ROOT/usr/share/skipr-filament" index.html
install -m 755 setup_host.py "$ROOT/usr/lib/skipr-filament/"
install -m 644 ../shared/artmaker_updates.py "$ROOT/usr/lib/skipr-filament/"
install -m 755 packaging/preinst packaging/postinst packaging/prerm packaging/postrm "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null
echo "Erstellt: $OUT und dist/skipr-filament.zip"
