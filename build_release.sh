#!/bin/bash
# Baut alle Release-Dateien nach dist/: ./build_release.sh 1.1.0
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:?Version fehlt, zum Beispiel: ./build_release.sh 1.1.0}

rm -rf dist skipr-filament/dist skipr-update/dist
mkdir dist
skipr-filament/build_deb.sh "$VERSION"
skipr-update/build_deb.sh "$VERSION"
mv skipr-filament/dist/* skipr-update/dist/* dist/
rmdir skipr-filament/dist skipr-update/dist
(cd dist && sha256sum -- * > SHA256SUMS)
ls -l dist
