import { itemById } from "../data/items.js";
import { chainById } from "../data/stores.js";
import { townById } from "../data/towns.js";

export const COMMUNITY_FRESH_DAYS = 21;
export const REPORT_MAX_AGE_DAYS = 60;
export const REPORT_MAX_BATCH = 40;
export const DAILY_REPORT_LIMIT = 40;
export const POOL_LIMIT = 1500;
export const PRICE_MAX = 500;

const TIERS = new Set(["store", "name", "premium"]);

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function median(values) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2) return round2(nums[mid]);
  return round2((nums[mid - 1] + nums[mid]) / 2);
}

export function ageDays(asOf, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf || "") || !/^\d{4}-\d{2}-\d{2}$/.test(today || "")) return null;
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86400000);
}

export function isFresh(asOf, today, days = COMMUNITY_FRESH_DAYS) {
  const age = ageDays(asOf, today);
  return age != null && age >= -1 && age <= days;
}

export function validateReport(raw, today) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid" };
  const storeId = String(raw.storeId || "");
  const itemId = String(raw.itemId || "");
  const tier = String(raw.tier || "");
  const date = String(raw.date || "");
  const town = raw.town == null || raw.town === "" ? "" : String(raw.town);
  const price = Number(raw.price);
  if (!chainById[storeId]) return { ok: false, error: "store" };
  if (!itemById[itemId]) return { ok: false, error: "item" };
  if (!TIERS.has(tier)) return { ok: false, error: "tier" };
  if (!Number.isFinite(price) || price < 0.01 || price > PRICE_MAX) return { ok: false, error: "price" };
  const age = ageDays(date, today);
  if (age == null || age < -1 || age > REPORT_MAX_AGE_DAYS) return { ok: false, error: "date" };
  if (town && !townById[town]) return { ok: false, error: "town" };
  const session = raw.session == null || raw.session === "" ? "" : String(raw.session);
  if (session && !/^[a-zA-Z0-9]{16,64}$/.test(session)) return { ok: false, error: "session" };
  return {
    ok: true,
    report: { storeId, itemId, tier, price: round2(price), date, town, session },
  };
}

/**
 * Collapse a double submit from the same phone. Two shoppers who paid the
 * same price keep both reports, because the key includes the session.
 * A report with no session is kept as its own submission.
 */
export function dedupeReports(reports) {
  const seen = new Set();
  const out = [];
  (reports || []).forEach((report, index) => {
    const who = report.session || report.id || `anon:${index}`;
    const key = [report.storeId, report.itemId, report.tier, report.price, report.date, report.town, who].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(report);
  });
  return out;
}

export function trimReports(reports, today) {
  return dedupeReports(reports)
    .filter((report) => {
      const age = ageDays(report.date, today);
      return age != null && age >= -1 && age <= REPORT_MAX_AGE_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.storeId.localeCompare(b.storeId))
    .slice(-POOL_LIMIT);
}

export function aggregateReports(reports, today, freshDays = COMMUNITY_FRESH_DAYS) {
  const fresh = (reports || []).filter((report) => isFresh(report.date, today, freshDays));
  const groups = new Map();
  const add = (key, report, town) => {
    if (!groups.has(key)) {
      groups.set(key, {
        storeId: report.storeId,
        itemId: report.itemId,
        tier: report.tier,
        town,
        prices: [],
        asOf: report.date,
      });
    }
    const group = groups.get(key);
    group.prices.push(report.price);
    if (report.date > group.asOf) group.asOf = report.date;
  };
  for (const report of fresh) {
    add(`${report.storeId}|${report.itemId}|${report.tier}|`, report, null);
    if (report.town) add(`${report.storeId}|${report.itemId}|${report.tier}|${report.town}`, report, report.town);
  }
  const rows = [];
  for (const group of groups.values()) {
    rows.push({
      storeId: group.storeId,
      itemId: group.itemId,
      tier: group.tier,
      town: group.town,
      price: median(group.prices),
      n: group.prices.length,
      asOf: group.asOf,
    });
  }
  rows.sort((a, b) => (
    a.storeId.localeCompare(b.storeId)
    || a.itemId.localeCompare(b.itemId)
    || a.tier.localeCompare(b.tier)
    || String(a.town || "").localeCompare(String(b.town || ""))
  ));
  return rows;
}

/** Town median when at least two fresh reports exist there, otherwise the regional median. */
export function pickCommunityPrice(rows, { storeId, itemId, tier, townId, today, freshDays = COMMUNITY_FRESH_DAYS } = {}) {
  if (!Array.isArray(rows) || !today) return null;
  const matches = rows.filter((row) => (
    row.storeId === storeId
    && row.itemId === itemId
    && row.tier === tier
    && isFresh(row.asOf, today, freshDays)
  ));
  if (townId) {
    const town = matches.find((row) => row.town === townId && row.n >= 2);
    if (town) return town;
  }
  return matches.find((row) => row.town == null || row.town === "") || null;
}

export function withinDailyLimit(already, adding, limit = DAILY_REPORT_LIMIT) {
  return already >= 0 && adding > 0 && already + adding <= limit;
}
