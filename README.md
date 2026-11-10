# Shelfwise

Shelfwise compares one grocery list across eight chains in the Piedmont Triad of North Carolina. It ranks them by bang for the buck: the shelf price, the drive from your town, and a quality adjustment. It is a phone-first site you can add to a home screen. It still runs as a static site with no account.

Shelf prices start as dated Triad estimates for comparable packages (October 18, 2026). A price you type, a price from your receipt, or a fresh community median replaces that estimate for the line it covers. Gas uses the weekly EIA price for Lower Atlantic regular, unless you enter the price you paid at the pump. Pickup and delivery rows are published-fee estimates, not a live checkout.

Nothing is scraped from a store site. Kroger and Walmart price APIs are not used: their terms do not allow this kind of comparison.

The site is static. `index.html` is at the repository root. There is no build step. Open it with any static file server, or host it on GitHub Pages.

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`. ES modules and the service worker do not load from a `file://` URL.

```bash
npm test
```

## What works with no backend

Leave `BACKEND_URL` in `js/config.js` as an empty string. That is the default, and GitHub Pages does not need a server.

- The eight-chain comparison, presets, loyalty cards, weekly ad estimates, split trip, share link, print, and download.
- The bundled EIA gas price: **$3.695 per gallon**, Lower Atlantic (PADD 1C) regular, week of November 2, 2026 (released November 3, 2026), with a link to the EIA series. A "price I paid at the pump" override replaces it in the drive math.
- Pickup, store delivery, Instacart, DoorDash, Uber Eats, and Shipt rows, dated November 10, 2026, with source links. Amounts that were not on a public fee page stay labeled as the older estimate.
- **Send list to Instacart** copies the list and opens Instacart search.
- Receipt photos are read on the phone with tesseract.js (downloaded the first time you scan). You review every match. Confirmed prices save on this phone only. The photo is never uploaded.
- Add to Home Screen, and offline use of the app shell plus the last list and prices saved on the device.

## What the optional worker adds

Set `BACKEND_URL` in `js/config.js` to the worker origin, with no trailing path. That is the only place the site learns the URL.

- **Gas.** `GET /gas` returns the latest EIA weekly point for series `EMM_EPMR_PTE_R1Z_DPG` and caches it for six hours. The page uses it when its week is the same as or newer than the bundled week. The pump override still wins.
- **Community prices.** `POST /prices` accepts anonymous reports: store, item, tier, price, date, and town. No photo and no account. The worker checks the catalog, rejects old or impossible prices, rate-limits by a hash of the IP (40 reports a day), and stores the pool in KV. `GET /prices` returns medians of reports from the last 21 days. The page prefers a town median when that town has at least two fresh reports, otherwise the regional median, and it prefers those over bundled estimates and ad estimates.
- **Instacart.** `POST /instacart/list` calls the Instacart Developer Platform shopping-list API and returns `products_link_url`. The key stays on the worker. If the key is missing or the call fails, the button falls back to copy and search.

The page still loads if the worker is down. It keeps the last gas week and community medians saved in this browser.

## Install it on a phone

The site is a progressive web app. `manifest.json` and `sw.js` are at the repository root so GitHub Pages can serve them. Icons are in `icons/`.

- **Android Chrome:** the install card can call the browser install prompt. You can also use the browser menu and choose Install app or Add to Home screen.
- **iPhone Safari:** tap Share, then Add to Home Screen. iOS does not offer a one-tap install prompt to the page.
- After that, Shelfwise opens full screen and the service worker serves the shell and bundled data when the phone is offline. The last list, pump price, receipt prices, and last community or EIA response stay in `localStorage`.
- A new deploy is fetched with a cache-busting request. If a page is still running the previous copy when the new service worker takes over, Shelfwise shows **An update is ready** and a Reload button.

## GitHub Pages

In the repository settings, set Pages to deploy from the `main` branch and the root folder (`/`). There is no build command. HTTPS is required for the service worker and for Add to Home Screen.

After you deploy the worker, put its URL in `js/config.js` and push that change to `main`. An empty string is the supported default.

## The optional Cloudflare Worker

The worker lives in `worker/`. It is not part of the GitHub Pages deploy. You need three accounts only if you want the live pieces. None of the keys go in the static site or in git.

1. A free [Cloudflare](https://dash.cloudflare.com/sign-up) account, to host the worker, one KV namespace for the gas cache, and one Durable Object for the price pool.
2. A free [EIA Open Data API key](https://www.eia.gov/opendata/register.php). Secret name: `EIA_API_KEY`.
3. An [Instacart Developer Platform](https://docs.instacart.com/developer_platform_api) key, optional. Secret name: `INSTACART_API_KEY`. A development key uses `https://connect.dev.instacart.tools`. A production key, after Instacart's review, uses `https://connect.instacart.com`.

No Target, Publix, Aldi, Lidl, Food Lion, or Lowes Foods developer key exists for this. Do not add a Kroger key or a Walmart affiliate key for comparison. Do not scrape.

From `worker/`, with [Wrangler](https://developers.cloudflare.com/workers/wrangler/) logged in (`npx wrangler login`):

```bash
cd worker
npm install
npx wrangler kv namespace create SHELFWISE
```

Copy the namespace id into `worker/wrangler.toml`, replacing `00000000000000000000000000000000`. The price pool is the `PricePool` Durable Object already declared in that file. `npx wrangler deploy` applies its migration. Writes to the pool are serialized on that one object, so two reports sent at the same time are both kept. KV is only the last EIA week.

`ALLOWED_ORIGINS` in `wrangler.toml` is the comma-separated list of site origins allowed to call the worker. There is no wildcard. The default includes `https://jameselliott72693-hue.github.io` and local static servers. Add a custom domain origin before pointing that site at the worker. A browser request from any other origin is rejected. Sharing also requires `consent: true` plus the phone's random session id; the id is only used to drop a double tap, and two shoppers who paid the same price both count.

```bash
npx wrangler secret put EIA_API_KEY
npx wrangler secret put INSTACART_API_KEY
```

Skip the Instacart secret if you do not have a key yet. The button will copy the list and open search. For a development key, set `INSTACART_API_BASE` in `wrangler.toml` to `https://connect.dev.instacart.tools` before deploying. The worker refuses to send the key to any other host.

```bash
npx wrangler deploy
```

Wrangler prints an `https://shelfwise.<account>.workers.dev` URL. Put that origin in `js/config.js`:

```js
export const BACKEND_URL = "https://shelfwise.<account>.workers.dev";
```

Local worker, using `worker/.dev.vars` (copy `.dev.vars.example`; that file is gitignored):

```bash
npx wrangler dev
```

Point `BACKEND_URL` at `http://127.0.0.1:8787` while you try it. Put the production URL back before you push to GitHub Pages.

`GET /health` returns `{ ok, gas, instacart, pool }` and does not include secret values.

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
- **Every shelf price** accepts a typed replacement. Only prices you change are stored on this device. **Use estimates again** clears typed prices and receipt prices for that store. Community medians remain.
- Preset lists: family week, breakfasts, cookout, pantry, and household. Add items, remove them, and change quantities. Each line is store brand, name brand, or premium. Filter the catalog by brand, including Cheerios, Duke's, Tide, and Coca-Cola.
- Weekly ad estimates are on by default and labeled as estimates. A loyalty card unlocks that chain's ad and takes 5% off its store brands. A receipt or community price is used instead of the ad.
- A split-trip card prices the list at two stores when the shelf savings beat the extra drive.
- **Send list to Instacart** uses the worker when a key is configured. DoorDash and Uber Eats cannot import an outside cart. Those buttons copy the list and open that service's search. **Download list** saves a text file. **Copy share link** puts the list and trip settings in the URL hash. **Print** uses a print view. Edited prices, receipts, and community rows stay on the device and are not part of the link.
- **Pickup and delivery** compares store pickup, store delivery, Instacart, DoorDash, Uber Eats, and Shipt. Each available row splits food, app markup, the delivery or pickup fee, and the service fee, and links the source. Tips are none, $5, or 10%. Membership toggles: Walmart+, Instacart+, DashPass, Uber One, Shipt (also the Target Circle 360 same-day estimate), and Lowes To Go.
- **Scan a receipt.** Take a photo, upload one, or paste the text. On-device OCR extracts lines. Match them to Shelfwise items, edit the price and tier, then save. Sharing with the community is a separate checkbox and only appears as a working option when a worker is configured.
- Pick a Triad town, or use **Use my location**. The point is saved in this browser and is not sent with a receipt. The town you pick is the town sent with an opt-in price report.
- Distance is straight-line miles times a road factor (default 1.3), labeled approximate. Fuel defaults to 26 mpg and the EIA price. Both the road factor and mpg are editable under **Gas and the drive**, along with a fuel-only dollars-per-mile option.

## How a shelf price is chosen

For each item, store, and tier, in order:

1. A price you typed.
2. A price you confirmed from a receipt on this phone, with that receipt's date.
3. A community median from the last 21 days, when one exists.
4. The weekly ad estimate, when it is on and it is lower than the regular estimate.
5. The store-brand card estimate, 5% off, when that card is on.
6. The bundled Triad estimate from October 18, 2026.

Each line shows which of those it used, and the date for estimates, receipts, and community prices. Community prices are a median. One town needs two fresh reports before its median replaces the regional one.

## How the rank is computed

Shelf is the sum of the line prices at that chain.

Drive is the fuel for a round trip to the nearest store in the built-in list. One-way miles are the straight-line distance times the road factor. In MPG mode the price is your pump price, or else the newest EIA week, or else the bundled $3.695.

Quality is not a charge at the register. Each chain has a produce, meat, and other score from −2 to +2 in `data/stores.js`. On Balanced, each point is a 9% credit (better than typical) or penalty (worse) on that department's shelf dollars. Quality first doubles the weight. Price only sets it to $0. The rate lives in `QUALITY_RATE` in `js/calc.js`.

A chain that does not sell a chosen brand is marked incomplete and ranked after chains that can fill the list. A receipt or a typed price for that line counts as carried.

The split trip tries every pair. Each item goes to the store with the lower shelf-plus-quality cost. Drive is two separate round trips, not a loop. The card suggests the pair only when it beats the best single store by at least $1.50 after that extra drive.

## Gas and fees

Gas is the EIA weekly retail average for Lower Atlantic (PADD 1C) regular, all formulations. There is no Greensboro or North Carolina series on that table. The bundled copy is the week of November 2, 2026, $3.695, from [the EIA series](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_R1Z_DPG&f=W). The worker replaces it when EIA has that week or a newer one. The pump field is the only station-level price.

Fee figures are estimates reviewed November 10, 2026. Confirm them at checkout. The notes in `data/stores.js` and the links in `data/fees.js` say where a number was published and where it was not:

- Harris Teeter pickup is free at $35, otherwise $4.95.
- Lowes Foods To Go is $4.95 per order, or included with the $49 annual membership. To Go shelf prices match the store.
- Target Drive Up and Order Pickup are $0. Same-day is $9.99, or $0 over $35 with Target Circle 360 ($99 a year, $49 with a Target Circle Card). The Shipt toggle stands in for that membership.
- Instacart's delivery fee varies. Instacart+ is $0 delivery on eligible orders of $10 or more, and service fees still apply. The non-member delivery amount in the model is a typical estimate.
- Walmart and Food Lion fee pages did not load. Those dollar amounts are still the October 18, 2026 estimates.
- DoorDash and Uber Eats do not publish one national grocery fee. Those amounts are typical estimates.
- Aldi and Lidl stay off in this Triad model. Aldi's national delivery is Instacart-powered, and Instacart prices can differ from the shelf. No official US Lidl fee was confirmed.

## How to update prices

All bundled shelf numbers flow from `data/prices.js`. After an edit, refresh the browser. There is no build. Bump the service worker cache name in `sw.js` (`CACHE`) when you change cached files. The worker then asks for those files with `cache: "reload"`, and an open tab shows **An update is ready**.

1. Change `PRICE_AS_OF` and `PRICE_AS_OF_LABEL`.
2. Move every store-brand shelf together with `STORE_FACTOR`, or national-brand shelves with `NATIONAL_FACTOR`.
3. Change a package's starting price on the item in `data/items.js` (`base` for store brand, `nameBase`, `premiumBase`). `nameAt` and `premiumAt` list the chains that carry that tier. `null` means not carried.
4. Set one known shelf in `cellOverrides`:

   ```js
   milk: { aldi: { store: 2.85 } }
   ```

   Use `null` for a tier a store does not carry.
5. Replace `weeklyAds` for the new ad week. Each entry is an item, a store, a tier, a dollar price, and `loyalty: true` when the card has to be on. These are sale estimates, not a scanned circular.

The bundled gas week is `data/gas.js`. Fee copy and links are `data/fees.js`. Quality scores and the location list are in `data/stores.js`. Town centers are in `data/towns.js`.

## Privacy

Lists, typed prices, receipt prices, the pump price, fuel settings, the last community medians, the last EIA week, and an optional location stay in `localStorage` under `shelfwise.v1`. The share link encodes the list and the trip settings only.

A receipt photo is decoded on the phone and then discarded with the review. It is not stored and not uploaded. An opt-in community report sends store, item, tier, price, date, town, and a random per-phone id stored locally as `shelfwise.session`. The id is not an account and is not shown in the comparison. It only stops one phone from counting the same price twice; two phones that paid the same price both count. The worker rejects a report that does not include that opt-in flag. It does not keep the IP next to the price. The daily counter, under a hash of the IP, lives in the same Durable Object as the pool.

## Tests

```bash
npm test
```

`tests/calc.test.mjs` covers the original rank, drive, and fee math. `tests/merge.test.mjs` covers price order, medians, gas choice, and the reviewed fees. `tests/input.test.mjs` covers unfinished decimals and Instacart link checks. `tests/receipt.test.mjs` covers receipt parsing. `tests/worker.test.mjs` covers the worker's validation, rate limit, consent, CORS, EIA parsing, and Instacart call shape with a fake network.

## Files

| Path | Role |
| --- | --- |
| `index.html` | Page shell, manifest, and Apple web app tags |
| `manifest.json` | Home-screen install metadata |
| `sw.js` | Offline shell and last cached files |
| `icons/` | Home-screen icons |
| `css/styles.css` | Layout, including a phone width and a print view |
| `js/config.js` | The only backend URL |
| `js/app.js` | Screen and events |
| `js/calc.js` | Rank, drive, quality, split trip, price order |
| `js/pool.js` | Community median, freshness, and report checks |
| `js/gas.js` | EIA parsing and pump-versus-published gas |
| `js/receipt.js` | Receipt text parsing and item matching |
| `js/ocr.js` | Lazy on-device OCR |
| `js/remote.js` | Calls to the optional worker |
| `js/pwa.js` | Service worker registration and install detection |
| `js/format.js` | Money, miles, source labels, and the text export |
| `js/storage.js` | `localStorage` and the share hash |
| `data/stores.js` | Chains, locations, quality, service coverage |
| `data/towns.js` | Triad towns |
| `data/items.js` | Catalog and preset lists |
| `data/prices.js` | Dated shelf estimates and ads |
| `data/fees.js` | Dated pickup and delivery estimates, with sources |
| `data/gas.js` | Bundled EIA gasoline week |
| `worker/` | Optional Cloudflare Worker |
