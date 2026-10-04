# Sushi Train Track: launch guide

This guide takes you from the files in this folder to a live website on Cloudflare and an app in Google Play. Do the parts in order. Each step says exactly what to type or click, and where I could not check something myself I say so.

**The order matters.** The Android app is built from your live website (it downloads the icons and manifest from it), so the website has to be on its final address first.

| Part | What | Roughly |
|---|---|---|
| 0 | Three small things to decide or fill in | 10 min |
| A | Put the files in GitHub | 10 min |
| B | Cloudflare Pages builds and hosts the site | 20 min |
| C | Point `sushi.robsofficetips.com` at Cloudflare (Enom) | 15 min, plus waiting |
| D | Build the Android app file | 45 min the first time |
| E | Google Play Console: upload, test, publish | an evening, then 14 days of testing |

---

## What is in this folder

| File or folder | What it is |
|---|---|
| `index.html`, `sw.js`, `manifest.webmanifest`, `fonts/`, icons | The app itself |
| `privacy.html` | Your privacy policy page (Play requires one) |
| `build.sh` | Builds the site into `dist/`; Cloudflare runs it on every push |
| `_headers`, `.well-known/assetlinks.json` | Cloudflare settings, and the file that links the website to the Android app |
| `android/twa-manifest.json` | Settings for the Android app (Part D) |
| `store/` | Play Store icon, feature graphic, six screenshots, and `listing.md` with all the text to paste |
| `update.sh` | Only for the old home-server deploy. You can ignore it once Cloudflare is live. |
| `.gitignore` | Keeps the build output and signing keys out of GitHub |

Hidden files (the ones starting with a dot) matter. On a Mac press Cmd+Shift+. in Finder to see them; VS Code shows them already.

---

## Part 0: decide and fill in

1. **Your contact email.** Open `privacy.html` and replace both copies of `YOUR_EMAIL_HERE` with an email address you are happy to publish.
2. **The package name.** I used `com.robsofficetips.sushitraintrack`. It is the app's permanent identity on Google Play and **cannot be changed after the first upload**. If you want something else, change `packageId` in `android/twa-manifest.json` now (and use the same name everywhere below).
3. **The price** of Premium, for example A$4.99. You choose it in Part E. Google keeps a share of every sale, so check the current "Service fees" page in Play Console before you decide.

---

## Part A: GitHub

1. Copy everything from this folder into your VS Code workspace folder (the one linked to your GitHub repository). Replace the old `index.html`. Make sure the hidden files (`.gitignore`, `.well-known/`) come across.
2. In VS Code open Source Control, stage all changes, write a message such as `Free/premium editions, Cloudflare build, Play launch files`, commit, then **Sync Changes**.
3. Check on github.com that you can see `build.sh`, `_headers`, `.well-known/assetlinks.json` and `store/`.

A private repository is fine. Cloudflare can read it through its GitHub connection.

---

## Part B: Cloudflare Pages

1. Go to https://dash.cloudflare.com and create a free account (no card needed).
2. Choose **Workers & Pages**, then **Create application**, then the **Pages** option, then **Connect to Git**. Cloudflare has been merging Pages into Workers, so the buttons may be worded a little differently. Look for the Pages and Connect to Git option.
3. Authorise Cloudflare to use GitHub and pick your repository.
4. Fill in the build settings **exactly**:

   | Setting | Value |
   |---|---|
   | Project name | `sushi-train-track` (it becomes `<name>.pages.dev`; if the name is taken, note whatever you end up with) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `sh build.sh` |
   | Build output directory | `dist` |
   | Root directory | leave empty |
   | Environment variables | none |

5. Click **Save and Deploy**. The first build takes about a minute.
6. Open `https://<name>.pages.dev` and check:
   - the app loads (the small grey line at the bottom of the first screen shows `Build ... · a1b2c3d · Website`);
   - `https://<name>.pages.dev/privacy` shows your policy (Cloudflare drops the `.html`, so `/privacy.html` just redirects there);
   - `https://<name>.pages.dev/.well-known/assetlinks.json` shows some JSON. I could not test whether Cloudflare serves hidden folders, so there is a backup: if that address gives an error, try `https://<name>.pages.dev/assetlinks.json`. The build adds a rewrite so both should work.
   - `https://<name>.pages.dev/?edition=free` shows the free version (the line at the bottom says `Free (preview)`). `?edition=premium` and `?edition=reset` do what you would expect. These links are the easy way to try both versions in a browser.

From now on, every push to `main` redeploys the site automatically, in about a minute.

---

## Part C: move `sushi.robsofficetips.com` to Cloudflare (Enom)

Nothing changes for your friends: same address, and the data they have saved stays on their phones.

**Before you change DNS, update the old home server once.** Phones that visited the site recently have an older helper script (the service worker) that cannot cope with Cloudflare's address handling, and they would see a "This site can't be reached" error on their first visit after the move. Giving them the fixed version first avoids that. On the Linux server:
```
cd ~/docker/sushi-tracker
git -C repo pull
cp repo/update.sh .
./update.sh
```
Then ask your friends to open the app once while online (they do not need to do anything else). Anyone who skips this just sees the error once; reloading fixes it.

1. In your Cloudflare Pages project open **Custom domains**, choose **Set up a custom domain**, and enter `sushi.robsofficetips.com`.
2. Because your DNS is at Enom, Cloudflare will show a CNAME target, which is `<name>.pages.dev`.
3. In Enom, open the Host Records for `robsofficetips.com` (the screen you showed me). Edit the **`sushi`** row:
   - Address: `<name>.pages.dev.` (with the dot at the end, like your other CNAME rows)
   - Record type: CNAME (alias)

   Save. Leave every other row alone.
4. Wait. It is usually minutes, sometimes an hour or two. Cloudflare's status for the domain changes to **Active** and it issues the HTTPS certificate by itself. Until then you may see certificate errors on `sushi.robsofficetips.com`. That is normal for a friends-only beta.
5. Check `https://sushi.robsofficetips.com`, `/privacy` and `/.well-known/assetlinks.json`.
6. Tidy up (no hurry, a day or two later): in Nginx Proxy Manager disable the `sushi.robsofficetips.com` proxy host, and in `~/docker/sushi-tracker` run `docker compose down` to stop the old container.

If the domain sits on "Verifying" for hours, the usual cause is a wrong or missing CNAME value. Re-check the row in Enom.

---

## Part D: build the Android app file

You are building a thin wrapper that opens your website. Everything happens on the computer you develop on (your Mac; the Linux server is not involved), in a **new folder outside your website repository**, for example `~/sushi-android`. It will hold your signing key.

### What to install

1. **Node.js** (this also gives you `npm`). On a Mac, download the **LTS** installer from https://nodejs.org, or run `brew install node` if you use Homebrew. Then close Terminal, open a new window, and check that `node -v` and `npm -v` both print a version number.
2. **JDK 17**. Bubblewrap needs version 17 specifically. On a Mac run `/usr/libexec/java_home -V` to see which JDKs you have. If 17 is not listed, install "Temurin 17" from https://adoptium.net (or `brew install --cask temurin@17`), or let `bubblewrap doctor` download its own JDK when it offers. After installing, `keytool -help` should work in a new Terminal window.
3. **Bubblewrap**: `npm install -g @bubblewrap/cli` (add `sudo` if you get a permission error).

### Steps

1. Make the folder and put the settings file in it:
   ```
   mkdir sushi-android
   cd sushi-android
   ```
   Copy `android/twa-manifest.json` from this project into `sushi-android`.

2. First-time setup of Bubblewrap:
   ```
   bubblewrap doctor
   ```
   When it asks where the JDK is, give it your JDK 17 folder. On a Mac, `/usr/libexec/java_home -v 17` prints it. When it asks about the Android command-line tools, let it download them. Answer yes to licence prompts. Run `bubblewrap doctor` again until it reports no problems.

3. Create your **upload key**. This is the file that proves updates come from you:
   ```
   keytool -genkeypair -v -keystore android.keystore -alias upload -keyalg RSA -keysize 2048 -validity 20000
   ```
   It asks for a password (use a long one, and the same one when it asks for the key password) and some name details (any sensible answers). **Back up `android.keystore` and the password in your password manager today.** Never put the key in GitHub or send it to anyone. If you lose it, Google can reset it, but it is a hassle.

4. Create the Android project from the settings file:
   ```
   bubblewrap update --skipVersionUpgrade
   ```
   This needs `https://sushi.robsofficetips.com` to be live (Part C), because it downloads the icons and manifest from there.

5. **Check the Android version setting.** Google requires new apps to target Android 16 (API 36). Open `app/build.gradle` and find the line `targetSdkVersion`. It should say `36`. When I tested the current Bubblewrap (version 1.25.0) it already did, but earlier versions said 35, so check. If it says 35, change it to 36 and save.

6. Build:
   ```
   bubblewrap build
   ```
   It asks for the key store password and key password. If it offers to regenerate the project, answer **No**. When it finishes you have:
   - `app-release-bundle.aab`: **this is what you upload to Google Play**
   - `app-release-signed.apk`: an installable file for a quick look on a phone. Purchases will not work in it, and the address bar will show until Part E step 6 is done.

7. Get your upload key's fingerprint (you need it in Part E):
   ```
   keytool -list -v -keystore android.keystore -alias upload
   ```
   Copy the long line that starts `SHA256:` (letters and numbers separated by colons).

**What the settings file does** (so you are not surprised): the app opens `https://sushi.robsofficetips.com/?app=play`. The `?app=play` part is how the website knows it is running inside the Play app, and so starts on the free edition. The file also turns on Google Play Billing for purchases. Bubblewrap insists that "notifications" are switched on whenever Billing is, so that is on too; the app never shows notifications and asks for no extra permissions.

---

## Part E: Google Play Console

Play Console menus get renamed from time to time. Use the search box at the top if something is not where I say.

### 1. Create the app

1. **Create app**. Name `Sushi Train Track`, default language English (Australia), **App** (not game), **Free**, then tick the declarations.
2. If asked to set up a **payments profile / merchant account** (needed for selling Premium), complete it: your details, bank account and tax information. Ask an accountant if you are unsure about GST and income tax.

### 2. Upload the first build to internal testing

1. Go to **Testing**, then **Internal testing**, then **Create new release**.
2. Accept **Play App Signing** when offered. Google then keeps the real signing key and you sign uploads with your upload key.
3. Upload `app-release-bundle.aab`. Name the release `1.0.0`. Save and roll out.
4. If Play complains about the target API level, go back to Part D step 5, fix it, rebuild, and upload again.
5. Add testers: under the internal testing **Testers** tab create an email list containing your own Google account.

### 3. Link the website to the app (this makes the address bar disappear, and Billing work)

1. In Play Console find **App integrity** (App signing). Copy the **SHA-256 certificate fingerprint of the app signing key**. This is Google's key, not yours.
2. Open `.well-known/assetlinks.json` in VS Code. Replace the two placeholders:
   - `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` with the fingerprint from step 1
   - `REPLACE_WITH_UPLOAD_KEY_SHA256` with the fingerprint from Part D step 7
   
   Keep the colons and the quotes. If you used a different package name, change `package_name` too.
3. Commit and push. About a minute later check `https://sushi.robsofficetips.com/.well-known/assetlinks.json` shows your fingerprints.

### 4. Create the Premium product

1. **Monetize with Play**, then **Products**, then **In-app products**, then **Create product**. (Play may want an app version uploaded first, which you did in step 2.)
2. Use the values in `store/listing.md`. **The product ID must be exactly `premium_unlock`**, because the app asks Play for that name.
3. Set your price and make the product **Active**.

### 5. Let yourself test purchases for free

In Play Console **Settings**, then **License testing**, add your own Gmail address. Purchases made by that account are free test purchases.

### 6. Test on a real Android phone

Use the internal-testing opt-in link on a phone signed in with that Gmail account, and install the app **from Play** (not the APK). Then check:

- The app opens full-screen **with no address bar** (if there is a bar, the link in step 3 is not right yet; see Troubleshooting).
- Fresh install: you see **Get started**. Create a restaurant. You can add 5 plates but not a sixth. Menu items and currency show a Premium tag.
- Tap a Premium feature, then **Unlock Premium**. Google's purchase window appears (it says it is a test). Complete it. Everything unlocks.
- Close the app, put the phone in airplane mode, reopen: still Premium.
- Uninstall, reinstall: Premium comes back by itself (or via **Restore purchase** on the unlock screen).
- In Chrome on the same phone, `https://sushi.robsofficetips.com` still shows everything unlocked (the website edition).
- Remove-a-plate, itemised bill and the add-item drawer all work.

### 7. Fill in the store listing and policy forms

Everything is in `store/listing.md`: names, descriptions, the form answers, and the pictures in `store/`. Work down the Dashboard checklist until nothing is left.

### 8. The 14-day closed test (needed because you have a new personal account)

Google requires **at least 12 testers opted in continuously for 14 days** before it lets a new personal account publish.

1. **Testing**, then **Closed testing**: create a track, add the same release (you can promote it from internal testing), and make an email list of 12 or more testers, aiming for around 15 so a drop-out does not restart your clock.
2. Send them the message at the bottom of `store/listing.md` with the opt-in link. Each person must open the link, opt in, and install.
3. After 14 days the Dashboard offers **Apply for production**. You will be asked a few questions about your test (how you found testers, what feedback you got). Answer honestly.
4. Google reviews it, usually within a few days. Then create a **Production** release (promote your build), choose countries, and roll it out.

Your friends and family beta can run on the website the whole time. It does not depend on any of this.

---

## Day to day afterwards

- **Changing the app itself** (features, fixes, wording): edit, commit, push. About a minute later it is live on the website, and the Play app picks it up the next time it opens (people see a "New version ready" prompt if the app was already open). No Play review, no new upload.
- **Changing the Android wrapper** (name, icon, package settings, Billing settings, and the yearly Android version requirement): in your `sushi-android` folder run `bubblewrap update`, then `bubblewrap build`, and upload the new `.aab` to a new release. It adds 1 to the version number for you. Plan for one wrapper update about once a year.
- **Keep the domain.** The app is tied to `sushi.robsofficetips.com`. If you ever change it, existing installs would need a new wrapper release.
- **Try the editions in a browser:** add `?edition=free` or `?edition=premium` to the website address. (It is ignored inside the Play app, so nobody can unlock Premium with a link.)

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| App opens with a browser address bar | The website and app are not linked. Check `/.well-known/assetlinks.json` is live, contains the Play app signing fingerprint, and has the right package name. Android caches the check, so uninstall and reinstall the app after fixing. |
| "Purchases are not available right now" | The app was installed from an APK instead of Play; or the product is not **Active**; or the link above is not working; or Chrome on the phone is very old. |
| Unlock does nothing in a normal browser | Expected. On the website everything is already unlocked, and in `?edition=free` preview mode the button only simulates a purchase. |
| Bubblewrap says "Play Billing requires enableNotifications" | Make sure `enableNotifications` is `true` in your `twa-manifest.json` (it is in mine). |
| `bubblewrap update` says it failed to download the web manifest or icon | The website is not live at the final address yet (Part C). |
| Play rejects the upload because of the target API level | Part D step 5: set `targetSdkVersion 36`, rebuild. |
| Cloudflare build fails or says no files uploaded | Build command must be `sh build.sh` and output directory `dist`. Open the build log. If it says `build.sh` is missing, the files are in a subfolder; set Root directory to that folder. |
| Cloudflare custom domain stays on "Verifying" | The `sushi` CNAME row in Enom is wrong or has not spread yet. |
| Friends see an old version | Open the app once while online. A "New version ready" prompt appears, or reopen it. |
| "This site can't be reached" (`ERR_FAILED`) on the main address, but `/privacy` still works | A phone or browser is stuck on an old service worker. Reload once or twice and it replaces itself. On your own computer you can clear it at once: DevTools (Cmd+Option+I), **Application**, **Service workers**, **Unregister**, then reload. A private window also bypasses it. |

---

## What I could not check myself

- **Real purchases.** I tested the purchase code against a simulated Google Play service, covering buying, cancelling, failing, restoring, refunds and offline start. Real purchases only work inside a Play-installed app, so Part E step 6 is the real test.
- **Google's fee for a one-time purchase** on your first US$1 million of earnings: the page I read showed the standard rate and a 5% billing fee, but the cell for a reduced rate came through blank. Check "Service fees" in Play Console.
- **Cloudflare serving the hidden `.well-known` folder.** I added a backup route, as described in Part B step 6.
- **Menu names** in Play Console and Cloudflare, which change often.
