import test from "node:test";
import assert from "node:assert/strict";
import { scoreTrip, quoteUnit, haversineMiles, fuelCost, tripDistance, budgetPlan, adIsExpired } from "../js/calc.js";
import { presetById } from "../data/items.js";
import { townById } from "../data/towns.js";
import { chains, chainById } from "../data/stores.js";
import { deliveryRows } from "../data/fees.js";
import { encodeShare, decodeShare } from "../js/storage.js";
import { prices, adFor, newestAd, PRICE_AS_OF } from "../data/prices.js";
import { GAS_FALLBACK } from "../data/gas.js";
import { sourceDetail } from "../js/format.js";

const summerfield = { lat: townById.summerfield.lat, lng: townById.summerfield.lng, label: "Summerfield" };
const drive = { mode: "mpg", mpg: 26, gasPrice: 4.11, roadFactor: 1.3, perMile: 0.158 };
const loyalty = { foodlion: true, harristeeter: true, lowes: true, target: true, lidl: true };
const today = "2026-10-20";

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
  const on = quoteUnit("chicken", "foodlion", "store", options());
  const adsOff = quoteUnit("chicken", "foodlion", "store", options({ weeklyAds: false }));
  const cardOff = quoteUnit("chicken", "foodlion", "store", options({ loyalty: { ...loyalty, foodlion: false } }));
  assert.equal(on.source, "ad");
  assert.equal(on.price, 8.79);
  assert.equal(on.asOf, "2026-10-18");
  assert.equal(adsOff.source, "card");
  assert.equal(adsOff.asOf, PRICE_AS_OF);
  assert.equal(adsOff.expiredAd, undefined);
  assert.equal(cardOff.source, "estimate");
  assert.equal(cardOff.asOf, PRICE_AS_OF);
  assert.ok(cardOff.price > adsOff.price);
});

test("a non-loyalty ad still applies when other cards are off", () => {
  const quote = quoteUnit("eggs", "aldi", "store", options());
  assert.equal(quote.source, "ad");
  assert.equal(quote.price, 1.99);
  assert.equal(quote.asOf, "2026-10-18");
});

test("an ad older than 7 days is left out of the price and flagged", () => {
  assert.equal(adIsExpired("2026-11-11", "2026-11-18"), false);
  assert.equal(adIsExpired("2026-11-11", "2026-11-19"), true);
  assert.equal(adIsExpired("", "2026-11-19"), true);
  const fresh = quoteUnit("apples", "aldi", "store", options({ today: "2026-11-18" }));
  assert.equal(fresh.source, "ad");
  assert.equal(fresh.price, 1.99);
  assert.equal(fresh.asOf, "2026-11-11");
  const expired = quoteUnit("apples", "aldi", "store", options({ today: "2026-11-19" }));
  const plain = quoteUnit("apples", "aldi", "store", options({ today: "2026-11-19", weeklyAds: false }));
  assert.equal(expired.source, "estimate");
  assert.equal(expired.price, plain.price);
  assert.ok(expired.price > fresh.price);
  assert.equal(expired.asOf, PRICE_AS_OF);
  assert.deepEqual(expired.expiredAd, { price: 1.99, asOf: "2026-11-11" });
  const trip = scoreTrip(options({
    today: "2026-11-26",
    lines: [{ itemId: "apples", qty: 2, tier: "store" }],
  }));
  const aldi = trip.stores.find((store) => store.id === "aldi");
  assert.equal(aldi.ads, 0);
  assert.equal(aldi.expiredAds, 1);
  assert.equal(aldi.priced[0].source, "estimate");
  assert.equal(aldi.priced[0].asOf, PRICE_AS_OF);
  assert.equal(aldi.shelf, plain.price * 2);
});

test("missing gas price uses the bundled EIA fallback", () => {
  const fallback = fuelCost(26, { mode: "mpg", mpg: 26, roadFactor: 1.3 });
  assert.equal(fallback, GAS_FALLBACK.price);
  assert.equal(GAS_FALLBACK.price, 3.609);
  const explicit = fuelCost(26, { mode: "mpg", mpg: 26, gasPrice: 4.11, roadFactor: 1.3 });
  assert.equal(explicit, 4.11);
});

test("adFor keeps the newest asOf for a repeated item and store", () => {
  const olderLast = [
    { itemId: "milk", storeId: "aldi", tier: "store", price: 1.7, asOf: "2026-11-11" },
    { itemId: "milk", storeId: "aldi", tier: "store", price: 2.2, asOf: "2026-10-18" },
  ];
  const newerLast = [
    { itemId: "milk", storeId: "aldi", tier: "store", price: 2.2, asOf: "2026-10-18" },
    { itemId: "milk", storeId: "aldi", tier: "store", price: 1.7, asOf: "2026-11-11" },
  ];
  assert.equal(newestAd(olderLast, "milk", "aldi", "store").price, 1.7);
  assert.equal(newestAd(newerLast, "milk", "aldi", "store").price, 1.7);
  assert.equal(newestAd(newerLast, "milk", "aldi", "store").asOf, "2026-11-11");
  assert.equal(adFor("apples", "aldi", "store").asOf, "2026-11-11");
  assert.equal(adFor("apples", "aldi", "store").price, 1.99);
  assert.equal(adFor("missing", "aldi", "store"), null);
});

test("quoted rows show their own asOf date", () => {
  assert.equal(sourceDetail("ad", "2026-11-11"), "Ad estimate · November 11, 2026");
  assert.equal(sourceDetail("estimate", PRICE_AS_OF), "Estimate · October 18, 2026");
  assert.equal(sourceDetail("card", PRICE_AS_OF), "Card −5% · October 18, 2026");
});

test("a weekly budget cap ranks store-brand swaps and a two-store split", () => {
  const lines = [
    { itemId: "milk", qty: 1, tier: "store" },
    { itemId: "chicken", qty: 1, tier: "store" },
    { itemId: "beef", qty: 1, tier: "store" },
    { itemId: "cereal", qty: 1, tier: "name" },
  ];
  const trip = options({ lines, priority: "price" });
  const result = scoreTrip(trip);
  assert.ok(result.winner);
  const under = budgetPlan(result, lines, trip, result.winner.shelf + 10);
  assert.equal(under.over, false);
  assert.equal(under.swaps.length, 0);
  const over = budgetPlan(result, lines, trip, 15);
  assert.equal(over.over, true);
  assert.ok(over.gap > 0);
  assert.ok(over.swaps.length >= 2 && over.swaps.length <= 5);
  for (let i = 1; i < over.swaps.length; i += 1) {
    assert.ok(over.swaps[i - 1].savings >= over.swaps[i].savings);
  }
  const brands = over.swaps.filter((swap) => swap.kind === "brand");
  assert.equal(brands.length, 1);
  assert.equal(brands[0].itemId, "cereal");
  assert.equal(brands[0].toTier, "store");
  assert.ok(brands[0].savings > 0);
  assert.equal(over.swaps[0].kind, "split");
  assert.ok(over.swaps[0].savings > brands[0].savings);
  assert.ok(over.stackedSave > 0);
  assert.ok(over.shelfAfterSwaps < over.basket);
  assert.equal(over.shelfAfterSwaps, Math.round((over.basket - over.stackedSave) * 100) / 100);
  assert.equal(over.underAfterSwaps, over.stackedSave + 0.001 >= over.gap);
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
  assert.equal(decoded.budgetOn, false);
  assert.equal(decoded.budgetCap, 150);
  assert.deepEqual(decoded.overrides, {});
  const capped = decodeShare(`#s=${encodeShare({ ...state, budgetOn: true, budgetCap: 150 })}`);
  assert.equal(capped.budgetOn, true);
  assert.equal(capped.budgetCap, 150);
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
