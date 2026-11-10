import { towns, townById } from "../data/towns.js";
import { chains, chainById } from "../data/stores.js";
import { items, itemById, aisles, presets, presetById, brandOptions, brandLabel, packageSize, cloneLines } from "../data/items.js";
import { PRICE_AS_OF_LABEL } from "../data/prices.js";
import { FEE_NOTE, MEMBERSHIPS, deliveryRows } from "../data/fees.js";
import { GAS_FALLBACK } from "../data/gas.js";
import { scoreTrip, quoteUnit, MODE_LABEL, QUALITY_RATE, qualityWord, SPLIT_MIN_SAVE } from "./calc.js";
import { money, miles, esc, sourceDetail, tierLabel, listText, prettyDate } from "./format.js";
import { loadState, saveState, encodeShare, decodeShare } from "./storage.js";
import { effectiveGas } from "./gas.js";
import { backendConfigured, fetchHealth, fetchGas, fetchPrices, submitPrices, createInstacartLink } from "./remote.js";
import { parseReceiptText } from "./receipt.js";
import { readReceiptImage } from "./ocr.js";
import { registerServiceWorker, isStandalone, isIosSafari } from "./pwa.js";

const FEATURED = ["Cheerios", "Duke's", "Tide", "Coca-Cola"];
const LOYALTY = [
  { id: "foodlion", name: "Food Lion MVP" },
  { id: "harristeeter", name: "Harris Teeter VIC" },
  { id: "lowes", name: "Lowes Foods Rewards" },
  { id: "target", name: "Target Circle" },
  { id: "lidl", name: "Lidl Plus" },
];

let state = loadState();
const shared = decodeShare(location.hash);
if (shared) {
  state = {
    ...state,
    townId: shared.townId,
    geo: shared.geo,
    priority: shared.priority,
    weeklyAds: shared.weeklyAds,
    loyalty: shared.loyalty,
    lines: shared.lines,
    drive: shared.drive,
    tip: shared.tip,
    memberships: shared.memberships,
  };
}

let renderTimer = 0;
let toastTimer = 0;
let installEvent = null;
let gasNote = "";
let receiptPaste = "";
let draft = null;
const services = { instacart: null, gas: null, pool: null };

const app = document.getElementById("app");
app.addEventListener("click", onClick);
app.addEventListener("change", onChange);
app.addEventListener("input", onInput);

render();
registerServiceWorker();
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installEvent = event;
  render();
});
window.addEventListener("online", () => render());
window.addEventListener("offline", () => render());
refreshRemote();

function currentOrigin() {
  if (state.geo) return { lat: state.geo.lat, lng: state.geo.lng, label: "your location" };
  const town = townById[state.townId] || townById.summerfield;
  return { lat: town.lat, lng: town.lng, label: town.name };
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function gasNow() {
  return effectiveGas({ pumpPrice: state.drive.pumpPrice, live: state.liveGas });
}

function tripOptions(origin) {
  const gas = gasNow();
  return {
    lines: state.lines,
    origin,
    priority: state.priority,
    weeklyAds: state.weeklyAds,
    loyalty: state.loyalty,
    overrides: state.overrides,
    receipts: state.receipts,
    community: state.communityRows,
    townId: state.townId,
    today: localToday(),
    drive: { ...state.drive, gasPrice: gas.price },
  };
}

function persist() {
  saveState(state);
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 180);
}

function render() {
  clearTimeout(renderTimer);
  const active = document.activeElement;
  const activeId = active && app.contains(active) ? active.id : "";
  const start = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const end = active && typeof active.selectionEnd === "number" ? active.selectionEnd : null;
  const scrollY = window.scrollY;
  const loyaltyOpen = document.querySelector(".loyalty")?.open;
  const resultsScroll = document.querySelector(".results")?.scrollTop || 0;
  const origin = currentOrigin();
  const result = scoreTrip(tripOptions(origin));
  app.innerHTML = view(origin, result);
  const loyalty = document.querySelector(".loyalty");
  if (loyalty && loyaltyOpen) loyalty.open = true;
  const results = document.querySelector(".results");
  if (results) results.scrollTop = resultsScroll;
  if (activeId) {
    const next = document.getElementById(activeId);
    if (next) {
      next.focus({ preventScroll: true });
      if (start != null && next.setSelectionRange) {
        try { next.setSelectionRange(start, end); } catch { /* number inputs */ }
      }
    }
  }
  window.scrollTo(0, scrollY);
}

function view(origin, result) {
  return `
    ${installCard()}
    ${navigator.onLine ? "" : `<div class="offline-wrap"><p class="offline-note">Offline. Shelfwise is using the list and prices saved on this phone.</p></div>`}
    ${toolbar(origin)}
    <div class="jump-wrap">
      <nav class="jump" aria-label="Sections">
        <a href="#results">Rank</a>
        <a href="#your-list">List</a>
        <a href="#receipt">Receipt</a>
        <a href="#delivery">Fees</a>
        <a href="#drive">Gas</a>
      </nav>
    </div>
    <p class="disclaimer">Shelf lines are Triad estimates as of ${esc(PRICE_AS_OF_LABEL)} unless a tag says your receipt or a community date. Gas is the latest EIA weekly price on this phone. Fees are published estimates. Nothing is scraped.</p>
    <div class="layout">
      <section class="results" id="results">
        ${winnerCard(origin, result)}
        ${rankList(result)}
        ${splitCard(result)}
      </section>
      <div class="work">
        ${detailCard(origin, result)}
        ${listCard(result)}
        ${receiptCard()}
        ${editorCard(result)}
        ${feeCard(result)}
        ${driveCard()}
      </div>
    </div>
  `;
}

function toolbar(origin) {
  const geoOn = Boolean(state.geo);
  return `
    <section class="toolbar" aria-label="Trip settings">
      <div class="toolbar-row">
        <label class="field">
          <span>Town</span>
          <select id="town" data-action="town">
            ${geoOn ? `<option value="" selected>Your location</option>` : ""}
            ${towns.map((town) => `<option value="${town.id}" ${!geoOn && town.id === state.townId ? "selected" : ""}>${esc(town.name)}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="button" data-action="locate">Use my location</button>
        ${geoOn ? `<button type="button" class="button button-quiet" data-action="forget-geo">Forget location</button>` : ""}
      </div>
      <p class="hint">${geoOn
        ? `Using a point on this device near ${state.geo.lat.toFixed(2)}, ${state.geo.lng.toFixed(2)}. It is not sent anywhere.`
        : `From ${esc(origin.label)}, NC. The browser will ask before using your location, and that point stays on this device.`}
        ${state.geoError ? `<span class="hint-warn">${esc(state.geoError)}</span>` : ""}
      </p>
      <fieldset class="segment">
        <legend>What should win</legend>
        ${["price", "balanced", "quality"].map((mode) => `
          <label class="${state.priority === mode ? "is-on" : ""}">
            <input type="radio" name="priority" value="${mode}" ${state.priority === mode ? "checked" : ""} data-action="priority">
            ${MODE_LABEL[mode]}
          </label>
        `).join("")}
      </fieldset>
      <label class="check">
        <input type="checkbox" data-action="ads" ${state.weeklyAds ? "checked" : ""}>
        Weekly ad estimates
      </label>
      <details class="loyalty">
        <summary>${LOYALTY.filter((card) => state.loyalty[card.id]).length} loyalty cards on · store brand −5% and that store's ad</summary>
        <div class="checks">
          ${LOYALTY.map((card) => `
            <label class="check">
              <input type="checkbox" data-action="loyalty" data-store="${card.id}" ${state.loyalty[card.id] ? "checked" : ""}>
              ${esc(card.name)}
            </label>
          `).join("")}
        </div>
        <p class="hint">A loyalty card unlocks that store's ad estimate and takes 5% off its store brands. Aldi, Walmart, and Publix have no shelf card in this model. Walmart+ is a delivery toggle further down.</p>
      </details>
    </section>
  `;
}

function winnerCard(origin, result) {
  const winner = result.winner;
  if (!winner) {
    return `
      <article class="winner" aria-live="polite">
        <p class="eyebrow">Piedmont Triad</p>
        <h2>No complete basket yet</h2>
        <p>${result.stores.length ? "Every chain is missing at least one item at the brand you picked. Switch those lines to store brand, or edit a shelf price." : "Add a few items and Shelfwise will rank the eight chains."}</p>
      </article>
    `;
  }
  const runnerGap = result.runnerUp ? result.runnerUp.allIn - winner.allIn : null;
  const priceGap = result.priciest && result.priciest.id !== winner.id ? result.priciest.allIn - winner.allIn : null;
  return `
    <article class="winner" aria-live="polite">
      <p class="eyebrow">Piedmont Triad · ${esc(MODE_LABEL[state.priority])}</p>
      <p class="kicker">Best bang for the buck from ${esc(origin.label)}</p>
      <h2>${esc(winner.name)}</h2>
      <p class="winner-total"><span class="sr-only">All-in total </span>${money(winner.allIn)}</p>
      <dl class="split3">
        <div><dt>Shelf</dt><dd>${money(winner.shelf)}</dd></div>
        <div><dt>Drive</dt><dd>${money(winner.drive)}</dd></div>
        <div><dt>Quality</dt><dd>${money(winner.quality)}</dd></div>
      </dl>
      <p class="why">${esc(whyText(origin, result))}</p>
      <div class="save-row">
        ${runnerGap != null ? `<p><strong>${money(runnerGap)}</strong> under ${esc(result.runnerUp.name)}</p>` : ""}
        ${priceGap != null ? `<p><strong>${money(priceGap)}</strong> under ${esc(result.priciest.name)}, the high end</p>` : ""}
      </div>
      <p class="hint hint-on-dark">About ${miles(winner.distance.oneWay)} miles one way to ${esc(winner.nearest.label)}, ${esc(winner.nearest.address)}, ${esc(winner.nearest.city)}. Straight line × ${winner.distance.factor.toFixed(2)}, round trip ${miles(winner.distance.roundTrip)} miles. Approximate. ${esc(gasSentence())}</p>
    </article>
  `;
}

function whyText(origin, result) {
  const winner = result.winner;
  const qualityBit = state.priority === "price"
    ? "Price only is on, so the quality adjustment is $0.00."
    : `Quality adjustment ${money(winner.quality)} from ${departmentPhrase(winner)}.`;
  const parts = [
    `${winner.name} leads from ${origin.label} at ${money(winner.allIn)} all-in: shelf ${money(winner.shelf)}, drive ${money(winner.drive)}, quality ${money(winner.quality)}.`,
    qualityBit,
  ];
  if (result.runnerUp) {
    const gap = result.runnerUp.allIn - winner.allIn;
    parts.push(`${result.runnerUp.name} is ${money(gap)} more all-in. ${deltaPhrase("Shelf", result.runnerUp.shelf - winner.shelf)}, ${deltaPhrase("drive", result.runnerUp.drive - winner.drive)}, and ${deltaPhrase("quality", result.runnerUp.quality - winner.quality)}.`);
  }
  if (result.priciest && result.priciest.id !== winner.id) {
    parts.push(`${result.priciest.name} is ${money(result.priciest.allIn - winner.allIn)} more all-in than the winner.`);
  }
  const used = [];
  if (winner.receiptCount) used.push(`${winner.receiptCount} from your receipts`);
  if (winner.communityCount) used.push(`${winner.communityCount} community price${winner.communityCount === 1 ? "" : "s"}`);
  if (winner.ads) used.push(`${winner.ads} ad estimate${winner.ads === 1 ? "" : "s"}`);
  if (winner.cards) used.push(`${winner.cards} store-brand card cut${winner.cards === 1 ? "" : "s"}`);
  if (winner.yours) used.push(`${winner.yours} price${winner.yours === 1 ? "" : "s"} you edited`);
  if (used.length) parts.push(`The shelf includes ${used.join(", ")}.`);
  return parts.join(" ");
}

function departmentPhrase(store) {
  return ["produce", "meat", "other"].map((key) => `${key} ${qualityWord(store.qualityScores[key])}`).join(", ");
}

function signed(value) {
  if (value > 0.004) return `+${money(value)}`;
  return money(value);
}

function deltaPhrase(label, value) {
  if (Math.abs(value) < 0.005) return `${label} is the same`;
  const direction = value > 0 ? "higher" : "lower";
  return `${label} is ${money(Math.abs(value))} ${direction}`;
}

function rankList(result) {
  const complete = result.stores.filter((store) => store.complete);
  const min = complete[0]?.allIn ?? 0;
  const max = complete[complete.length - 1]?.allIn ?? min;
  const span = max - min || 1;
  return `
    <section>
      <div class="section-head">
        <h2>Eight stores</h2>
        <p>Bar length shows how close the all-in total is to the winner. Tap a store to price the whole list there.</p>
      </div>
      <ol class="ranks">
        ${result.stores.map((store, index) => {
          const selected = (state.selectedStoreId || result.winner?.id) === store.id;
          const width = store.complete ? Math.round(8 + (1 - (store.allIn - min) / span) * 92) : 8;
          return `
            <li>
              <button type="button" class="rank-btn ${selected ? "is-selected" : ""} ${store.complete ? "" : "is-partial"}" data-action="select-store" data-store="${store.id}" aria-pressed="${selected}">
                <span class="rank-no">${index + 1}</span>
                <span class="rank-name">
                  <strong>${esc(store.name)}</strong>
                  <span>${store.complete ? `${esc(store.nearest.city)} · ${miles(store.distance.oneWay)} mi one way` : `Missing ${store.missing.length} item${store.missing.length === 1 ? "" : "s"}`}</span>
                </span>
                <span class="rank-money">${store.complete ? money(store.allIn) : "Partial"}</span>
                <span class="rank-meta">Shelf ${money(store.shelf)} · Drive ${money(store.drive)} · Quality ${money(store.quality)}</span>
                <span class="bar ${index === 0 && store.complete ? "bar-lead" : ""}" aria-hidden="true"><span style="width:${width}%"></span></span>
              </button>
            </li>
          `;
        }).join("")}
      </ol>
    </section>
  `;
}

function splitCard(result) {
  const split = result.split;
  if (!result.winner) return "";
  if (!split) {
    return `<section class="card"><h2>Split trip</h2><p>No pair of these chains covers the list as two stops.</p></section>`;
  }
  const pairName = split.names.join(" + ");
  const lead = split.worthIt
    ? `A second stop is worth it. ${pairName} beats ${result.winner.name} by ${money(split.net)} all-in.`
    : split.net > 0
      ? `${pairName} is only ${money(split.net)} cheaper all-in than ${result.winner.name}, under the ${money(SPLIT_MIN_SAVE)} line for a second stop.`
      : `One stop is the better deal. ${pairName} is ${money(-split.net)} more all-in than ${result.winner.name}.`;
  return `
    <section class="card">
      <h2>Split trip</h2>
      <p>${esc(lead)}</p>
      <dl class="split3">
        <div><dt>Shelf change</dt><dd>${signed(-split.shelfSave)}</dd></div>
        <div><dt>Extra drive</dt><dd>${signed(split.extraDrive)}</dd></div>
        <div><dt>Quality change</dt><dd>${signed(split.qualityDelta)}</dd></div>
      </dl>
      <p class="hint">Shelf change is the pair's shelf minus ${esc(result.winner.name)}. Extra drive is two round trips instead of one. Quality change uses the same ${esc(MODE_LABEL[state.priority].toLowerCase())} weight. Net ${money(split.net)}.</p>
      <div class="split-groups">
        ${split.groups.map((group) => `
          <div>
            <h3>${esc(group.name)}</h3>
            <p class="hint">${esc(group.nearest.city)} · about ${miles(group.distance.roundTrip)} mi round trip</p>
            <ul>${group.items.map((item) => `<li>${item.qty} × ${esc(item.name)}</li>`).join("")}</ul>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function detailCard(origin, result) {
  const store = result.stores.find((entry) => entry.id === state.selectedStoreId) || result.winner || result.stores[0];
  if (!store) return "";
  const showWinner = state.selectedStoreId && result.winner && state.selectedStoreId !== result.winner.id;
  return `
    <section class="card" id="store-list">
      <div class="section-head">
        <h2>Priced at ${esc(store.name)}</h2>
        <p>${store.complete ? "Every line at the brand you picked." : "This chain does not sell every chosen brand. The total below skips the missing lines."}</p>
      </div>
      <p class="place-line">Nearest: ${esc(store.nearest.label)}, ${esc(store.nearest.address)}, ${esc(store.nearest.city)}. About ${miles(store.distance.oneWay)} miles one way from ${esc(origin.label)}, ${miles(store.distance.roundTrip)} round trip. ${esc(driveSentence())}</p>
      ${showWinner ? `<button type="button" class="button button-quiet" data-action="show-winner">Show the winner, ${esc(result.winner.name)}</button>` : ""}
      ${store.missing.length ? `
        <div class="callout">
          <p>Not sold at this brand: ${store.missing.map((item) => `${esc(item.name)} (${esc(tierLabel(item.tier).toLowerCase())})`).join(", ")}.</p>
          <button type="button" class="button" data-action="fill-store-brand">Use store brand for missing items</button>
        </div>
      ` : ""}
      <ul class="lines">
        ${store.priced.map((row) => {
          const entry = itemById[row.itemId];
          return `
            <li>
              <span>
                <strong>${row.qty} × ${esc(row.name)}</strong>
                <span class="hint">${esc(packageSize(entry, row.tier))} · ${esc(tierLabel(row.tier))} · ${esc(brandLabel(entry, store.id, row.tier))}</span>
              </span>
              <span class="line-price">
                <span class="tag tag-${row.source}">${esc(sourceDetail(row.source, row.asOf, row.n))}</span>
                ${money(row.unit)} <span class="hint">→ ${money(row.lineShelf)}</span>
              </span>
            </li>
          `;
        }).join("")}
      </ul>
      <dl class="split3">
        ${["produce", "meat", "other"].map((key) => `
          <div>
            <dt>${key[0].toUpperCase()}${key.slice(1)} · ${esc(qualityWord(store.qualityScores[key]))}</dt>
            <dd>${money(store.departments[key].shelf)} <span class="hint">quality ${money(store.departments[key].quality)}</span></dd>
          </div>
        `).join("")}
      </dl>
      <p class="hint">${esc(store.qualityNote)} Each quality point moves ${(QUALITY_RATE * 100).toFixed(0)}% of that department's shelf dollars on Balanced, and double that on Quality first.</p>
      <div class="button-row">
        <button type="button" class="button" data-action="instacart">Send list to Instacart</button>
        <button type="button" class="button" data-action="download">Download list</button>
        <button type="button" class="button" data-action="share">Copy share link</button>
        <button type="button" class="button button-quiet" data-action="print">Print</button>
        <button type="button" class="button button-quiet" data-action="doordash">DoorDash search</button>
        <button type="button" class="button button-quiet" data-action="ubereats">Uber Eats search</button>
      </div>
      <p class="hint">Send list to Instacart opens a shopping list when the worker has an Instacart key. Otherwise it copies this list and opens Instacart search. DoorDash and Uber Eats cannot take a cart from outside their apps, so those buttons copy the list and open search.</p>
    </section>
  `;
}

function driveSentence() {
  if (state.drive.mode === "perMile") {
    return `Fuel-only estimate at ${money(Number(state.drive.perMile))} per mile.`;
  }
  const gas = gasNow();
  return `Fuel estimate at ${Number(state.drive.mpg)} mpg and ${money(gas.price, 3)}/gal.`;
}

function gasSentence() {
  const gas = gasNow();
  if (gas.source === "pump") return `Drive uses your pump price, ${money(gas.price, 3)}/gal.`;
  return `Drive uses ${money(gas.price, 3)}/gal, EIA week of ${prettyDate(gas.period)}.`;
}

function listCard() {
  const presetId = matchingPreset();
  return `
    <section class="card" id="your-list">
      <div class="section-head">
        <h2>Your list</h2>
        <p>${presetId === "custom" ? "Custom list." : esc(presetById[presetId].blurb)} Switching a preset replaces these lines.</p>
      </div>
      <div class="chips" role="group" aria-label="Preset lists">
        ${presets.map((preset) => `
          <button type="button" class="chip ${presetId === preset.id ? "is-on" : ""}" data-action="preset" data-preset="${preset.id}" aria-pressed="${presetId === preset.id}">${esc(preset.name)}</button>
        `).join("")}
      </div>
      <ul class="edit-lines">
        ${state.lines.map((line, index) => {
          const entry = itemById[line.itemId];
          return `
            <li>
              <div>
                <strong>${esc(entry.name)}</strong>
                <span class="hint">${esc(packageSize(entry, line.tier))}</span>
              </div>
              <label class="qty">
                <span class="sr-only">Quantity of ${esc(entry.name)}</span>
                <button type="button" data-action="qty" data-index="${index}" data-dir="-1" aria-label="Decrease ${esc(entry.name)}">−</button>
                <input id="qty-${index}" inputmode="numeric" value="${line.qty}" data-action="qty-input" data-index="${index}">
                <button type="button" data-action="qty" data-index="${index}" data-dir="1" aria-label="Increase ${esc(entry.name)}">+</button>
              </label>
              <label class="field field-compact">
                <span class="sr-only">Brand tier for ${esc(entry.name)}</span>
                <select data-action="tier" data-index="${index}">
                  ${["store", "name", "premium"].map((tier) => `<option value="${tier}" ${line.tier === tier ? "selected" : ""}>${tierLabel(tier)}</option>`).join("")}
                </select>
              </label>
              <button type="button" class="text-button" data-action="remove" data-index="${index}">Remove</button>
            </li>
          `;
        }).join("")}
      </ul>
      ${catalogBlock()}
    </section>
  `;
}

function catalogBlock() {
  const query = state.catalogQuery.trim().toLowerCase();
  const matches = items.filter((entry) => {
    if (state.catalogAisle && entry.aisle !== state.catalogAisle) return false;
    if (state.catalogBrand) {
      const brand = state.catalogBrand.toLowerCase();
      const hay = [entry.brands.name, entry.brands.premium, ...entry.tags].join(" ").toLowerCase();
      if (!hay.includes(brand)) return false;
    }
    if (!query) return Boolean(state.catalogAisle || state.catalogBrand);
    const blob = `${entry.name} ${entry.size} ${entry.brands.name} ${entry.brands.premium} ${entry.tags.join(" ")}`.toLowerCase();
    return blob.includes(query);
  }).slice(0, 24);
  return `
    <div class="catalog">
      <h3>Add from the catalog</h3>
      <label class="field">
        <span>Search items or brands</span>
        <input id="catalog-search" type="search" value="${esc(state.catalogQuery)}" data-action="search" placeholder="Cheerios, chicken, Tide">
      </label>
      <div class="chips" role="group" aria-label="Brand filter">
        <button type="button" class="chip ${state.catalogBrand === "" ? "is-on" : ""}" data-action="brand" data-brand="">Any brand</button>
        ${FEATURED.map((brand) => `
          <button type="button" class="chip ${state.catalogBrand === brand ? "is-on" : ""}" data-action="brand" data-brand="${esc(brand)}">${esc(brand)}</button>
        `).join("")}
      </div>
      <div class="toolbar-row">
        <label class="field">
          <span>Aisle</span>
          <select id="catalog-aisle" data-action="aisle">
            <option value="">All aisles</option>
            ${aisles.map((aisle) => `<option value="${esc(aisle)}" ${state.catalogAisle === aisle ? "selected" : ""}>${esc(aisle)}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>More brands</span>
          <select id="catalog-brand" data-action="brand-select">
            <option value="">Pick a brand</option>
            ${brandOptions().map((brand) => `<option value="${esc(brand)}" ${state.catalogBrand === brand ? "selected" : ""}>${esc(brand)}</option>`).join("")}
          </select>
        </label>
      </div>
      ${matches.length ? `
        <ul class="catalog-list">
          ${matches.map((entry) => `
            <li>
              <span><strong>${esc(entry.name)}</strong> <span class="hint">${esc(entry.aisle)} · ${esc(entry.size)}${entry.brands.name ? ` · ${esc(entry.brands.name)}` : ""}</span></span>
              <button type="button" class="button" data-action="add" data-item="${entry.id}">Add</button>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="hint">Search, or choose a brand or aisle. Produce, meat, frozen, pantry, and household are all in the catalog.</p>`}
    </div>
  `;
}

function editorCard(result) {
  const editorId = state.editorStoreId || state.selectedStoreId || result.winner?.id || "aldi";
  const chain = chainById[editorId] || chainById.aldi;
  const rowSpecs = state.editorAll
    ? items.flatMap((entry) => ["store", "name", "premium"].map((tier) => [entry, tier]))
    : state.lines.map((line) => [itemById[line.itemId], line.tier]);
  const edited = countOverrides(editorId);
  return `
    <section class="card" id="shelf-prices">
      <div class="section-head">
        <h2>Every shelf price</h2>
        <p>Type over any price at ${esc(chain.name)}. A typed price replaces your receipt and the community price for that line. A blank field keeps the receipt, community price, or estimate.</p>
      </div>
      <div class="toolbar-row">
        <label class="field">
          <span>Store to edit</span>
          <select id="editor-store" data-action="editor-store">
            ${chains.map((entry) => `<option value="${entry.id}" ${entry.id === chain.id ? "selected" : ""}>${esc(entry.name)}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="button" data-action="reset-store" data-store="${chain.id}">Use estimates again</button>
      </div>
      <label class="check">
        <input type="checkbox" data-action="editor-all" ${state.editorAll ? "checked" : ""}>
        Show the whole catalog, not just this list
      </label>
      <p class="hint">${edited ? `${edited} typed price${edited === 1 ? "" : "s"} saved on this device for ${esc(chain.name)}.` : "No typed prices for this store yet."} Use estimates again also clears receipt prices for this store. Community prices stay.</p>
      <div class="price-table" role="table" aria-label="Shelf prices at ${esc(chain.name)}">
        <div class="price-row price-head" role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Using</span>
          <span role="columnheader">Typed price</span>
        </div>
        ${rowSpecs.map(([entry, tier]) => priceRow(chain.id, entry, tier)).join("")}
      </div>
    </section>
  `;
}

function priceRow(storeId, entry, tier) {
  const model = quoteUnit(entry.id, storeId, tier, {
    weeklyAds: state.weeklyAds,
    loyalty: state.loyalty,
    overrides: {},
    receipts: state.receipts,
    community: state.communityRows,
    townId: state.townId,
    today: localToday(),
  });
  const yours = state.overrides?.[storeId]?.[entry.id]?.[tier];
  const inputId = `px-${storeId}-${entry.id}-${tier}`;
  return `
    <div class="price-row" role="row">
      <span role="cell">
        <strong>${esc(entry.name)}</strong>
        <span class="hint">${esc(tierLabel(tier))} · ${esc(brandLabel(entry, storeId, tier))} · ${esc(packageSize(entry, tier))}</span>
      </span>
      <span role="cell">${model ? `${money(model.price)} <span class="tag tag-${model.source}">${esc(sourceDetail(model.source, model.asOf, model.n))}</span>` : "Not carried"}</span>
      <span role="cell">
        <label class="sr-only" for="${inputId}">Your price for ${esc(entry.name)}, ${esc(tierLabel(tier))}, at this store</label>
        <input id="${inputId}" inputmode="decimal" data-action="override" data-store="${storeId}" data-item="${entry.id}" data-tier="${tier}" value="${yours != null ? yours : ""}">
      </span>
    </div>
  `;
}

function feeCard(result) {
  const store = result.stores.find((entry) => entry.id === state.selectedStoreId) || result.winner || result.stores[0];
  if (!store) return "";
  const rows = deliveryRows(chainById[store.id], store.shelf, state.memberships, state.tip);
  return `
    <section class="card" id="delivery">
      <div class="section-head">
        <h2>Pickup and delivery</h2>
        <p>For the ${esc(store.name)} shelf of ${money(store.shelf)}. ${esc(FEE_NOTE)}</p>
      </div>
      <fieldset class="segment">
        <legend>Tip on the fee estimate</legend>
        ${[["none", "No tip"], ["flat5", "$5"], ["pct10", "10%"]].map(([value, label]) => `
          <label class="${state.tip === value ? "is-on" : ""}">
            <input type="radio" name="tip" value="${value}" ${state.tip === value ? "checked" : ""} data-action="tip">
            ${label}
          </label>
        `).join("")}
      </fieldset>
      <div class="checks">
        ${MEMBERSHIPS.map((member) => `
          <label class="check">
            <input type="checkbox" data-action="member" data-member="${member.id}" ${state.memberships[member.id] ? "checked" : ""}>
            ${esc(member.name)}
          </label>
        `).join("")}
      </div>
      <p class="hint">The Shipt toggle also covers the Target Circle 360 same-day fee estimate ($99 a year, or $49 with a Target Circle Card).</p>
      <div class="fee-list">
        ${rows.map((row) => `
          <article class="fee ${row.available ? "" : "is-off"}">
            <header>
              <h3>${esc(row.name)}</h3>
              ${row.available && !row.everywhere ? `<span class="tag">Not everywhere in the Triad</span>` : ""}
              ${!row.available ? `<span class="tag">Not offered here</span>` : ""}
            </header>
            ${row.available ? `
              <dl>
                <div><dt>Food</dt><dd>${money(row.food)}</dd></div>
                <div><dt>App markup</dt><dd>${money(row.markup)}</dd></div>
                <div><dt>Delivery or pickup</dt><dd>${money(row.fee)}</dd></div>
                <div><dt>Service fee</dt><dd>${money(row.service)}</dd></div>
                <div><dt>Tip</dt><dd>${money(row.tip)}</dd></div>
                <div><dt>Total</dt><dd>${money(row.total)}</dd></div>
              </dl>
            ` : ""}
            <p class="hint">${row.available ? `Estimate · reviewed ${esc(row.asOfLabel || "")}. ` : ""}${esc(row.note)}</p>
            ${row.sourceUrl ? `<p class="hint"><a class="source-link" href="${esc(row.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(row.sourceLabel || "Source")}</a></p>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function driveCard() {
  const perMile = state.drive.mode === "perMile";
  const gas = gasNow();
  const usingPump = gas.source === "pump";
  const published = effectiveGas({ live: state.liveGas });
  const sourceBits = [
    published.region,
    published.product,
    published.live ? "latest from the EIA API" : "bundled weekly price",
    published.released ? `released ${prettyDate(published.released)}` : "",
  ].filter(Boolean);
  return `
    <section class="card" id="drive">
      <div class="section-head">
        <h2>Gas and the drive</h2>
        <p>Distance is straight-line miles times a road factor, then a round trip. EIA has no Greensboro weekly series, so this is Lower Atlantic regular.</p>
      </div>
      <p class="gas-hero">${money(published.price, 3)} <span>/ gal</span></p>
      <p>Week of ${esc(prettyDate(published.period) || published.label)}. ${esc(sourceBits.join(" · "))}.</p>
      ${published.sourceUrl ? `<p class="hint"><a class="source-link" href="${esc(published.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(published.sourceName)}</a></p>` : ""}
      <p class="hint">${esc(gasStatusLine(published))}</p>
      ${gasNote ? `<p class="hint hint-warn">${esc(gasNote)}</p>` : ""}
      <label class="field">Price I paid at the pump
        <input id="pump-price" inputmode="decimal" placeholder="Optional" value="${state.drive.pumpPrice ?? ""}" data-action="pump" ${perMile ? "disabled" : ""}>
      </label>
      <div class="button-row">
        ${state.drive.pumpPrice != null ? `<button type="button" class="button button-quiet" data-action="clear-pump">Use the EIA price</button>` : ""}
      </div>
      <p class="hint">${usingPump
        ? `Drive math is using your pump price, ${money(gas.price, 3)}/gal, instead of the EIA week.`
        : "Leave this blank to drive the miles with the EIA price above."}</p>
      <fieldset class="segment">
        <legend>Fuel math</legend>
        <label class="${!perMile ? "is-on" : ""}">
          <input type="radio" name="drive-mode" value="mpg" ${!perMile ? "checked" : ""} data-action="drive-mode">
          MPG and gas price
        </label>
        <label class="${perMile ? "is-on" : ""}">
          <input type="radio" name="drive-mode" value="perMile" ${perMile ? "checked" : ""} data-action="drive-mode">
          Fuel only, per mile
        </label>
      </fieldset>
      <div class="drive-grid">
        <label class="field">Road factor
          <input id="drive-factor" inputmode="decimal" value="${state.drive.roadFactor}" data-action="drive" data-field="roadFactor">
        </label>
        <label class="field">Miles per gallon
          <input id="drive-mpg" inputmode="decimal" value="${state.drive.mpg}" data-action="drive" data-field="mpg" ${perMile ? "disabled" : ""}>
        </label>
        <label class="field">$ per mile
          <input id="drive-mile" inputmode="decimal" value="${state.drive.perMile}" data-action="drive" data-field="perMile" ${perMile ? "" : "disabled"}>
        </label>
      </div>
      <p class="hint">The default $ per mile is ${money(GAS_FALLBACK.price, 3)} ÷ 26 mpg. Time behind the wheel is not priced.</p>
    </section>
    <footer class="site-foot">
      <p>Shelfwise compares Aldi, Lidl, Walmart, Food Lion, Harris Teeter, Lowes Foods, Target, and Publix on this phone. Shelf prices are estimates, your receipts, or community medians. No store site is scraped.</p>
    </footer>
  `;
}

function gasStatusLine(published) {
  if (!backendConfigured()) return "No price service is configured. This is the bundled EIA week, saved in the app.";
  if (published.live && state.liveGas?.stale) return "The price service last saved this EIA week. A fresh pull did not arrive.";
  if (published.live) return state.liveGas?.fetchedAt ? `Fetched ${state.liveGas.fetchedAt.slice(0, 16).replace("T", " ")} UTC.` : "Fetched from the EIA API.";
  return "The price service has not returned a newer week yet. Showing the bundled EIA price.";
}

function installCard() {
  if (state.installDismissed || isStandalone()) return "";
  const ios = isIosSafari();
  const canPrompt = Boolean(installEvent);
  return `
    <div class="install-wrap">
      <section class="install" id="install">
        <div>
          <h2>Add Shelfwise to your home screen</h2>
          <p>${ios
            ? "In Safari, tap the Share button, then Add to Home Screen. The list and last prices stay on the phone."
            : canPrompt
              ? "Install it like an app. The list and last prices work offline."
              : "On iPhone, open this page in Safari and use Share, then Add to Home Screen. On Android Chrome, use the browser menu and choose Install app or Add to Home screen."}</p>
        </div>
        <div class="button-row">
          ${canPrompt ? `<button type="button" class="button" data-action="install">Install</button>` : ""}
          <button type="button" class="button button-quiet" data-action="dismiss-install">Not now</button>
        </div>
      </section>
    </div>
  `;
}

function receiptCard() {
  const reading = draft?.phase === "reading";
  const review = draft?.phase === "review";
  return `
    <section class="card" id="receipt">
      <div class="section-head">
        <h2>Scan a receipt</h2>
        <p>The photo is read on this phone and is not uploaded. You check every line before it changes a price.</p>
      </div>
      <div class="button-row">
        <label class="button file-button">Take a photo
          <input class="sr-only" type="file" accept="image/*" capture="environment" data-action="receipt-file">
        </label>
        <label class="button button-quiet file-button">Upload a photo
          <input class="sr-only" type="file" accept="image/*" data-action="receipt-file">
        </label>
      </div>
      <label class="field">Or paste receipt text
        <textarea id="receipt-paste" rows="4" data-action="receipt-paste">${esc(receiptPaste)}</textarea>
      </label>
      <button type="button" class="button button-quiet" data-action="receipt-paste-go">Read pasted text</button>
      ${reading ? `<p class="status-line" role="status">${esc(draft.message || "Reading the receipt…")}</p>` : ""}
      ${draft?.previewUrl ? `<img class="receipt-preview" alt="Receipt photo, kept on this phone" src="${esc(draft.previewUrl)}">` : ""}
      ${draft?.phase === "error" ? `<p class="hint hint-warn">${esc(draft.message)}</p>` : ""}
      ${review ? receiptReview() : ""}
    </section>
  `;
}

function receiptReview() {
  const shareReady = backendConfigured();
  return `
    <div class="toolbar-row">
      <label class="field">Store on the receipt
        <select id="receipt-store" data-action="receipt-store">
          <option value="">Choose a store</option>
          ${chains.map((chain) => `<option value="${chain.id}" ${draft.storeId === chain.id ? "selected" : ""}>${esc(chain.name)}</option>`).join("")}
        </select>
      </label>
      <label class="field">Receipt date
        <input id="receipt-date" type="date" value="${esc(draft.date)}" data-action="receipt-date">
      </label>
      <label class="field">Town for the community pool
        <select id="receipt-town" data-action="receipt-town">
          ${towns.map((town) => `<option value="${town.id}" ${draft.townId === town.id ? "selected" : ""}>${esc(town.name)}</option>`).join("")}
        </select>
      </label>
    </div>
    <p class="hint">Check that the price is for one package, not a multi-quantity line total. Uncheck anything that is not a Shelfwise item.</p>
    <div>
      ${draft.rows.map((row, index) => `
        <div class="receipt-row ${row.include ? "" : "is-skipped"}">
          <label class="check">
            <input type="checkbox" data-action="receipt-include" data-index="${index}" ${row.include ? "checked" : ""}>
            Use this line
          </label>
          <p class="hint">${esc(row.raw)}</p>
          <label class="field">Shelfwise item
            <select data-action="receipt-item" data-index="${index}">
              <option value="">Not a Shelfwise item</option>
              ${items.map((entry) => `<option value="${entry.id}" ${row.itemId === entry.id ? "selected" : ""}>${esc(entry.name)}</option>`).join("")}
            </select>
          </label>
          <div class="toolbar-row">
            <label class="field">Brand tier
              <select data-action="receipt-tier" data-index="${index}">
                ${["store", "name", "premium"].map((tier) => `<option value="${tier}" ${row.tier === tier ? "selected" : ""}>${tierLabel(tier)}</option>`).join("")}
              </select>
            </label>
            <label class="field">Price
              <input id="receipt-price-${index}" inputmode="decimal" data-action="receipt-price" data-index="${index}" value="${row.price}">
            </label>
          </div>
        </div>
      `).join("")}
    </div>
    <label class="check">
      <input type="checkbox" data-action="receipt-share" ${draft.share ? "checked" : ""} ${shareReady ? "" : "disabled"}>
      Share these prices with the Shelfwise community
    </label>
    <p class="hint">${shareReady
      ? "Optional. This sends the store, item, price, date, and town only. No photo, no name, no account."
      : "Community sharing needs the price service. Prices you confirm still save on this phone."}</p>
    <div class="button-row">
      <button type="button" class="button" data-action="receipt-save">Save checked prices</button>
      <button type="button" class="button button-quiet" data-action="receipt-cancel">Discard</button>
    </div>
  `;
}

function matchingPreset() {
  for (const preset of presets) {
    if (preset.lines.length !== state.lines.length) continue;
    const same = preset.lines.every((line, index) => {
      const current = state.lines[index];
      return current && current.itemId === line.itemId && current.qty === line.qty && current.tier === line.tier;
    });
    if (same) return preset.id;
  }
  return "custom";
}

function countOverrides(storeId) {
  const bucket = state.overrides[storeId] || {};
  let count = 0;
  for (const tiers of Object.values(bucket)) count += Object.keys(tiers).length;
  return count;
}

function addTier(entry) {
  const brand = state.catalogBrand.trim().toLowerCase();
  if (!brand) return entry.defaultTier || "store";
  if ((entry.brands.name || "").toLowerCase() === brand) return "name";
  if ((entry.brands.premium || "").toLowerCase() === brand) return "premium";
  if ((entry.brands.name || "").toLowerCase().includes(brand)) return "name";
  if ((entry.brands.premium || "").toLowerCase().includes(brand)) return "premium";
  return "store";
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.tagName === "INPUT" || button.tagName === "SELECT") return;
  const action = button.dataset.action;
  if (action === "select-store") {
    state.selectedStoreId = button.dataset.store;
    persist();
    render();
  } else if (action === "show-winner") {
    state.selectedStoreId = null;
    persist();
    render();
  } else if (action === "preset") {
    state.lines = cloneLines(presetById[button.dataset.preset].lines);
    state.selectedStoreId = null;
    persist();
    render();
  } else if (action === "qty") {
    const index = Number(button.dataset.index);
    const line = state.lines[index];
    if (!line) return;
    line.qty = Math.min(99, Math.max(1, line.qty + Number(button.dataset.dir)));
    persist();
    render();
  } else if (action === "remove") {
    state.lines.splice(Number(button.dataset.index), 1);
    persist();
    render();
  } else if (action === "add") {
    const entry = itemById[button.dataset.item];
    const tier = addTier(entry);
    const existing = state.lines.find((line) => line.itemId === entry.id && line.tier === tier);
    if (existing) existing.qty = Math.min(99, existing.qty + 1);
    else state.lines.push({ itemId: entry.id, qty: 1, tier });
    persist();
    render();
  } else if (action === "brand") {
    state.catalogBrand = button.dataset.brand || "";
    render();
  } else if (action === "reset-store") {
    delete state.overrides[button.dataset.store];
    delete state.receipts[button.dataset.store];
    persist();
    render();
    toast(`Typed and receipt prices cleared for ${chainById[button.dataset.store].name}.`);
  } else if (action === "locate") {
    locate();
  } else if (action === "forget-geo") {
    state.geo = null;
    state.geoError = "";
    persist();
    render();
  } else if (action === "fill-store-brand") {
    const origin = currentOrigin();
    const result = scoreTrip(tripOptions(origin));
    const store = result.stores.find((entry) => entry.id === (state.selectedStoreId || result.winner?.id));
    if (!store) return;
    for (const missing of store.missing) {
      const line = state.lines.find((entry) => entry.itemId === missing.itemId && entry.tier === missing.tier);
      if (line) line.tier = "store";
    }
    persist();
    render();
  } else if (action === "download") {
    downloadList();
  } else if (action === "share") {
    shareList();
  } else if (action === "print") {
    window.print();
  } else if (action === "doordash") {
    openService("https://www.doordash.com/search?query=grocery", "List copied. DoorDash search is open. Paste the list there.");
  } else if (action === "ubereats") {
    openService("https://www.ubereats.com/search?q=grocery", "List copied. Uber Eats search is open. Paste the list there.");
  } else if (action === "instacart") {
    sendInstacart();
  } else if (action === "install") {
    promptInstall();
  } else if (action === "dismiss-install") {
    state.installDismissed = true;
    persist();
    render();
  } else if (action === "clear-pump") {
    state.drive.pumpPrice = null;
    persist();
    render();
  } else if (action === "receipt-paste-go") {
    openReview(receiptPaste);
  } else if (action === "receipt-cancel") {
    clearDraft();
    render();
  } else if (action === "receipt-save") {
    saveReceipt();
  }
}

function onChange(event) {
  const input = event.target;
  const action = input.dataset.action;
  if (action === "town") {
    if (input.value) {
      state.townId = input.value;
      state.geo = null;
      state.geoError = "";
    }
    persist();
    render();
  } else if (action === "priority") {
    state.priority = input.value;
    persist();
    render();
  } else if (action === "ads") {
    state.weeklyAds = input.checked;
    persist();
    render();
  } else if (action === "loyalty") {
    state.loyalty[input.dataset.store] = input.checked;
    persist();
    render();
  } else if (action === "tier") {
    state.lines[Number(input.dataset.index)].tier = input.value;
    persist();
    render();
  } else if (action === "aisle") {
    state.catalogAisle = input.value;
    render();
  } else if (action === "brand-select") {
    state.catalogBrand = input.value;
    render();
  } else if (action === "editor-store") {
    state.editorStoreId = input.value;
    persist();
    render();
  } else if (action === "editor-all") {
    state.editorAll = input.checked;
    persist();
    render();
  } else if (action === "tip") {
    state.tip = input.value;
    persist();
    render();
  } else if (action === "member") {
    state.memberships[input.dataset.member] = input.checked;
    persist();
    render();
  } else if (action === "drive-mode") {
    state.drive.mode = input.value;
    persist();
    render();
  } else if (action === "override" || action === "drive" || action === "qty-input" || action === "pump") {
    commitField(input);
    persist();
    render();
  } else if (action === "receipt-store") {
    if (draft) draft.storeId = input.value;
    render();
  } else if (action === "receipt-date") {
    if (draft) draft.date = input.value;
    render();
  } else if (action === "receipt-town") {
    if (draft) draft.townId = input.value;
    render();
  } else if (action === "receipt-include") {
    const row = draft?.rows[Number(input.dataset.index)];
    if (row) row.include = input.checked;
    render();
  } else if (action === "receipt-item") {
    const row = draft?.rows[Number(input.dataset.index)];
    if (row) {
      row.itemId = input.value;
      row.include = Boolean(input.value);
    }
    render();
  } else if (action === "receipt-tier") {
    const row = draft?.rows[Number(input.dataset.index)];
    if (row) row.tier = input.value;
    render();
  } else if (action === "receipt-share") {
    if (draft) draft.share = input.checked;
  } else if (action === "receipt-file") {
    const file = input.files?.[0];
    input.value = "";
    if (file) readPhoto(file);
  } else if (action === "receipt-price") {
    commitReceiptPrice(input);
  }
}

function onInput(event) {
  const input = event.target;
  const action = input.dataset.action;
  if (action === "search") {
    state.catalogQuery = input.value;
    scheduleRender();
    return;
  }
  if (action === "receipt-paste") {
    receiptPaste = input.value;
    return;
  }
  if (action === "receipt-price") {
    if (isPartialNumber(input.value)) return;
    commitReceiptPrice(input);
    return;
  }
  if (action === "override" || action === "drive" || action === "qty-input" || action === "pump") {
    if (isPartialNumber(input.value)) return;
    if (commitField(input)) scheduleRender();
  }
}

function isPartialNumber(raw) {
  return /^\d+\.$/.test(raw.trim()) || raw.trim() === ".";
}

function commitField(input) {
  const raw = input.value.trim();
  if (input.dataset.action === "qty-input") {
    const qty = Number(raw);
    if (!Number.isFinite(qty)) return false;
    state.lines[Number(input.dataset.index)].qty = Math.min(99, Math.max(1, Math.round(qty)));
    return true;
  }
  if (input.dataset.action === "pump") {
    if (raw === "") {
      state.drive.pumpPrice = null;
      return true;
    }
    if (!/^\d+(\.\d{1,3})?$/.test(raw)) return false;
    state.drive.pumpPrice = Math.min(20, Math.max(0, Math.round(Number(raw) * 1000) / 1000));
    return true;
  }
  const decimals = input.dataset.action === "drive" ? 3 : 2;
  const pattern = decimals === 3 ? /^\d+(\.\d{1,3})?$/ : /^\d+(\.\d{1,2})?$/;
  if (raw !== "" && !pattern.test(raw)) return false;
  if (input.dataset.action === "drive") {
    if (raw === "") return false;
    const value = Number(raw);
    const field = input.dataset.field;
    const limits = { mpg: [5, 100], gasPrice: [0, 20], roadFactor: [1, 2.5], perMile: [0, 5] };
    const [min, max] = limits[field];
    state.drive[field] = Math.min(max, Math.max(min, value));
    return true;
  }
  const { store, item, tier } = input.dataset;
  state.overrides[store] ||= {};
  state.overrides[store][item] ||= {};
  if (raw === "") delete state.overrides[store][item][tier];
  else state.overrides[store][item][tier] = Number(raw);
  if (!Object.keys(state.overrides[store][item]).length) delete state.overrides[store][item];
  if (!Object.keys(state.overrides[store]).length) delete state.overrides[store];
  return true;
}

function activeStore(result) {
  return result.stores.find((entry) => entry.id === state.selectedStoreId) || result.winner || result.stores[0];
}

function currentListText() {
  const origin = currentOrigin();
  const result = scoreTrip(tripOptions(origin));
  const store = activeStore(result);
  return listText({ lines: state.lines, store, placeLabel: origin.label });
}

function downloadList() {
  const blob = new Blob([currentListText()], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "shelfwise-list.txt";
  link.click();
  URL.revokeObjectURL(link.href);
  toast("List downloaded as text.");
}

async function shareList() {
  const hash = `#s=${encodeShare(state)}`;
  history.replaceState(null, "", hash);
  const url = `${location.origin}${location.pathname}${location.search}${hash}`;
  const ok = await copyText(url);
  toast(ok
    ? "Share link copied. Edited shelf prices stay on this device and are not in the link."
    : "Couldn't copy the link. It is in the address bar.");
}

async function openService(url, message) {
  window.open(url, "_blank", "noopener,noreferrer");
  const ok = await copyText(currentListText());
  toast(ok ? message : "The search is open. Copy the list from the downloaded text if the clipboard was blocked.");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function locate() {
  if (!navigator.geolocation) {
    state.geoError = "This browser can't share a location. Pick a town instead.";
    render();
    return;
  }
  state.geoError = "Asking the browser for a location…";
  render();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.geo = { lat: position.coords.latitude, lng: position.coords.longitude };
      state.geoError = "";
      persist();
      render();
      toast("Location saved on this device only.");
    },
    () => {
      state.geoError = "Location permission was denied or unavailable. Pick a town instead.";
      render();
    },
    { enableHighAccuracy: false, maximumAge: 600000, timeout: 8000 },
  );
}

async function refreshRemote() {
  if (!backendConfigured()) return;
  try {
    const health = await fetchHealth();
    services.instacart = Boolean(health.instacart);
    services.gas = Boolean(health.gas);
    services.pool = Boolean(health.pool);
  } catch {
    services.instacart = false;
    gasNote = "The price service didn't answer. Showing the saved EIA price.";
  }
  if (services.gas !== false) {
    try {
      const gas = await fetchGas();
      if (Number.isFinite(Number(gas?.price)) && gas.period) {
        state.liveGas = {
          price: Number(gas.price),
          period: gas.period,
          label: gas.label || "",
          region: gas.region || "",
          product: gas.product || "",
          sourceName: gas.sourceName || "",
          sourceUrl: gas.sourceUrl || "",
          series: gas.series || "",
          fetchedAt: gas.fetchedAt || "",
          stale: Boolean(gas.stale),
          released: gas.released || "",
        };
        gasNote = gas.stale ? "The EIA pull failed. Showing the last week the price service saved." : "";
        persist();
      }
    } catch {
      gasNote = "The EIA price didn't load. Showing the newest saved weekly price.";
    }
  }
  if (services.pool !== false) {
    try {
      const pool = await fetchPrices();
      if (Array.isArray(pool.prices)) {
        state.communityRows = pool.prices;
        persist();
      }
    } catch {
      /* Keep the last community rows saved on this phone. */
    }
  }
  render();
}

async function promptInstall() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  state.installDismissed = true;
  persist();
  render();
}

function clearDraft() {
  if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  draft = null;
}

function openReview(text, previewUrl = "") {
  const previous = draft?.previewUrl || "";
  if (previous && previous !== previewUrl) URL.revokeObjectURL(previous);
  const parsed = parseReceiptText(text);
  if (!parsed.rows.length) {
    draft = { phase: "error", message: "No prices were found. Try a clearer photo, or paste the receipt text.", previewUrl };
    render();
    return;
  }
  draft = {
    phase: "review",
    message: "",
    previewUrl,
    storeId: parsed.storeId,
    date: parsed.date || localToday(),
    townId: state.townId,
    share: false,
    rows: parsed.rows.map((row) => ({ ...row })),
  };
  render();
  document.getElementById("receipt")?.scrollIntoView({ block: "start" });
}

async function readPhoto(file) {
  clearDraft();
  const previewUrl = URL.createObjectURL(file);
  draft = { phase: "reading", message: "Reading the receipt on this phone…", previewUrl, rows: [] };
  render();
  try {
    const text = await readReceiptImage(file, (message) => {
      if (draft) draft.message = message;
      const node = document.querySelector("#receipt .status-line");
      if (node) node.textContent = message;
    });
    const url = draft?.previewUrl || previewUrl;
    openReview(text, url);
  } catch {
    draft = {
      phase: "error",
      message: "The reader couldn't finish. You can paste the receipt text instead. The photo stayed on this phone.",
      previewUrl,
      rows: [],
    };
    render();
  }
}

function commitReceiptPrice(input) {
  const row = draft?.rows[Number(input.dataset.index)];
  if (!row) return;
  const raw = input.value.trim();
  if (raw === "" || !/^\d+(\.\d{1,2})?$/.test(raw)) return;
  row.price = Number(raw);
}

function saveReceipt() {
  if (!draft || draft.phase !== "review") return;
  const storeId = draft.storeId;
  if (!chainById[storeId]) {
    toast("Choose the store on the receipt.");
    return;
  }
  const date = draft.date || localToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    toast("Enter the receipt date.");
    return;
  }
  const reports = [];
  for (const row of draft.rows) {
    if (!row.include || !itemById[row.itemId]) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0.01 || price > 500) continue;
    const rounded = Math.round(price * 100) / 100;
    state.receipts[storeId] ||= {};
    state.receipts[storeId][row.itemId] ||= {};
    state.receipts[storeId][row.itemId][row.tier || "store"] = { price: rounded, date };
    reports.push({
      storeId,
      itemId: row.itemId,
      tier: row.tier || "store",
      price: rounded,
      date,
      town: draft.townId || "",
    });
  }
  if (!reports.length) {
    toast("Check at least one matched item before saving.");
    return;
  }
  const share = Boolean(draft.share) && backendConfigured();
  persist();
  clearDraft();
  render();
  if (!share) {
    toast(`Saved ${reports.length} price${reports.length === 1 ? "" : "s"} on this phone.`);
    return;
  }
  submitPrices(reports).then((body) => {
    if (Array.isArray(body.prices)) state.communityRows = body.prices;
    persist();
    render();
    toast(`Saved on this phone and shared ${body.saved ?? reports.length} price${reports.length === 1 ? "" : "s"}.`);
  }).catch(() => {
    toast("Saved on this phone. The community pool didn't accept the share.");
  });
}

async function sendInstacart() {
  const lines = state.lines.map((line) => {
    const entry = itemById[line.itemId];
    return {
      name: `${entry?.name || "Item"} ${entry ? packageSize(entry, line.tier) : ""}`.trim(),
      quantity: line.qty,
      display: entry?.name || "Item",
    };
  });
  if (backendConfigured() && services.instacart !== false && lines.length) {
    try {
      const result = await createInstacartLink({
        title: "Shelfwise list",
        lines,
        linkback: location.href.split("#")[0],
      });
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        toast("Instacart shopping list is open.");
        return;
      }
    } catch {
      /* Fall through to search. */
    }
  }
  await openService(
    "https://www.instacart.com/store/s?k=grocery",
    "List copied. Instacart search is open. Paste the list there. A one-tap list needs the worker and an Instacart key.",
  );
}

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3600);
}
