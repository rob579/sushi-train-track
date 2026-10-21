#!/bin/sh
# Builds the website into ./dist.  Used by Cloudflare Pages (build command: sh build.sh) and by update.sh on the home server.
# The short git commit is stamped into index.html and sw.js, so phones can tell when a newer version is out.
set -e
cd "$(dirname "$0")"

VERSION="${CF_PAGES_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo dev)}"
VERSION=$(printf '%s' "$VERSION" | cut -c1-7)

rm -rf dist
mkdir -p dist/.well-known dist/fonts
cp manifest.webmanifest icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png privacy.html _headers dist/
cp fonts/*.woff2 fonts/OFL.txt dist/fonts/
cp .well-known/assetlinks.json dist/.well-known/
# the same file at a plain address too, plus a rewrite, in case a host does not serve hidden folders
cp .well-known/assetlinks.json dist/assetlinks.json
printf '/.well-known/assetlinks.json /assetlinks.json 200\n' > dist/_redirects
# the page is kept as small source pieces in src/ and joined into the single index.html that gets deployed
sh tools/assemble.sh dist/index.assembled.html
sed "s/const BUILD_ID = '[^']*'/const BUILD_ID = '$VERSION'/" dist/index.assembled.html > dist/index.html
rm dist/index.assembled.html
sed "s/const VERSION = '[^']*'/const VERSION = '$VERSION'/" sw.js > dist/sw.js

echo "Built version $VERSION into dist/"
grep -q "YOUR_EMAIL_HERE" privacy.html && echo "WARNING: privacy.html still has YOUR_EMAIL_HERE. Put your contact email in before publishing to Google Play."
grep -q "REPLACE_WITH" .well-known/assetlinks.json && echo "NOTE: .well-known/assetlinks.json still has placeholder fingerprints (fill them in after the first Play upload)."
exit 0
