#!/bin/bash
# Baut alle Release-Dateien nach dist/: ./build_release.sh 1.1.0
set -euo pipefail
cd "$(dirname "$0")"
VERSION=${1:?Version fehlt, zum Beispiel: ./build_release.sh 1.1.0}

PACKAGES="skipr-filament skipr-update skipr-bootlogo rf-update rf-bootlogo rf-multi rf-terminal"
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
# Installer mit eingetragener Version (3DArtmaker-upgrade vergleicht damit)
sed "s/^VERSION=\"dev\"/VERSION=\"$VERSION\"/" installer/3dartmaker.sh > dist/3dartmaker-install.sh
# Config-Generator des Config Creators hinten anhaengen (nach "exit", wird vom Installer ausgelesen)
[ -f installer/rf_generator.js ] || { echo "installer/rf_generator.js fehlt (RenkforceConfigCreator/sync_files.py)"; exit 1; }
{ echo; echo '# __RF_GENERATOR__'; echo ": <<'__RF_GENERATOR_END__'"; cat installer/rf_generator.js; echo '__RF_GENERATOR_END__'; } >> dist/3dartmaker-install.sh
bash -n dist/3dartmaker-install.sh
chmod 755 dist/3dartmaker-install.sh
grep -q "^VERSION=\"$VERSION\"" dist/3dartmaker-install.sh
(cd dist && sha256sum -- * > SHA256SUMS)
ls -l dist
