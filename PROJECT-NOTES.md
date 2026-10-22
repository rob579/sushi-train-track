# Sushi Train Track: project notes

A mobile-first web app for totalling spend at a conveyor-belt sushi restaurant. Tap coloured plates, see the running total, add drinks and extras, keep several restaurants. Delivered as a website/PWA (`sushi.robsofficetips.com`) and as an Android app on Google Play (a thin wrapper around the same site). Everything is free: no ads, no purchases, no accounts, nothing leaves the phone.

The words we use for parts of the screen are in [`docs/GLOSSARY.md`](docs/GLOSSARY.md).

## How we work (the convention)

Every change goes into the **`testing`** branch first. Nothing reaches **`main`** (the live site and the Play app) until you say to release it.

**Making a change.** Every request is tagged one of two ways. If it is not stated, I ask.

| | **Incremental update** | **Release update** |
|---|---|---|
| What it is | Small change, tweak or fix | A change that is going out in the next release |
| Where it goes | Committed and pushed to `testing` | Committed and pushed to `testing` |
| Testing | That enhancement alone: the suite that covers it (`npm test drawer`) | Full regression on everything in `testing`: `npm test` (includes the real-browser checks) |

**Getting it live.** These are separate steps, and you say when each one happens.

| You say | I do |
|---|---|
| **Prepare for release** | Full regression on everything in `testing`, and a report of anything that changed or broke compared with the last checks. Nothing goes to `main` |
| **Release it** (or **package and release**) | Release paperwork: version label bumped; screenshots, listing text and privacy policy updated if they are affected; new zip (`sh tools/make-zip.sh`); a note on whether an Android re-upload is needed. Then `testing` is merged into `main` and pushed. This is the step that goes live |

You may test `testing` yourself between these steps, or not. Either way I wait for "release it".

### Branches

- **`main`** is what is live. Cloudflare builds it to sushi.robsofficetips.com, and the Play app shows it. Only "release it" changes `main`.
- **`testing`** collects every enhancement until release. If Cloudflare preview builds are on, it also gets its own preview address to try changes on a phone first.
- On the Mac: `git checkout testing && git pull` for the latest test version, `git checkout main` for what is live.

An Android re-upload is only needed when `android/twa-manifest.json` changes. Changes to the website code reach the Play app by themselves once they are released to `main`.

## Where things live

| Path | What |
|---|---|
| `src/head.html`, `src/body.html`, `src/tail.html` | The page skeleton |
| `src/styles.css` | All the styling |
| `src/js/01 … 13-*.js` | The app's code in topic order, joined by file name: config + state, currency, (03 is gone: it was editions and purchases), keep screen on, dialogs + colour chooser, plate actions, views, render + drawer, editing, events, suggestions, app update, share by QR code |
| `src/vendor/` | Third-party code copied in so it works offline: the QR code maker and the QR reader used where the phone has none. Versions, licences and how to update are in its README |
| `sw.js` | Service worker (offline use, update banner). Stamped with the version at build time |
| `.well-known/assetlinks.json` | Links the website to the Android app. **Contains the real signing fingerprints. Never overwrite it with a placeholder.** Must stay at the top level |
| `privacy.html` | The privacy policy page (your real one) |
| `build.sh` | Builds `dist/` (joins `src/` into one `index.html`, stamps the version). Cloudflare runs it on every push |
| `tools/assemble.sh` | The joining step on its own |
| `tools/make-zip.sh` | Makes the one current zip |
| `tests/` | `run.js` (the runner), `suites/` (the checks), `lib/` (helpers) |
| `android/twa-manifest.json` | Android wrapper settings (Bubblewrap) |
| `store/` | Play listing text, icon, feature graphic, screenshots |
| `docs/` | Launch guide, glossary |
| `update.sh` | Old home-server deploy. Delete when the old server is gone |

Why the app is **one** deployed `index.html` even though the source is many files: the service worker caches the page as a unit. If the code were separate files, a phone could briefly hold a new page with old code. The pieces are joined at build time, so the deployed result is exactly one file.

## Running the checks

```
npm test                 # everything (about 20 seconds)
npm run test:quick       # skips the real-browser suite
npm test drawer          # just the suites whose name contains "drawer"
```

The first run installs a small test library into `~/.cache/sushi-test-deps` (outside the project) if it is missing. The browser suite uses Chrome or Chromium if it can find one (set `CHROME_PATH` to point at it), and says so if it cannot.

| Suite | Covers |
|---|---|
| currency | typing amounts in any style, symbols, decimals |
| flows | first-run setup, tapping plates, totals, itemised bill, saving, editing, validation |
| free-for-all | website and Play app both have everything; old purchase records tidied away |
| drawer | the drawer: handle title, add, group, + and −, messages |
| remove | remove mode, long-press confirm, add a plate |
| keep-awake | the "Keep screen on" switch: saved, lock taken and given back as the app is shown and hidden, refused, unsupported browsers |
| setup-and-suggestions | suggestions from other restaurants, price tidying, Enter/Next, colour chooser |
| browser | service worker, offline, Cloudflare-style redirects, assetlinks, phone layout |
| share | the share card, what goes in a code (never the bill), split codes, scanning, replace / merge / keep both / skip, bad codes, camera refused |
| share-browser | in real Chrome: the code on screen reads back; a fake camera playing the codes is scanned; clash through a real scan; scanning a photo; fits a small phone |

## Decisions already made

- Everything is free for everyone (decided 21 Oct 2026). The Free/Premium split, the Play Billing purchase and the acknowledge function were removed in this release. The old Play product ID was `premium_unlock` (deactivated, not reusable).
- Things that were locked under Free were never deleted, so extra restaurants, plates and menu items from that time simply become usable again.
- Prices are stored in hundredths of the main unit (yen 450 is stored as 45000).
- Package `com.robsofficetips.sushitraintrack`.
- Sharing is by QR code only, phone to phone, nothing over the internet (22 Oct 2026). Only the setup is shared (name, currency, plates, menu items), never bills. Code format `STT1:<set>:<part>/<parts>:<json chunk>`, described at the top of `src/js/13-share.js`. NFC was looked at and not used: Web NFC cannot do phone to phone and does not exist on iPhone.
- UI text is English only for now (translation was offered, not requested).
- The git repo is public (github.com/rob579/sushi-train-track). There are no secrets in it (the Android signing key is never committed).

## Habits that save time

- Say whether a request is incremental or release, and say "release it" when `testing` should go live.
- Say "I haven't touched anything", or attach the files you changed, before I overwrite anything of yours.
- One request per message where possible, with a screenshot and the glossary word for the part you mean.
