import test from "node:test";
import assert from "node:assert/strict";
import { quoteUnit, scoreTrip } from "../js/calc.js";
import { presetById } from "../data/items.js";
import { townById } from "../data/towns.js";
import { chainById } from "../data/stores.js";
import { deliveryRows, FEE_AS_OF_LABEL } from "../data/fees.js";
import { effectiveGas, parseEiaPayload } from "../js/gas.js";
import { GAS_FALLBACK } from "../data/gas.js";
import {
  aggregateReports,
  median,
  pickCommunityPrice,
  trimReports,
  validateReport,
  withinDailyLimit,
} from "../js/pool.js";

const drive = { mode: "mpg", mpg: 26, gasPrice: 4.11, roadFactor: 1.3, perMile: 0.158 };
const loyalty = { foodlion: true, harristeeter: true, lowes: true, target: true, lidl: true };
const today = "2026-11-10";

function options(extra = {}) {
  return {
    lines: presetById.family.lines.map((line) => ({ ...line })),
    origin: { lat: townById.summerfield.lat, lng: townById.summerfield.lng, label: "Summerfield" },
    priority: "balanced",
    weeklyAds: true,
    loyalty: { ...loyalty },
    overrides: {},
    drive: { ...drive },
    today,
    ...extra,
  };
}

test("median uses the middle and the cent average of an even set", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([2.99, 3.49]), 3.24);
  assert.equal(median([]), null);
});

test("a typed price beats a receipt, which beats a fresh community price, which beats an ad", () => {
  const community = [{
    storeId: "foodlion", itemId: "chicken", tier: "store", price: 9.1, n: 3, asOf: "2026-11-01", town: null,
  }];
  const receipts = { foodlion: { chicken: { store: { price: 8.1, date: "2026-11-08" } } } };
  const base = options({ community, receipts, townId: "summerfield" });
  const fromCommunity = quoteUnit("chicken", "foodlion", "store", options({ community, today, townId: "summerfield" }));
  assert.equal(fromCommunity.source, "community");
  assert.equal(fromCommunity.price, 9.1);
  assert.equal(fromCommunity.asOf, "2026-11-01");
  const fromReceipt = quoteUnit("chicken", "foodlion", "store", base);
  assert.equal(fromReceipt.source, "receipt");
  assert.equal(fromReceipt.price, 8.1);
  const typed = quoteUnit("chicken", "foodlion", "store", options({
    ...base,
    overrides: { foodlion: { chicken: { store: 7.5 } } },
  }));
  assert.deepEqual(typed, { price: 7.5, source: "yours" });
});

test("a stale community price falls back to the weekly ad estimate", () => {
  const community = [{
    storeId: "foodlion", itemId: "chicken", tier: "store", price: 9.1, n: 4, asOf: "2026-09-01", town: null,
  }];
  const quote = quoteUnit("chicken", "foodlion", "store", options({ community, today }));
  assert.equal(quote.source, "ad");
  assert.equal(quote.price, 8.79);
});

test("two fresh town reports beat the regional median", () => {
  const community = [
    { storeId: "aldi", itemId: "milk", tier: "store", price: 2.99, n: 5, asOf: "2026-11-09", town: null },
    { storeId: "aldi", itemId: "milk", tier: "store", price: 2.79, n: 2, asOf: "2026-11-08", town: "summerfield" },
    { storeId: "aldi", itemId: "milk", tier: "store", price: 2.5, n: 1, asOf: "2026-11-08", town: "greensboro" },
  ];
  const town = pickCommunityPrice(community, {
    storeId: "aldi", itemId: "milk", tier: "store", townId: "summerfield", today,
  });
  const oneReport = pickCommunityPrice(community, {
    storeId: "aldi", itemId: "milk", tier: "store", townId: "greensboro", today,
  });
  assert.equal(town.price, 2.79);
  assert.equal(oneReport.price, 2.99);
});

test("reports validate, drop duplicates, and aggregate to a median", () => {
  const good = validateReport({
    storeId: "aldi", itemId: "milk", tier: "store", price: 2.789, date: "2026-11-08", town: "greensboro",
  }, today);
  assert.equal(good.ok, true);
  assert.equal(good.report.price, 2.79);
  assert.equal(validateReport({ storeId: "aldi", itemId: "nope", tier: "store", price: 1, date: "2026-11-08" }, today).ok, false);
  assert.equal(validateReport({ storeId: "aldi", itemId: "milk", tier: "store", price: 0, date: "2026-11-08" }, today).error, "price");
  assert.equal(validateReport({
    storeId: "aldi", itemId: "milk", tier: "store", price: 2, date: "2026-08-01",
  }, today).error, "date");
  const session = "aaaaaaaaaaaaaaaa";
  const reports = trimReports([
    { ...good.report, session },
    { ...good.report, session },
    { ...good.report, session, price: 3.09, date: "2026-11-09" },
    { ...good.report, session, price: 9, date: "2026-01-01" },
  ], today);
  assert.equal(reports.length, 2);
  const rows = aggregateReports(reports, today);
  const region = rows.find((row) => row.town == null);
  assert.equal(region.price, 2.94);
  assert.equal(region.n, 2);
  assert.equal(region.asOf, "2026-11-09");
  assert.equal(withinDailyLimit(38, 2), true);
  assert.equal(withinDailyLimit(39, 2), false);
  assert.equal(validateReport({
    storeId: "aldi", itemId: "milk", tier: "store", price: 2, date: "2026-11-08", session: "short",
  }, today).error, "session");
});

test("the same price from two shoppers both count, and one shopper does not", () => {
  const base = {
    storeId: "aldi", itemId: "milk", tier: "store", price: 2.79, date: "2026-11-08", town: "greensboro",
  };
  const reports = trimReports([
    { ...base, session: "aaaaaaaaaaaaaaaa" },
    { ...base, session: "aaaaaaaaaaaaaaaa" },
    { ...base, session: "bbbbbbbbbbbbbbbb" },
  ], today);
  assert.equal(reports.length, 2);
  const region = aggregateReports(reports, today).find((row) => row.town == null);
  assert.equal(region.n, 2);
  assert.equal(region.price, 2.79);
});

test("a receipt price fills a line the bundled estimate calls missing", () => {
  const result = scoreTrip(options({
    lines: [{ itemId: "mayo", qty: 1, tier: "name" }],
    receipts: { aldi: { mayo: { name: { price: 4.29, date: "2026-11-01" } } } },
    weeklyAds: false,
  }));
  const aldi = result.stores.find((store) => store.id === "aldi");
  assert.equal(aldi.complete, true);
  assert.equal(aldi.priced[0].source, "receipt");
  assert.equal(aldi.priced[0].unit, 4.29);
  assert.equal(aldi.receiptCount, 1);
});

test("the pump price replaces EIA, and a newer EIA week replaces the bundle", () => {
  const fallback = effectiveGas({});
  assert.equal(fallback.price, GAS_FALLBACK.price);
  assert.equal(fallback.source, "eia");
  assert.equal(fallback.bundled, true);
  const older = effectiveGas({ live: { price: 3.2, period: "2026-10-26" } });
  assert.equal(older.price, GAS_FALLBACK.price);
  const newer = effectiveGas({ live: { price: 3.81, period: "2026-11-09", sourceName: "U.S. Energy Information Administration" } });
  assert.equal(newer.price, 3.81);
  assert.equal(newer.live, true);
  const pump = effectiveGas({ pumpPrice: 3.459, live: { price: 3.81, period: "2026-11-09" } });
  assert.equal(pump.source, "pump");
  assert.equal(pump.price, 3.459);
});

test("EIA payload parsing keeps the latest weekly row", () => {
  const parsed = parseEiaPayload({
    response: { data: [{ period: "2026-11-02", value: "3.695", series: "EMM_EPMR_PTE_R1Z_DPG" }] },
  });
  assert.equal(parsed.price, 3.695);
  assert.equal(parsed.period, "2026-11-02");
  assert.equal(parseEiaPayload({ response: { data: [] } }), null);
});

test("reviewed fee rows keep a date and a source link", () => {
  const lowes = deliveryRows(chainById.lowes, 20, {}, "none");
  const pickup = lowes.find((row) => row.name === "Store pickup");
  const delivery = lowes.find((row) => row.name === "Store delivery");
  assert.equal(pickup.fee, 4.95);
  assert.equal(delivery.fee, 4.95);
  assert.equal(pickup.asOfLabel, FEE_AS_OF_LABEL);
  assert.match(pickup.sourceUrl, /^https:\/\/www\.lowesfoods\.com\//);
  const member = deliveryRows(chainById.lowes, 20, { lowesToGo: true }, "none");
  assert.equal(member.find((row) => row.name === "Store delivery").fee, 0);
  const htSmall = deliveryRows(chainById.harristeeter, 20, {}, "none").find((row) => row.name === "Store pickup");
  const htLarge = deliveryRows(chainById.harristeeter, 40, {}, "none").find((row) => row.name === "Store pickup");
  assert.equal(htSmall.fee, 4.95);
  assert.equal(htLarge.fee, 0);
  assert.match(htSmall.sourceUrl, /^https:\/\/www\.harristeeter\.com\//);
  const target = deliveryRows(chainById.target, 40, {}, "none").find((row) => row.name === "Store delivery");
  assert.equal(target.fee, 9.99);
  const instacart = deliveryRows(chainById.foodlion, 20, { instacartPlus: true }, "none").find((row) => row.name === "Instacart");
  assert.equal(instacart.fee, 0);
  assert.match(instacart.sourceUrl, /^https:\/\/www\.instacart\.com\//);
  assert.equal(instacart.asOfLabel, "November 10, 2026");
});
