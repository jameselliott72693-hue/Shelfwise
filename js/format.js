import { brandLabel, packageSize, itemById } from "../data/items.js";
import { PRICE_AS_OF_LABEL } from "../data/prices.js";

export function money(value) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function miles(value) {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function sourceLabel(source) {
  if (source === "ad") return "Ad estimate";
  if (source === "card") return "Card −5%";
  if (source === "yours") return "Your price";
  return "Estimate";
}

export function tierLabel(tier) {
  if (tier === "name") return "Name brand";
  if (tier === "premium") return "Premium";
  return "Store brand";
}

export function listText({ lines, store, placeLabel, asOfLabel = PRICE_AS_OF_LABEL }) {
  const header = [
    "Shelfwise grocery list",
    `Place: ${placeLabel}`,
    store ? `Priced at: ${store.name}` : "Not priced at a store",
    `Prices: Triad estimates for comparable packages as of ${asOfLabel}. Not live register prices.`,
    "",
  ];
  const body = lines.map((line) => {
    const entry = itemById[line.itemId];
    if (!entry) return "";
    const priced = store?.priced?.find((row) => row.itemId === line.itemId && row.tier === line.tier);
    const brand = brandLabel(entry, store?.id, line.tier);
    const size = packageSize(entry, line.tier);
    const cost = priced ? `${money(priced.unit)} each, ${money(priced.lineShelf)} line` : "not sold at this brand";
    return `${line.qty} × ${entry.name} (${size}, ${tierLabel(line.tier)}: ${brand}) — ${cost}`;
  }).filter(Boolean);
  const totals = store
    ? ["", `Shelf ${money(store.shelf)}`, `Drive ${money(store.drive)}`, `Quality ${money(store.quality)}`, `All-in ${money(store.allIn)}`]
    : [];
  return [...header, ...body, ...totals, "", "Made with Shelfwise. Estimates only."].join("\n");
}
