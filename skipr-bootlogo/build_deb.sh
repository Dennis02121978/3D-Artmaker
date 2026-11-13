#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/skipr-bootlogo_${VERSION}_all.deb"

[ "$(stat -c %s logo.rgb565)" = "307200" ] || { echo "logo.rgb565 muss 480x320 RGB565 sein"; exit 1; }

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
LIB="$ROOT/usr/lib/skipr-bootlogo"
UNITS="$ROOT/lib/systemd/system"
mkdir -p "$LIB" "$UNITS/KlipperScreen.service.d" "$ROOT/lib/udev/rules.d" "$ROOT/DEBIAN" dist

install -m 755 ks-client ks-start show-logo setup_host.py "$LIB/"
install -m 644 ../shared/artmaker_updates.py "$LIB/"
install -m 755 ../shared/logo_anim.py "$LIB/"
../shared/make_web_files.sh skipr-bootlogo "$VERSION" "$ROOT/usr/share/skipr-bootlogo" logo.png logo.rgb565
# Animation aus dem Logo berechnen (braucht python3-pil und python3-numpy auf dem Build-System)
python3 ../shared/logo_anim.py build logo.png "$ROOT/usr/share/skipr-bootlogo/anim.bin"
install -m 644 packaging/boot-logo.service "$UNITS/"
install -m 644 packaging/skipr-bootlogo.conf "$UNITS/KlipperScreen.service.d/"
install -m 644 packaging/70-boot-logo.rules "$ROOT/lib/udev/rules.d/"
install -m 755 packaging/preinst packaging/postinst packaging/prerm packaging/postrm "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null
echo "Erstellt: $OUT"
