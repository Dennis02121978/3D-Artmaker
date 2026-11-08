#!/bin/bash
# Baut das Paket auf einem Linux-System mit dpkg-deb: ./build_deb.sh [Version]
set -euo pipefail
umask 022
cd "$(dirname "$0")"
VERSION=${1:-1.0.0}
OUT="dist/rf-multi_${VERSION}_all.deb"

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"  # mktemp legt 700 an, das wuerde als Rechte fuer / im Paket landen
mkdir -p "$ROOT/usr/lib/rf-multi" "$ROOT/usr/sbin" "$ROOT/usr/share/rf-multi/configs" "$ROOT/DEBIAN" dist

install -m 755 rf_multi.py "$ROOT/usr/lib/rf-multi/"
ln -s ../lib/rf-multi/rf_multi.py "$ROOT/usr/sbin/rf-multi"
# Config-Vorlagen aus dem Repo (ohne Kamera-Config)
for d in ../config/*/; do
    name=$(basename "$d")
    mkdir -p "$ROOT/usr/share/rf-multi/configs/$name"
    find "$d" -maxdepth 1 -type f \( -name '*.cfg' -o -name '*.md' \) -exec install -m 644 {} "$ROOT/usr/share/rf-multi/configs/$name/" \;
done
install -m 755 packaging/postinst "$ROOT/DEBIAN/"
sed "s/@VERSION@/$VERSION/" packaging/control > "$ROOT/DEBIAN/control"

dpkg-deb --root-owner-group --build "$ROOT" "$OUT" >/dev/null
echo "Erstellt: $OUT"
