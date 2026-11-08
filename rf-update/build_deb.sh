#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/rf-update_${VERSION}_all.deb"

(cd files && sha256sum -c --quiet SHA256SUMS)

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
LIB="$ROOT/usr/lib/rf-update"
UNITS="$ROOT/lib/systemd/system"
mkdir -p "$LIB/files" "$UNITS" "$ROOT/DEBIAN" dist

install -m 755 runner.py web.py setup_host.py "$LIB/"
install -m 644 common.py ../shared/artmaker_updates.py "$LIB/"
../shared/make_web_files.sh rf-update "$VERSION" "$ROOT/usr/share/rf-update" index.html
install -m 644 files/* "$LIB/files/"
install -m 644 packaging/rf-update.service packaging/rf-update-web.service "$UNITS/"
install -D -m 644 packaging/99-rf-ftdi-latency.rules "$ROOT/lib/udev/rules.d/99-rf-ftdi-latency.rules"
install -m 755 packaging/preinst packaging/postinst packaging/prerm packaging/postrm "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null
echo "Erstellt: $OUT"
