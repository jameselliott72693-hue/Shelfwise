import { brandLabel, packageSize, itemById } from "../data/items.js";
import { PRICE_AS_OF_LABEL } from "../data/prices.js";

export function money(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(digits)}`;
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
  if (source === "receipt") return "Your receipt";
  if (source === "community") return "Community";
  return "Estimate";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function prettyDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function sourceDetail(source, asOf, n) {
  const label = sourceLabel(source);
  if (source === "community") {
    const count = n ? `${n} report${n === 1 ? "" : "s"}` : "";
    return [label, count, asOf ? prettyDate(asOf) : ""].filter(Boolean).join(" · ");
  }
  if (source === "receipt") return asOf ? `${label} · ${prettyDate(asOf)}` : label;
  if (source === "yours") return label;
  return `${label} · ${PRICE_AS_OF_LABEL}`;
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
    `Prices: typed prices and receipt prices stay on this device. Other lines are community medians or Triad estimates as of ${asOfLabel}. Not a live register scan.`,
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
