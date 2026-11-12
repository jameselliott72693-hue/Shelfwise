# Shelfwise

Shelfwise compares one grocery list across eight chains in the Piedmont Triad of North Carolina. It ranks them by bang for the buck: the shelf price, the drive from your town, and a quality adjustment. Prices are dated Triad estimates for comparable packages, not live register scans.

The site is static. `index.html` is at the repository root. There is no build step, no server, and no account. Open it with any static file server, or host it on GitHub Pages.

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`. ES modules do not load from a `file://` URL.

## GitHub Pages

In the repository settings, set Pages to deploy from the `main` branch and the root folder (`/`). The site is the files in this repository. No build command.

## The eight chains

These chains operate in the Triad (Greensboro, Winston-Salem, High Point, Burlington, and nearby towns):

| Chain | Shelf card in this app |
| --- | --- |
| Aldi | None |
| Lidl | Lidl Plus |
| Walmart | None (Walmart+ is a delivery toggle only) |
| Food Lion | Food Lion MVP |
| Harris Teeter | Harris Teeter VIC |
| Lowes Foods | Lowes Foods Rewards |
| Target | Target Circle |
| Publix | None |

Lowes Foods is based in Winston-Salem. The location list in `data/stores.js` is a working set of real stores, not every front door. Coordinates are approximate and are used only in the browser to estimate distance.

## What you can do

- The app opens on a sample family week for Summerfield.
- All-in total = shelf + drive + quality. Choose **Price only**, **Balanced**, or **Quality first**.
- A winner card explains the result, including the savings versus the runner-up and versus the most expensive store that can fill the list.
- Eight ranked stores, with bars showing how close each all-in total is to the winner. Tap a store to price the whole list there.
- **Every shelf price** accepts a typed replacement. Only prices you change are stored on this device. **Use estimates again** clears one store.
- Preset lists: family week, breakfasts, cookout, pantry, and household. Add items, remove them, and change quantities. Each line is store brand, name brand, or premium. Filter the catalog by brand, including Cheerios, Duke's, Tide, and Coca-Cola. Produce, meat, dairy, frozen, pantry, drinks, and household are all in the catalog.
- Weekly ad estimates are on by default and labeled as estimates. A loyalty card unlocks that chain's ad and takes 5% off its store brands.
- A split-trip card prices the list at two stores when the shelf savings beat the extra drive, and shows the shelf, drive, and quality math either way.
- DoorDash and Uber Eats cannot import an outside cart. Those buttons copy the list and open that service's search. **Download list** saves a text file. **Copy share link** puts the list in the URL hash. **Print** uses a print view. Edited shelf prices stay on the device and are not part of the link.
- **Delivery fees** compares store pickup, store delivery, Instacart, DoorDash, Uber Eats, and Shipt. Each available row splits food, app markup, the delivery or pickup fee, and the service fee. Tips are none, $5, or 10%. Membership toggles: Walmart+, Instacart+, DashPass, Uber One, Shipt, and Lowes To Go. Rows say where a service does not carry that chain, or not every Triad store.
- Pick a Triad town, or use **Use my location**. The browser asks permission. The point is saved in this browser and is not sent anywhere.
- Distance is straight-line miles times a road factor (default 1.3), labeled approximate. Fuel defaults to 26 mpg and $3.609 per gallon. Both are editable under **How the drive counts**, along with a fuel-only dollars-per-mile option.

## How the rank is computed

Shelf is the sum of the line prices at that chain.

Drive is the fuel for a round trip to the nearest store in the built-in list. One-way miles are the straight-line distance times the road factor.

Quality is not a charge at the register. Each chain has a produce, meat, and other score from −2 to +2 in `data/stores.js`. On Balanced, each point is a 9% credit (better than typical) or penalty (worse) on that department's shelf dollars. Quality first doubles the weight. Price only sets it to $0. The rate lives in `QUALITY_RATE` in `js/calc.js`.

A chain that does not sell a chosen brand is marked incomplete and ranked after chains that can fill the list. You can switch the missing lines to store brand, or type a price for that shelf.

The split trip tries every pair. Each item goes to the store with the lower shelf-plus-quality cost. Drive is two separate round trips, not a loop. The card suggests the pair only when it beats the best single store by at least $1.50 after that extra drive.

## Prices, fees, and gas are estimates

Nothing is scraped and the page does not call a price API.

- Shelf prices are hand-set comparable-package estimates as of **October 18, 2026**. Weekly ads confirmed on a later public circular are dated **November 11, 2026** for Aldi, Food Lion, Harris Teeter, Lidl, and Lowes Foods, and **November 8, 2026** for Target. Publix and Walmart ad rows were not replaced. See `data/prices.js`.
- Delivery figures mix pages checked **November 12, 2026** with October 18 estimates where a public page did not publish a fixed dollar. See `data/fees.js` and each chain's `services` in `data/stores.js`.
- The default gas price, $3.609 per gallon, is the EIA weekly regular price for the Lower Atlantic (PADD 1C) for the week of **November 9, 2026**. It is not a station quote. See `data/gas.js`.

## How to update prices

All shelf numbers flow from `data/prices.js`. After an edit, refresh the browser. There is no build.

1. Change `PRICE_AS_OF` and `PRICE_AS_OF_LABEL`.
2. Move every store-brand shelf together with `STORE_FACTOR`, or national-brand shelves with `NATIONAL_FACTOR`.
3. Change a package's starting price on the item in `data/items.js` (`base` for store brand, `nameBase`, `premiumBase`). `nameAt` and `premiumAt` list the chains that carry that tier. `null` means not carried.
4. Set one known shelf in `cellOverrides`:

   ```js
   milk: { aldi: { store: 2.85 } }
   ```

   Use `null` for a tier a store does not carry.
5. Replace `weeklyAds` for the new ad week. Each entry is an item, a store, a tier, a dollar price, `loyalty: true` when the card has to be on, and `asOf` for the circular date. Keep an older row, with its old `asOf`, when the new circular does not confirm that package.

Quality scores and the location list are in `data/stores.js`. Town centers are in `data/towns.js`. Fee estimates are in `data/fees.js` (`THIRD_PARTY` for the apps, and each chain's `services` for its own pickup and delivery).

## Privacy

Lists, edited prices, fuel settings, and an optional location stay in `localStorage` under `shelfwise.v1`. The share link encodes the list and the trip settings only.

## Tests

```bash
node --test tests/calc.test.mjs
```

## Files

| Path | Role |
| --- | --- |
| `index.html` | Page shell |
| `css/styles.css` | Layout, including a print view |
| `js/app.js` | Screen and events |
| `js/calc.js` | Rank, drive, quality, split trip |
| `js/format.js` | Money, miles, and the text export |
| `js/storage.js` | `localStorage` and the share hash |
| `data/stores.js` | Chains, locations, quality, service coverage |
| `data/towns.js` | Triad towns |
| `data/items.js` | Catalog and preset lists |
| `data/prices.js` | Dated shelf estimates and ads |
| `data/fees.js` | Dated delivery-fee estimates |
| `data/gas.js` | Default EIA gasoline price |
