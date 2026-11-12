import { items, itemById } from "../data/items.js";
import { chainById } from "../data/stores.js";
import { round2 } from "./pool.js";

const STORE_PATTERNS = [
  [/harris\s*teeter/i, "harristeeter"],
  [/food\s*lion/i, "foodlion"],
  [/lowe'?s\s*foods/i, "lowes"],
  [/wal[\s-]*mart/i, "walmart"],
  [/\btarget\b/i, "target"],
  [/\bpublix\b/i, "publix"],
  [/\baldi\b/i, "aldi"],
  [/\blidl\b/i, "lidl"],
];

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const STOP = new Set(["with", "from", "pack", "size", "count", "large", "whole", "plain", "salted", "ground", "fresh"]);
const NICKNAMES = { coke: "coca cola", dukes: "duke s" };

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function containsPhrase(haystack, phrase) {
  if (!phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

function tierForPhrase(entry, phrase) {
  const name = normalize(entry.brands?.name);
  const premium = normalize(entry.brands?.premium);
  if (NICKNAMES[phrase] && name && (name === NICKNAMES[phrase] || phrase.includes(name))) return "name";
  if (name && (phrase === name || phrase.includes(name))) return "name";
  if (premium && (phrase === premium || phrase.includes(premium))) return "premium";
  if (phrase.includes("organic") && entry.premiumBase != null) return "premium";
  return "store";
}

function aliasesFor(entry) {
  const found = [];
  const add = (text, weight) => {
    const phrase = normalize(text);
    if (phrase.length < 3) return;
    found.push({ phrase, weight, tier: tierForPhrase(entry, phrase) });
  };
  add(entry.name, 4);
  add(entry.brands?.name, 8);
  add(entry.brands?.premium, 8);
  for (const tag of entry.tags || []) add(tag, 8);
  for (const brand of Object.values(entry.storeBrands || {})) add(brand, 8);
  const tokens = normalize(entry.name).split(" ").filter((token) => token.length >= 4 && !STOP.has(token));
  for (const token of tokens) found.push({ phrase: token, weight: 4, tier: "store" });
  return found;
}

const ALIASES = items.flatMap((entry) => aliasesFor(entry).map((alias) => ({ ...alias, itemId: entry.id })));

export function matchItem(label) {
  const haystack = normalize(label);
  if (!haystack) return null;
  const scores = new Map();
  for (const alias of ALIASES) {
    if (!containsPhrase(haystack, alias.phrase)) continue;
    const current = scores.get(alias.itemId) || { score: 0, tier: "store", tierWeight: 0 };
    current.score += alias.weight + Math.min(alias.phrase.length, 20) / 10;
    if (alias.weight > current.tierWeight && alias.tier !== "store") {
      current.tier = alias.tier;
      current.tierWeight = alias.weight;
    }
    scores.set(alias.itemId, current);
  }
  let best = null;
  let second = 0;
  for (const [itemId, info] of scores) {
    if (!best || info.score > best.score) {
      second = best?.score || 0;
      best = { itemId, ...info };
    } else if (info.score > second) {
      second = info.score;
    }
  }
  if (!best || best.score < 4 || best.score < second + 3) return null;
  if (!itemById[best.itemId]) return null;
  return { itemId: best.itemId, tier: best.tier };
}

export function detectStore(text) {
  for (const [pattern, id] of STORE_PATTERNS) {
    if (pattern.test(text) && chainById[id]) return id;
  }
  return "";
}

export function detectDate(text) {
  const iso = String(text || "").match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = String(text || "").match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const named = String(text || "").match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (named) {
    const month = MONTHS[named[1].slice(0, 3).toLowerCase()];
    const day = Number(named[2]);
    if (month && day >= 1 && day <= 31) {
      return `${named[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return "";
}

function isSkipLine(line) {
  const padded = ` ${normalize(line)} `;
  return /\b(subtotal|total|tax|change|visa|mastercard|debit|credit|cash|payment|balance|tender|coupon|savings|discount|survey|approved|cashier|auth|invoice)\b/.test(padded);
}

export function parsePriceLine(line) {
  const cleaned = String(line || "").replace(/[|$]/g, " ").replace(/\s+/g, " ").trim();
  const leading = cleaned.match(/^(\d+)\s*@\s*(\d+\.\d{2})\s+(.+)$/);
  if (leading && leading[3].trim().length >= 2) {
    return { label: leading[3].trim(), price: round2(Number(leading[2])) };
  }
  const each = cleaned.match(/^(.*?)\s(\d+)\s*@\s*(\d+\.\d{2})\s*$/);
  if (each && each[1].trim().length >= 2) {
    return { label: each[1].trim(), price: round2(Number(each[3])) };
  }
  const tail = cleaned.match(/^(.*\D)\s+(\d+\.\d{2})\s*[A-Za-z]?$/);
  if (!tail) return null;
  const label = tail[1].replace(/\s+[xX*]\s*$/, "").trim();
  if (label.length < 2) return null;
  return { label, price: round2(Number(tail[2])) };
}

export function parseReceiptText(text) {
  const raw = String(text || "");
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || isSkipLine(trimmed)) continue;
    const priced = parsePriceLine(trimmed);
    if (!priced) continue;
    const match = matchItem(priced.label);
    rows.push({
      raw: trimmed,
      label: priced.label,
      price: priced.price,
      itemId: match?.itemId || "",
      tier: match?.tier || "store",
      include: Boolean(match),
    });
  }
  return {
    storeId: detectStore(raw),
    date: detectDate(raw),
    rows,
  };
}
