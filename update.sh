#!/bin/sh
# Home-server deploy (only needed until the site moves to Cloudflare Pages).
# Pulls the latest code from GitHub, builds it, and copies the result into the folder nginx serves.
set -e
cd "$(dirname "$0")"
git -C repo pull
sh repo/build.sh
cp -r repo/dist/. html/
echo "Deployed: $(grep -o "BUILD = '[^']*'" html/index.html)"
