# Sushi Train Track: project notes

A mobile-first web app for totalling spend at a conveyor-belt sushi restaurant. Tap coloured plates, see the running total, add drinks and extras, keep several restaurants. Delivered as a website/PWA (`sushi.robsofficetips.com`) and as an Android app on Google Play (a thin wrapper around the same site). Everything is free: no ads, no purchases, no accounts, nothing leaves the phone.

The words we use for parts of the screen are in [`docs/GLOSSARY.md`](docs/GLOSSARY.md).

## How we work (the convention)

Every request for a change is tagged one of two ways. If it is not stated, I ask.

| | **Incremental update** | **Release update** |
|---|---|---|
| What it is | Small change, tweak or fix | A version you will publish or send to testers |
| Testing | The suite that covers the change (`npm test drawer`), plus `npm run test:quick` | Everything: `npm test` (includes the real-browser checks) |
| Also | Commit | Version label bumped, screenshots / listing text / privacy policy updated if they are affected, new zip (`sh tools/make-zip.sh`), and a note on whether an Android re-upload is needed |

An Android re-upload is only needed when `android/twa-manifest.json` changes. Changes to the website code reach the Play app by themselves after you push.

## Where things live

| Path | What |
|---|---|
| `src/head.html`, `src/body.html`, `src/tail.html` | The page skeleton |
| `src/styles.css` | All the styling |
| `src/js/01 … 12-*.js` | The app's code in topic order, joined by file name: config + state, currency, (03 and 04 are gone: they were editions and purchases), dialogs + colour chooser, plate actions, views, render + drawer, editing, events, suggestions, app update |
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
| setup-and-suggestions | suggestions from other restaurants, price tidying, Enter/Next, colour chooser |
| browser | service worker, offline, Cloudflare-style redirects, assetlinks, phone layout |

## Decisions already made

- Everything is free for everyone (decided 21 Oct 2026). The Free/Premium split, the Play Billing purchase and the acknowledge function were removed in this release. The old Play product ID was `premium_unlock` (deactivated, not reusable).
- Things that were locked under Free were never deleted, so extra restaurants, plates and menu items from that time simply become usable again.
- Prices are stored in hundredths of the main unit (yen 450 is stored as 45000).
- Package `com.robsofficetips.sushitraintrack`.
- UI text is English only for now (translation was offered, not requested).
- The git repo is public (github.com/rob579/sushi-train-track). There are no secrets in it (the Android signing key is never committed).

## Habits that save time

- Say whether a request is incremental or release.
- Say "I haven't touched anything", or attach the files you changed, before I overwrite anything of yours.
- One request per message where possible, with a screenshot and the glossary word for the part you mean.
