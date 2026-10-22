# Vendored libraries

Copied in (not downloaded at run time), so the app keeps working offline and never loads anything from another site. `tools/assemble.sh` puts these into the built page before the app's own code.

| File | What | Version | Licence |
|---|---|---|---|
| `qrcode-generator.js` | Makes the share QR codes | qrcode-generator 2.0.4 (npm) | MIT (header in the file) |
| `jsqr.js` | Reads QR codes from the camera or a photo on browsers with no built-in reader (iPhone, Firefox, desktop Chrome on Windows/Linux). Android Chrome and the Play app use the phone's own reader instead | jsqr 1.4.0 (npm) | Apache 2.0 (`LICENSE-jsqr.txt`) |

Both are the published `dist/` files minified with terser, otherwise unchanged. To update one:

```
npm pack qrcode-generator      # or: npm pack jsqr
tar xzf qrcode-generator-*.tgz
npx terser package/dist/qrcode.js -c -m -o qr.min.js
```

then replace the file here, keeping the licence comment at the top, and run `npm test`.
