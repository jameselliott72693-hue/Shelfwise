import { itemById, presetById, cloneLines } from "../data/items.js";
import { townById } from "../data/towns.js";

export const STORAGE_KEY = "shelfwise.v1";

const TIERS = new Set(["store", "name", "premium"]);
const PRIORITIES = new Set(["price", "balanced", "quality"]);
const TIPS = new Set(["none", "flat5", "pct10"]);
const LOYALTY_IDS = ["foodlion", "harristeeter", "lowes", "target", "lidl"];
const MEMBER_IDS = ["walmartPlus", "instacartPlus", "dashPass", "uberOne", "shipt", "lowesToGo"];

export function defaultState() {
  return {
    townId: "summerfield",
    geo: null,
    priority: "balanced",
    weeklyAds: true,
    loyalty: { foodlion: true, harristeeter: true, lowes: true, target: true, lidl: true },
    lines: cloneLines(presetById.family.lines),
    overrides: {},
    drive: { mode: "mpg", mpg: 26, gasPrice: 4.11, roadFactor: 1.3, perMile: 0.158 },
    tip: "none",
    memberships: {
      walmartPlus: false,
      instacartPlus: false,
      dashPass: false,
      uberOne: false,
      shipt: false,
      lowesToGo: false,
    },
    selectedStoreId: null,
    catalogQuery: "",
    catalogAisle: "",
    catalogBrand: "",
    editorStoreId: null,
    editorAll: false,
    geoError: "",
  };
}

function cleanLines(lines) {
  if (!Array.isArray(lines)) return null;
  const next = [];
  for (const line of lines.slice(0, 80)) {
    const itemId = line?.itemId || line?.[0];
    const qty = Number(line?.qty ?? line?.[1]);
    const tier = line?.tier || line?.[2];
    if (!itemById[itemId] || !TIERS.has(tier)) continue;
    const safeQty = Number.isFinite(qty) ? Math.min(99, Math.max(1, Math.round(qty))) : 1;
    next.push({ itemId, qty: safeQty, tier });
  }
  return next;
}

function cleanOverrides(raw) {
  const overrides = {};
  if (!raw || typeof raw !== "object") return overrides;
  for (const [storeId, items] of Object.entries(raw)) {
    if (!items || typeof items !== "object") continue;
    for (const [itemId, tiers] of Object.entries(items)) {
      if (!itemById[itemId] || !tiers || typeof tiers !== "object") continue;
      for (const [tier, value] of Object.entries(tiers)) {
        if (!TIERS.has(tier)) continue;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > 500) continue;
        overrides[storeId] ||= {};
        overrides[storeId][itemId] ||= {};
        overrides[storeId][itemId][tier] = Math.round(number * 100) / 100;
      }
    }
  }
  return overrides;
}

export function sanitizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const lines = cleanLines(raw.lines);
  return {
    ...base,
    townId: townById[raw.townId] ? raw.townId : base.townId,
    geo: raw.geo && Number.isFinite(Number(raw.geo.lat)) && Number.isFinite(Number(raw.geo.lng))
      ? { lat: Number(raw.geo.lat), lng: Number(raw.geo.lng) }
      : null,
    priority: PRIORITIES.has(raw.priority) ? raw.priority : base.priority,
    weeklyAds: raw.weeklyAds !== false,
    loyalty: Object.fromEntries(LOYALTY_IDS.map((id) => [id, raw.loyalty?.[id] !== false])),
    lines: lines && lines.length ? lines : base.lines,
    overrides: cleanOverrides(raw.overrides),
    drive: {
      mode: raw.drive?.mode === "perMile" ? "perMile" : "mpg",
      mpg: numberOr(raw.drive?.mpg, 26),
      gasPrice: numberOr(raw.drive?.gasPrice, 4.11),
      roadFactor: numberOr(raw.drive?.roadFactor, 1.3),
      perMile: numberOr(raw.drive?.perMile, 0.158),
    },
    tip: TIPS.has(raw.tip) ? raw.tip : "none",
    memberships: Object.fromEntries(MEMBER_IDS.map((id) => [id, Boolean(raw.memberships?.[id])])),
    selectedStoreId: typeof raw.selectedStoreId === "string" ? raw.selectedStoreId : null,
    editorStoreId: typeof raw.editorStoreId === "string" ? raw.editorStoreId : null,
    editorAll: Boolean(raw.editorAll),
  };
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  const payload = {
    townId: state.townId,
    geo: state.geo,
    priority: state.priority,
    weeklyAds: state.weeklyAds,
    loyalty: state.loyalty,
    lines: state.lines,
    overrides: state.overrides,
    drive: state.drive,
    tip: state.tip,
    memberships: state.memberships,
    selectedStoreId: state.selectedStoreId,
    editorStoreId: state.editorStoreId,
    editorAll: state.editorAll,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function encodeShare(state) {
  const payload = {
    v: 1,
    town: state.townId,
    geo: state.geo ? { lat: Math.round(state.geo.lat * 1000) / 1000, lng: Math.round(state.geo.lng * 1000) / 1000 } : null,
    priority: state.priority,
    ads: state.weeklyAds ? 1 : 0,
    cards: state.loyalty,
    drive: state.drive,
    tip: state.tip,
    members: state.memberships,
    lines: state.lines.map((line) => [line.itemId, line.qty, line.tier]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShare(hash) {
  const raw = hash.startsWith("#s=") ? hash.slice(3) : "";
  if (!raw || raw.length > 8000) return null;
  try {
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data?.v !== 1) return null;
    return sanitizeState({
      townId: data.town,
      geo: data.geo,
      priority: data.priority,
      weeklyAds: data.ads !== 0,
      loyalty: data.cards,
      lines: data.lines,
      drive: data.drive,
      tip: data.tip,
      memberships: data.members,
    });
  } catch {
    return null;
  }
}
