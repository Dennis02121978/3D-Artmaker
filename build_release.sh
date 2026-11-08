#!/bin/bash
# Baut alle Release-Dateien nach dist/: ./build_release.sh 1.1.0
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:?Version fehlt, zum Beispiel: ./build_release.sh 1.1.0}

PACKAGES="skipr-filament skipr-update skipr-bootlogo rf-update rf-bootlogo rf-multi"
rm -rf dist
mkdir dist
for p in $PACKAGES; do
    rm -rf "$p/dist"
    "$p/build_deb.sh" "$VERSION"
    mv "$p"/dist/* dist/
    rmdir "$p/dist"
done
(cd config && python3 -m zipfile -c ../dist/RF2000v2_DualExtruder.zip RF2000v2_DualExtruder)
(cd config && python3 -m zipfile -c ../dist/RF2000_DualExtruder_3mm.zip RF2000_DualExtruder_3mm)
(cd dist && sha256sum -- * > SHA256SUMS)
ls -l dist
