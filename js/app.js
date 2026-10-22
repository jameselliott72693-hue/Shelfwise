import { towns, townById } from "../data/towns.js";
import { chains, chainById } from "../data/stores.js";
import { items, itemById, aisles, presets, presetById, brandOptions, brandLabel, packageSize, cloneLines } from "../data/items.js";
import { PRICE_AS_OF_LABEL } from "../data/prices.js";
import { FEE_NOTE, MEMBERSHIPS, deliveryRows } from "../data/fees.js";
import { scoreTrip, quoteUnit, MODE_LABEL, QUALITY_RATE, qualityWord, SPLIT_MIN_SAVE } from "./calc.js";
import { money, miles, esc, sourceLabel, tierLabel, listText } from "./format.js";
import { loadState, saveState, encodeShare, decodeShare } from "./storage.js";

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

const app = document.getElementById("app");
app.addEventListener("click", onClick);
app.addEventListener("change", onChange);
app.addEventListener("input", onInput);

render();

function currentOrigin() {
  if (state.geo) return { lat: state.geo.lat, lng: state.geo.lng, label: "your location" };
  const town = townById[state.townId] || townById.summerfield;
  return { lat: town.lat, lng: town.lng, label: town.name };
}

function tripOptions(origin) {
  return {
    lines: state.lines,
    origin,
    priority: state.priority,
    weeklyAds: state.weeklyAds,
    loyalty: state.loyalty,
    overrides: state.overrides,
    drive: state.drive,
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
    ${toolbar(origin)}
    <p class="disclaimer">Triad estimates for comparable packages as of ${esc(PRICE_AS_OF_LABEL)}. Not live register prices. Your edits stay on this device.</p>
    <div class="layout">
      <section class="results" id="results">
        ${winnerCard(origin, result)}
        ${rankList(result)}
        ${splitCard(result)}
      </section>
      <div class="work">
        ${detailCard(origin, result)}
        ${listCard(result)}
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
      <p class="hint hint-on-dark">About ${miles(winner.distance.oneWay)} miles one way to ${esc(winner.nearest.label)}, ${esc(winner.nearest.address)}, ${esc(winner.nearest.city)}. Straight line × ${winner.distance.factor.toFixed(2)}, round trip ${miles(winner.distance.roundTrip)} miles. Approximate.</p>
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
                <span class="tag tag-${row.source}">${esc(sourceLabel(row.source))}</span>
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
        <button type="button" class="button" data-action="download">Download list</button>
        <button type="button" class="button" data-action="share">Copy share link</button>
        <button type="button" class="button button-quiet" data-action="print">Print</button>
        <button type="button" class="button button-quiet" data-action="doordash">DoorDash search</button>
        <button type="button" class="button button-quiet" data-action="ubereats">Uber Eats search</button>
      </div>
      <p class="hint">DoorDash and Uber Eats cannot take a cart from outside their apps. Those buttons copy this list, then open the service's search.</p>
    </section>
  `;
}

function driveSentence() {
  if (state.drive.mode === "perMile") {
    return `Fuel-only estimate at ${money(Number(state.drive.perMile))} per mile.`;
  }
  return `Fuel estimate at ${Number(state.drive.mpg)} mpg and ${money(Number(state.drive.gasPrice))}/gal.`;
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
        <p>Type over any price at ${esc(chain.name)}. Only numbers you change are kept. Estimates stay estimates.</p>
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
      <p class="hint">${edited ? `${edited} edited price${edited === 1 ? "" : "s"} saved on this device for ${esc(chain.name)}.` : "No edited prices for this store yet."} A blank field means “use the estimate.”</p>
      <div class="price-table" role="table" aria-label="Shelf prices at ${esc(chain.name)}">
        <div class="price-row price-head" role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Estimate</span>
          <span role="columnheader">Your price</span>
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
  });
  const yours = state.overrides?.[storeId]?.[entry.id]?.[tier];
  const inputId = `px-${storeId}-${entry.id}-${tier}`;
  return `
    <div class="price-row" role="row">
      <span role="cell">
        <strong>${esc(entry.name)}</strong>
        <span class="hint">${esc(tierLabel(tier))} · ${esc(brandLabel(entry, storeId, tier))} · ${esc(packageSize(entry, tier))}</span>
      </span>
      <span role="cell">${model ? `${money(model.price)} <span class="tag tag-${model.source}">${esc(sourceLabel(model.source))}</span>` : "Not carried"}</span>
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
        <h2>Delivery fees</h2>
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
            <p class="hint">${esc(row.note)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function driveCard() {
  const perMile = state.drive.mode === "perMile";
  return `
    <section class="card" id="drive">
      <div class="section-head">
        <h2>How the drive counts</h2>
        <p>Distance is straight-line miles times a road factor, then a round trip. The default gas price is a Triad pump estimate as of ${esc(PRICE_AS_OF_LABEL)}, not a live station quote.</p>
      </div>
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
        <label class="field">Gas, $ per gallon
          <input id="drive-gas" inputmode="decimal" value="${state.drive.gasPrice}" data-action="drive" data-field="gasPrice" ${perMile ? "disabled" : ""}>
        </label>
        <label class="field">$ per mile
          <input id="drive-mile" inputmode="decimal" value="${state.drive.perMile}" data-action="drive" data-field="perMile" ${perMile ? "" : "disabled"}>
        </label>
      </div>
      <p class="hint">The default $ per mile is $4.11 ÷ 26 mpg, so fuel-only starts at the same place as the mpg math. Time behind the wheel is not priced.</p>
    </section>
    <footer class="site-foot">
      <p>Shelfwise compares Aldi, Lidl, Walmart, Food Lion, Harris Teeter, Lowes Foods, Target, and Publix with on-device math. No account, no server, no scraped prices.</p>
    </footer>
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
    persist();
    render();
    toast(`Estimates restored for ${chainById[button.dataset.store].name}.`);
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
  } else if (action === "override" || action === "drive" || action === "qty-input") {
    commitField(input);
    persist();
    render();
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
  if (action === "override" || action === "drive" || action === "qty-input") {
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
  if (raw !== "" && !/^\d+(\.\d{1,2})?$/.test(raw)) return false;
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

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3600);
}
