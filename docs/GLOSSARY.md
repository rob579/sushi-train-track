# Glossary: the words we use

So we always mean the same thing. If a word here is not what you call it, tell me and I will change the word here (and in the code comments).

## Screens

| Term | Meaning | In the code |
|---|---|---|
| **Landing page** | The first screen: the sushi hero picture and the restaurant pick list ("Get started" when you have none) | `viewPick` |
| **Pick list** | The drop-down / list of your restaurants, with "add new" at the end | `#rest-select` |
| **Bill screen** | The main screen: total at the top, plates, drawer at the bottom | `viewBill` |
| **Itemised bill** | The list of every plate colour and extra with the total. Always a modal over the bill screen, opened by tapping the total or from the menu | `itemisedHtml`, `openItemised` |
| **Setup screen** | Where you create or edit a restaurant: name, currency, plates, menu items. (Also called "edit restaurant") | `viewEdit` |
| **Menu (top-right)** | The three-line menu on the bill screen: itemised bill, remove a plate, keep screen on, edit, new restaurant, switch restaurant, start a new bill | `data-act="menu"` |

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
| **Toast** | The small message that pops up and fades ("Green tea added") |
| **Modal** | A pop-up card over the screen (remove one plate?, add a plate, plate colour) |
| **Colour chooser** | The swatches plus the rainbow circle for mixing your own colour |

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
| **Incremental update** | A small change. I test only what changed (plus a quick check). No release paperwork. |
| **Release update** | A version you will publish or hand to testers. Full test, plus whatever assets, docs and zip are affected. |
| **Version label** | The text on the landing page ("12 Oct 2026 · menu items handle") so you can tell which copy is running |
| **Baseline** | The first git commit of the cleaned-up project: the app exactly as it was before the cleanup |
| **Suite** | One file of automatic checks in `tests/suites/` |
| **Check** | One single true-or-false test inside a suite |
| **Source / built page** | `src/` is where the app is edited. The **built page** (`dist/index.html`) is what is deployed. |
