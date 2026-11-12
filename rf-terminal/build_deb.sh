#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
set -euo pipefail
umask 022
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/rf-terminal_${VERSION}_all.deb"

# ttyd 1.7.7 von https://github.com/tsl0922/ttyd/releases (statisch gebaut, MIT-Lizenz)
(cd files && sha256sum -c --quiet SHA256SUMS)

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
LIB="$ROOT/usr/lib/rf-terminal"
mkdir -p "$LIB/bin" "$ROOT/lib/systemd/system" "$ROOT/DEBIAN" dist

install -m 755 setup_host.py "$LIB/"
install -m 755 files/ttyd.aarch64 files/ttyd.armhf files/ttyd.x86_64 "$LIB/bin/"
# Seite mit Logo (dasselbe Logo wie beim BootScreen)
install -D -m 644 index.html "$ROOT/usr/share/rf-terminal/index.html"
install -m 644 ../skipr-bootlogo/logo.png "$ROOT/usr/share/rf-terminal/logo.png"
install -m 644 packaging/rf-terminal.service "$ROOT/lib/systemd/system/"
install -m 755 packaging/preinst packaging/postinst packaging/prerm packaging/postrm "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null
echo "Erstellt: $OUT"
