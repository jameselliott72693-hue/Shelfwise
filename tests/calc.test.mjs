import test from "node:test";
import assert from "node:assert/strict";
import { scoreTrip, quoteUnit, haversineMiles, fuelCost, tripDistance } from "../js/calc.js";
import { presetById } from "../data/items.js";
import { townById } from "../data/towns.js";
import { chains, chainById } from "../data/stores.js";
import { deliveryRows } from "../data/fees.js";
import { encodeShare, decodeShare } from "../js/storage.js";
import { prices, weeklyAds, adCovers, adValidThrough } from "../data/prices.js";
import { GAS_FALLBACK } from "../data/gas.js";
import { sourceDetail } from "../js/format.js";

const summerfield = { lat: townById.summerfield.lat, lng: townById.summerfield.lng, label: "Summerfield" };
const drive = { mode: "mpg", mpg: 26, gasPrice: 4.11, roadFactor: 1.3, perMile: 0.158 };
const loyalty = { foodlion: true, harristeeter: true, lowes: true, target: true, lidl: true };
const today = "2026-11-12";

function options(extra = {}) {
  return {
    lines: presetById.family.lines.map((line) => ({ ...line })),
    origin: summerfield,
    priority: "balanced",
    weeklyAds: true,
    loyalty: { ...loyalty },
    overrides: {},
    drive: { ...drive },
    today,
    ...extra,
  };
}

test("straight-line distance is zero at one point and positive across town", () => {
  assert.equal(haversineMiles(36.2, -79.9, 36.2, -79.9), 0);
  const miles = haversineMiles(summerfield.lat, summerfield.lng, townById.greensboro.lat, townById.greensboro.lng);
  assert.ok(miles > 8 && miles < 16);
});

test("family week scores eight chains and the parts add up", () => {
  const result = scoreTrip(options());
  assert.equal(result.stores.length, 8);
  assert.ok(result.winner);
  for (const store of result.stores) {
    const sum = Math.round((store.shelf + store.drive + store.quality) * 100);
    assert.equal(sum, Math.round(store.allIn * 100));
    assert.ok(store.drive > 0);
    assert.ok(store.nearest.address);
  }
});

test("price only zeroes the quality adjustment", () => {
  const result = scoreTrip(options({ priority: "price" }));
  for (const store of result.stores) assert.equal(store.quality, 0);
});

test("a closer tank of gas costs less to drive", () => {
  const thrifty = scoreTrip(options({ drive: { ...drive, mpg: 50 } }));
  const thirsty = scoreTrip(options({ drive: { ...drive, mpg: 15 } }));
  assert.ok(thrifty.winner.drive < thirsty.stores.find((store) => store.id === thrifty.winner.id).drive);
});

test("edited prices replace estimates and ads", () => {
  const quote = quoteUnit("milk", "aldi", "store", options({ overrides: { aldi: { milk: { store: 1.11 } } } }));
  assert.deepEqual(quote, { price: 1.11, source: "yours" });
});

test("loyalty ads and the store-brand card can be turned off", () => {
  const during = { today: "2026-10-20" };
  const on = quoteUnit("chicken", "foodlion", "store", options(during));
  const adsOff = quoteUnit("chicken", "foodlion", "store", options({ ...during, weeklyAds: false }));
  const cardOff = quoteUnit("chicken", "foodlion", "store", options({ ...during, loyalty: { ...loyalty, foodlion: false } }));
  assert.equal(on.source, "ad");
  assert.equal(on.price, 8.79);
  assert.equal(on.asOf, "2026-10-18");
  assert.equal(adsOff.source, "card");
  assert.equal(adsOff.asOf, "2026-10-18");
  assert.equal(cardOff.source, "estimate");
  assert.ok(cardOff.price > adsOff.price);
});

test("a non-loyalty ad still applies when other cards are off", () => {
  const quote = quoteUnit("eggs", "aldi", "store", options({ today: "2026-10-20" }));
  assert.equal(quote.source, "ad");
  assert.equal(quote.price, 1.99);
  assert.equal(quote.asOf, "2026-10-18");
});

test("weekly ads apply inside validThrough and fall back once they expire", () => {
  const active = quoteUnit("chicken", "aldi", "store", options({ today: "2026-11-11" }));
  assert.equal(active.source, "ad");
  assert.equal(active.price, 5.07);
  assert.equal(active.asOf, "2026-11-11");
  assert.equal(sourceDetail(active.source, active.asOf), "Ad estimate · November 11, 2026");
  const lastDay = quoteUnit("butter", "aldi", "store", options({ today: "2026-11-17" }));
  assert.equal(lastDay.source, "ad");
  assert.equal(lastDay.asOf, "2026-11-11");
  const before = quoteUnit("chicken", "aldi", "store", options({ today: "2026-11-10" }));
  assert.notEqual(before.source, "ad");
  const after = quoteUnit("chicken", "aldi", "store", options({ today: "2026-11-18" }));
  assert.notEqual(after.source, "ad");
  const expiredLoyalty = quoteUnit("chicken", "foodlion", "store", options({ today: "2026-11-26" }));
  assert.equal(expiredLoyalty.source, "card");
  assert.equal(expiredLoyalty.price, 9.95);
  assert.equal(expiredLoyalty.asOf, "2026-10-18");
  const expiredPlain = quoteUnit("eggs", "aldi", "store", options({ today: "2026-11-26" }));
  assert.equal(expiredPlain.source, "estimate");
  assert.equal(expiredPlain.price, 2.15);
  assert.equal(expiredPlain.asOf, "2026-10-18");
  assert.equal(sourceDetail(expiredPlain.source, expiredPlain.asOf), "Estimate · October 18, 2026");
});

test("a weekly ad with no end date expires after seven days", () => {
  assert.equal(adValidThrough({ asOf: "2026-03-01" }), "2026-03-07");
  assert.equal(adCovers({ asOf: "2026-03-01" }, "2026-03-07"), true);
  assert.equal(adCovers({ asOf: "2026-03-01" }, "2026-03-08"), false);
  assert.equal(adValidThrough({}), "2026-10-24");
  const target = weeklyAds.find((ad) => ad.itemId === "oj" && ad.storeId === "target");
  assert.equal(target.validThrough, "2026-11-14");
  assert.equal(adCovers(target, "2026-11-08"), true);
  assert.equal(adCovers(target, "2026-11-14"), true);
  assert.equal(adCovers(target, "2026-11-15"), false);
  const october = weeklyAds.find((ad) => ad.itemId === "eggs" && ad.storeId === "aldi");
  assert.equal(october.validThrough, "2026-10-24");
  assert.equal(adCovers(october, "2026-11-26"), false);
});

test("the sample week has no live weekly ads after every circular ends", () => {
  const result = scoreTrip(options({ today: "2026-11-26" }));
  assert.ok(result.winner);
  for (const store of result.stores) {
    assert.equal(store.ads, 0);
    assert.equal(store.priced.some((row) => row.source === "ad"), false);
  }
});

test("Summerfield's nearest Food Lion is the US 220 store, closer than Publix", () => {
  const result = scoreTrip(options());
  const foodLion = result.stores.find((store) => store.id === "foodlion");
  const publix = result.stores.find((store) => store.id === "publix");
  assert.equal(foodLion.nearest.id, "foodlion-summerfield");
  assert.ok(foodLion.distance.oneWay < publix.distance.oneWay);
  assert.ok(foodLion.distance.oneWay < 3);
});

test("fuel-only per mile matches the default mpg math", () => {
  const miles = tripDistance(10, 1.3).roundTrip;
  const byMpg = fuelCost(miles, drive);
  const byMile = fuelCost(miles, { ...drive, mode: "perMile", perMile: 4.11 / 26 });
  assert.ok(Math.abs(byMpg - byMile) < 0.02);
});

test("a missing gas price uses the bundled EIA price", () => {
  assert.equal(fuelCost(26, { mode: "mpg", mpg: 26 }), GAS_FALLBACK.price);
  assert.equal(fuelCost(26, { mode: "mpg", mpg: 26, gasPrice: undefined }), GAS_FALLBACK.price);
  assert.equal(fuelCost(26, { mode: "mpg", mpg: 26, gasPrice: 3.25 }), 3.25);
  assert.notEqual(GAS_FALLBACK.price, 4.11);
});

test("split trip math reconciles to the winner", () => {
  const result = scoreTrip(options());
  assert.ok(result.split);
  assert.equal(result.split.groups[0].items.length > 0, true);
  assert.equal(result.split.groups[1].items.length > 0, true);
  const net = Math.round((result.winner.allIn - result.split.allIn) * 100);
  assert.equal(net, Math.round(result.split.net * 100));
});

test("quality first picks a different sample-week winner than price or balanced", () => {
  const names = Object.fromEntries(["price", "balanced", "quality"].map((priority) => [priority, scoreTrip(options({ priority })).winner.id]));
  assert.equal(names.price, "aldi");
  assert.equal(names.balanced, "aldi");
  assert.equal(names.quality, "harristeeter");
});

test("cookout name brands can leave a discount chain incomplete", () => {
  const result = scoreTrip(options({ lines: presetById.cookout.lines.map((line) => ({ ...line })) }));
  const aldi = result.stores.find((store) => store.id === "aldi");
  assert.equal(aldi.complete, false);
  assert.ok(result.winner.complete);
});

test("share links round-trip the list and leave overrides alone", () => {
  const state = {
    townId: "kernersville",
    geo: null,
    priority: "quality",
    weeklyAds: false,
    loyalty,
    lines: [{ itemId: "coke", qty: 2, tier: "name" }],
    drive,
    tip: "pct10",
    memberships: { walmartPlus: true, instacartPlus: false, dashPass: false, uberOne: false, shipt: false, lowesToGo: false },
  };
  const decoded = decodeShare(`#s=${encodeShare(state)}`);
  assert.equal(decoded.townId, "kernersville");
  assert.equal(decoded.priority, "quality");
  assert.equal(decoded.weeklyAds, false);
  assert.equal(decoded.lines[0].qty, 2);
  assert.equal(decoded.tip, "pct10");
  assert.equal(decoded.memberships.walmartPlus, true);
  assert.deepEqual(decoded.overrides, {});
});

test("delivery rows split the bill and mark Aldi as not offered", () => {
  const rows = deliveryRows(chainById.foodlion, 120, { instacartPlus: false }, "flat5");
  assert.equal(rows.length, 6);
  const instacart = rows.find((row) => row.name === "Instacart");
  assert.equal(instacart.food, 120);
  assert.ok(instacart.markup > 0);
  assert.equal(instacart.tip, 5);
  assert.ok(instacart.total > instacart.food);
  const aldi = deliveryRows(chainById.aldi, 100, {}, "none");
  assert.ok(aldi.every((row) => row.available === false));
});

test("every chain has at least one Triad location and a price cell", () => {
  assert.equal(chains.length, 8);
  for (const chain of chains) {
    assert.ok(chain.locations.length >= 4);
    assert.ok(prices.milk[chain.id].store > 0);
  }
});
