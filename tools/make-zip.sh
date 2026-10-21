#!/bin/sh
# Packs the whole project into ONE zip (replacing any earlier one) so it can be downloaded or shared.
# Leaves out git history, test downloads, build output and signing keys.
#   sh tools/make-zip.sh [output-folder]      (default: the folder above the project)
set -e
cd "$(dirname "$0")/.."
out="${1:-..}"
name="sushi-train-track.zip"
rm -f "$out/$name" "$out"/sushi-train-track-*.zip
zip -rq "$out/$name" . -x '.git/*' 'node_modules/*' 'dist/*' '*.keystore' '*.jks' '.DS_Store' '*/.DS_Store'
echo "Wrote $out/$name ($(du -h "$out/$name" | cut -f1))"
