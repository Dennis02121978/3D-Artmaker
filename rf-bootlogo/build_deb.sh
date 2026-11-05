#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
# Das Logo kommt aus skipr-bootlogo, damit es nur einmal im Repo liegt.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/rf-bootlogo_${VERSION}_all.deb"
LOGO=../skipr-bootlogo

[ "$(stat -c %s "$LOGO/logo.rgb565")" = "307200" ] || { echo "logo.rgb565 muss 480x320 RGB565 sein"; exit 1; }

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
LIB="$ROOT/usr/lib/rf-bootlogo"
UNITS="$ROOT/lib/systemd/system"
mkdir -p "$LIB" "$UNITS/KlipperScreen.service.d" "$ROOT/lib/udev/rules.d" "$ROOT/DEBIAN" dist

install -m 755 ks-client ks-start show-logo setup_host.py "$LIB/"
install -m 644 ../shared/artmaker_updates.py "$LIB/"
../shared/make_web_files.sh rf-bootlogo "$VERSION" "$ROOT/usr/share/rf-bootlogo" "$LOGO/logo.png" "$LOGO/logo.rgb565"
install -m 644 packaging/rf-boot-logo@.service "$UNITS/"
install -m 644 packaging/rf-bootlogo.conf "$UNITS/KlipperScreen.service.d/"
install -m 644 packaging/70-rf-boot-logo.rules "$ROOT/lib/udev/rules.d/"
install -m 755 packaging/preinst packaging/postinst packaging/prerm packaging/postrm "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null
echo "Erstellt: $OUT"
