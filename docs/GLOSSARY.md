# Glossary: the words we use

So we always mean the same thing. If a word here is not what you call it, tell me and I will change the word here (and in the code comments).

## Screens

| Term | Meaning | In the code |
|---|---|---|
| **Landing page** | The first screen: the sushi hero picture and the restaurant pick list ("Get started" when you have none) | `viewPick` |
| **Pick list** | The drop-down / list of your restaurants, with "add new" at the end | `#rest-select` |
| **Bill screen** | The main screen: total at the top, plates, drawer at the bottom | `viewBill` |
| **Itemised bill** | "Your meal at <restaurant>": the list of every plate colour and extra with the total. Always a modal over the bill screen, opened by tapping the total or from the menu | `itemisedHtml`, `openItemised` |
| **Setup screen** | Where you create or edit a restaurant: name, currency, plates, menu items. (Also called "edit restaurant") | `viewEdit` |
| **Sort by price** | The link beside "Plates" on the setup screen (shown when there are two or more plates). Puts the plates cheapest first; same-price plates keep their order. A toast offers **Undo**. Nothing is kept until you press Save | `sortDraftPlates` |
| **Menu (top-right)** | The three-line menu on the bill screen: itemised bill, remove a plate, keep screen on, zoom, edit, share, new restaurant, switch restaurant, end meal | `data-act="menu"` |
| **End meal** | The last item in the menu. Shows the itemised bill with "Hope you enjoyed your meal!" and an **End meal** button, which clears the bill and goes back to the landing page. Close leaves the bill as it is | `end-meal` |
| **Share card** | Opened by **Share** in the menu: Share this restaurant, Share all restaurants (when you have more than one), Receive from a friend | `openShareMenu` |
| **Share code** | The QR code shown for sharing. A big share shows several codes in turn ("Code 1 of 3") | `openShareCode`, `shareParts` |
| **Scanner** | "Receive from a friend": the camera view that reads a share code, with "Scan a photo of the code instead". Also reachable from the landing page ("Got a code from a friend? Scan it") and the pick list | `openScanner` |
| **Clash question** | "You already have …" when a received restaurant has the same name as one of yours: **Replace mine**, **Merge**, **Keep both**, and Cancel / Skip this one | `askClash` |

## Parts of the bill screen

| Term | Meaning |
|---|---|
| **Total** | The big running amount at the top. Tap it for the itemised bill |
| **Plate / plate button** | A coloured circle with its price and how many you have taken. Tap to add one. |
| **Plate count** | The number on a plate |
| **+ circle** (add-plate circle) | The dotted circle after the last plate that adds a new plate |
| **Remove mode** (wiggle mode) | Plates wiggle and each tap removes one, until you press **Done** |
| **Long-press remove** | Holding a plate for about half a second, which asks "Remove one plate?" |
| **Bar** | The strip at the bottom with the **restaurant name**. Tapping it opens the drawer. |
| **Handle** | The tab on top of the bar: "Menu items (3) ^" when closed, "Close" when open |
| **Drawer** | The whole sliding panel: bar + handle + item list + add row |
| **Item list** | Inside the drawer: grouped lines like "2 x Green tea" with − and + buttons and the price |
| **Add row** | Inside the drawer: description box, price box and the Add button |
| **Suggestions** | The list that appears under the description box. "other menu" means it came from another restaurant (no price) |
| **Keep screen on** | The on/off switch in the menu that stops the phone going to sleep while the app is on screen. Remembered on that phone. Hidden in browsers that can't do it |
| **Zoom** | How many plates across (2 to 6). Pinch the plates, or use − and + beside Zoom in the menu. One setting for the whole phone; until it is set the screen picks for itself. Pinching anywhere else zooms the page as normal |
| **Toast** | The small message that pops up and fades ("Green tea added") |
| **Modal** | A pop-up card over the screen (remove one plate?, add a plate, plate colour) |
| **Colour chooser** | The swatches plus the rainbow circle for mixing your own colour |

## Sharing words

| Term | Meaning |
|---|---|
| **Replace mine** | Your restaurant takes your friend's currency, plates, prices and menu items. It keeps your name, and plates of the same colour keep their count on a bill in progress |
| **Merge** | Yours stays as it is and any plates (by colour) and menu items (by name) you don't have are added. Only offered when both use the same currency |
| **Keep both** | Theirs is added as a new restaurant, e.g. "Kura (2)" |

## Things on a bill

| Term | Meaning |
|---|---|
| **Plate** | A coloured plate on the belt, with a fixed price per restaurant |
| **Extra** (or **item on the bill**) | Anything that is not a plate, e.g. a drink. Each one has a price and an optional description. In the code: `extras`. |
| **Menu item** (saved item) | A saved extra on a restaurant, so you can pick it again in one tap. In the code: `items`. |

(An *extra* is what is on today's bill. A *menu item* is what the restaurant remembers. Adding an extra with a new description creates a menu item.)

## Where the app runs

| Term | Meaning |
|---|---|
| **Website** | sushi.robsofficetips.com opened in a browser or installed from the browser |
| **Play app** | The Android app from Google Play. It is the same site inside a thin Android wrapper (`?app=play`). |

Both are the same app with everything included. (Until 21 Oct 2026 the Play app had a Free and a Premium edition; that is gone.)

## How we work

| Term | Meaning |
|---|---|
| **Enhancement** | One change you ask for. Coded, tested on its own plus a quick check of the rest (`npm run test:quick`), and pushed to `testing` for you to try. No release paperwork |
| **Release** | When you say so: full regression on everything in `testing`, fixes, and a list of the enhancements going in, for you to test |
| **Package it into main** | After a release passes and you're happy: version label, any affected screenshots/listing/privacy policy, zip, merge `testing` into `main`. This is what goes live |
| **Version label** | The text on the landing page ("12 Oct 2026 · menu items handle") so you can tell which copy is running |
| **Baseline** | The first git commit of the cleaned-up project: the app exactly as it was before the cleanup |
| **Suite** | One file of automatic checks in `tests/suites/` |
| **Check** | One single true-or-false test inside a suite |
| **Source / built page** | `src/` is where the app is edited. The **built page** (`dist/index.html`) is what is deployed. |
