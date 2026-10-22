/**
 * Triad shelf estimates for comparable packages.
 * As of October 18, 2026. Not live register prices.
 *
 * How a cell is built:
 *   store tier  = item.base × STORE_FACTOR[store]
 *   name tier   = item.nameBase × NATIONAL_FACTOR[store], if that store carries it
 *   premium tier = item.premiumBase × NATIONAL_FACTOR[store], if that store carries it
 * cellOverrides replaces a single tier with a dollar amount (or null if not carried).
 * weeklyAds holds this week's estimated sale prices. See the README to update them.
 */

import { items } from "./items.js";
import { chains } from "./stores.js";

export const PRICE_AS_OF = "2026-10-18";
export const PRICE_AS_OF_LABEL = "October 18, 2026";
export const PRICE_REGION = "Piedmont Triad, North Carolina";

export const STORE_FACTOR = {
  aldi: 0.92,
  lidl: 0.94,
  walmart: 0.97,
  foodlion: 1,
  target: 1.03,
  lowes: 1.07,
  harristeeter: 1.12,
  publix: 1.16,
};

export const NATIONAL_FACTOR = {
  aldi: 0.97,
  lidl: 0.98,
  walmart: 0.95,
  foodlion: 1,
  target: 1.03,
  lowes: 1.05,
  harristeeter: 1.06,
  publix: 1.08,
};

/** One shelf, when you know it. Keys: store, name, premium. null means not carried. */
export const cellOverrides = {
  milk: {
    aldi: { store: 2.85 },
    lidl: { store: 2.95 },
    walmart: { store: 3.18 },
  },
  eggs: {
    aldi: { store: 2.15 },
    lidl: { store: 2.25 },
  },
  bananas: {
    aldi: { store: 1.47 },
    walmart: { store: 1.41 },
    lidl: { store: 1.5 },
  },
};

/**
 * Estimated sale prices for the week of PRICE_AS_OF.
 * loyalty: true means the chain's card has to be on.
 * These are sale estimates, not a scanned weekly ad.
 */
export const weeklyAds = [
  { itemId: "chicken", storeId: "foodlion", tier: "store", price: 8.79, loyalty: true },
  { itemId: "beef", storeId: "foodlion", tier: "store", price: 7.98, loyalty: true },
  { itemId: "coke", storeId: "foodlion", tier: "name", price: 6.99, loyalty: true },
  { itemId: "milk", storeId: "walmart", tier: "store", price: 2.97, loyalty: false },
  { itemId: "cereal", storeId: "walmart", tier: "name", price: 3.48, loyalty: false },
  { itemId: "beef", storeId: "harristeeter", tier: "store", price: 8.98, loyalty: true },
  { itemId: "salad", storeId: "harristeeter", tier: "store", price: 2.5, loyalty: true },
  { itemId: "bacon", storeId: "lowes", tier: "store", price: 4.99, loyalty: true },
  { itemId: "towels", storeId: "target", tier: "store", price: 5.49, loyalty: true },
  { itemId: "detergent", storeId: "target", tier: "name", price: 11.99, loyalty: true },
  { itemId: "bread", storeId: "lidl", tier: "store", price: 1.25, loyalty: true },
  { itemId: "bananas", storeId: "lidl", tier: "store", price: 1.29, loyalty: false },
  { itemId: "pork", storeId: "publix", tier: "store", price: 6.98, loyalty: false },
  { itemId: "eggs", storeId: "aldi", tier: "store", price: 1.99, loyalty: false },
];

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildPrices() {
  const table = {};
  for (const entry of items) {
    table[entry.id] = {};
    for (const chain of chains) {
      const cell = {
        store: round2(entry.base * STORE_FACTOR[chain.id]),
        name: entry.nameBase != null && entry.nameAt.includes(chain.id)
          ? round2(entry.nameBase * NATIONAL_FACTOR[chain.id])
          : null,
        premium: entry.premiumBase != null && entry.premiumAt.includes(chain.id)
          ? round2(entry.premiumBase * NATIONAL_FACTOR[chain.id])
          : null,
      };
      const override = cellOverrides[entry.id]?.[chain.id];
      if (override) {
        for (const tier of ["store", "name", "premium"]) {
          if (Object.prototype.hasOwnProperty.call(override, tier)) cell[tier] = override[tier];
        }
      }
      table[entry.id][chain.id] = cell;
    }
  }
  return table;
}

export const prices = buildPrices();

export function adFor(itemId, storeId, tier) {
  return weeklyAds.find((ad) => ad.itemId === itemId && ad.storeId === storeId && ad.tier === tier) || null;
}
