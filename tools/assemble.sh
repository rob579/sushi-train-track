#!/bin/sh
# Joins the source pieces in src/ into one index.html (printed to the file given as $1).
# The deployed app is ONE file on purpose: the service worker caches the page as a unit, so the
# page and its code can never be out of step during an update.
set -e
cd "$(dirname "$0")/.."
out="${1:?usage: tools/assemble.sh <output-file>}"
{
  cat src/head.html src/styles.css src/body.html
  cat src/js/*.js
  cat src/tail.html
} > "$out"
