/**
 * Triad shelf estimates for comparable packages.
 * Factor shelves and cellOverrides are still October 18, 2026.
 * weeklyAds mix that date with later public circulars. Each ad has asOf.
 * Not live register prices.
 *
 * How a cell is built:
 *   store tier  = item.base × STORE_FACTOR[store]
 *   name tier   = item.nameBase × NATIONAL_FACTOR[store], if that store carries it
 *   premium tier = item.premiumBase × NATIONAL_FACTOR[store], if that store carries it
 * cellOverrides replaces a single tier with a dollar amount (or null if not carried).
 * weeklyAds holds sale prices. A per-pound circular price is multiplied by the
 * catalog package weight. See the README to update them.
 */

import { items } from "./items.js";
import { chains } from "./stores.js";

export const PRICE_AS_OF = "2026-10-18";
export const PRICE_AS_OF_LABEL = "October 18, 2026";
export const PRICE_REGION = "Piedmont Triad, North Carolina";
export const PRICE_NOTE =
  "Comparable-package estimates as of October 18, 2026. Weekly ads confirmed on a later public circular are dated November 11, 2026 for Aldi, Food Lion, Harris Teeter, Lidl, and Lowes Foods, and November 8, 2026 for Target. Not live register prices.";

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

/** Known shelves still dated October 18, 2026. Not re-checked on a later page. */
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
 * Sale prices. loyalty: true means the chain's card has to be on.
 * asOf is the circular date when one was checked, otherwise October 18, 2026.
 * Per-pound ads are converted to the catalog package weight.
 * Rows that do not undercut the October 18 estimate stay in the file and
 * do not change the quote. See quoteUnit.
 */
export const weeklyAds = [
  // October 18, 2026 estimates kept because this pass did not confirm a replacement.
  { itemId: "chicken", storeId: "foodlion", tier: "store", price: 8.79, loyalty: true, asOf: "2026-10-18" },
  { itemId: "coke", storeId: "foodlion", tier: "name", price: 6.99, loyalty: true, asOf: "2026-10-18" },
  { itemId: "milk", storeId: "walmart", tier: "store", price: 2.97, loyalty: false, asOf: "2026-10-18" },
  { itemId: "cereal", storeId: "walmart", tier: "name", price: 3.48, loyalty: false, asOf: "2026-10-18" },
  { itemId: "beef", storeId: "harristeeter", tier: "store", price: 8.98, loyalty: true, asOf: "2026-10-18" },
  { itemId: "salad", storeId: "harristeeter", tier: "store", price: 2.5, loyalty: true, asOf: "2026-10-18" },
  { itemId: "bacon", storeId: "lowes", tier: "store", price: 4.99, loyalty: true, asOf: "2026-10-18" },
  { itemId: "towels", storeId: "target", tier: "store", price: 5.49, loyalty: true, asOf: "2026-10-18" },
  { itemId: "detergent", storeId: "target", tier: "name", price: 11.99, loyalty: true, asOf: "2026-10-18" },
  { itemId: "bread", storeId: "lidl", tier: "store", price: 1.25, loyalty: true, asOf: "2026-10-18" },
  { itemId: "bananas", storeId: "lidl", tier: "store", price: 1.29, loyalty: false, asOf: "2026-10-18" },
  { itemId: "pork", storeId: "publix", tier: "store", price: 6.98, loyalty: false, asOf: "2026-10-18" },
  { itemId: "eggs", storeId: "aldi", tier: "store", price: 1.99, loyalty: false, asOf: "2026-10-18" },

  // Aldi weekly ad, November 11–17, 2026.
  { itemId: "apples", storeId: "aldi", tier: "store", price: 1.99, loyalty: false, asOf: "2026-11-11" },
  { itemId: "butter", storeId: "aldi", tier: "store", price: 1.99, loyalty: false, asOf: "2026-11-11" },
  // Fresh chicken breasts $1.69/lb × the 3 lb package.
  { itemId: "chicken", storeId: "aldi", tier: "store", price: 5.07, loyalty: false, asOf: "2026-11-11" },

  // Lidl weekly ad, November 11–17, 2026.
  { itemId: "potatoes", storeId: "lidl", tier: "store", price: 2.29, loyalty: false, asOf: "2026-11-11" },
  { itemId: "onions", storeId: "lidl", tier: "store", price: 1.49, loyalty: false, asOf: "2026-11-11" },
  // Tomatoes on the vine $1.49/lb × the 1 lb package.
  { itemId: "tomato", storeId: "lidl", tier: "store", price: 1.49, loyalty: false, asOf: "2026-11-11" },
  // Store stock or broth, 12–32 oz, 99¢. Lidl Plus mark on the price.
  { itemId: "broth", storeId: "lidl", tier: "store", price: 0.99, loyalty: true, asOf: "2026-11-11" },

  // Food Lion weekly ad, November 11–17, 2026. MVP prices unless noted.
  // 80% lean fresh ground chuck $5.79/lb × the 2 lb package. Replaces the October 18 ad.
  { itemId: "beef", storeId: "foodlion", tier: "store", price: 11.58, loyalty: true, asOf: "2026-11-11" },
  // Bone-in pork chops $3.49/lb × the 2 lb package.
  { itemId: "pork", storeId: "foodlion", tier: "store", price: 6.98, loyalty: true, asOf: "2026-11-11" },
  // Butter quarters, 16 oz. The each price without the card is $2.99. The 2-for-$5 deal needs two.
  { itemId: "butter", storeId: "foodlion", tier: "store", price: 2.99, loyalty: false, asOf: "2026-11-11" },
  // Bush's beans, 15–16 oz, $1 with MVP.
  { itemId: "beans", storeId: "foodlion", tier: "name", price: 1, loyalty: true, asOf: "2026-11-11" },
  // Swanson broth, 32 oz, $2 with MVP.
  { itemId: "broth", storeId: "foodlion", tier: "name", price: 2, loyalty: true, asOf: "2026-11-11" },
  // Prego, 23.5–24 oz. Each price without the card is $3.29. Higher than the October 18 estimate.
  { itemId: "sauce", storeId: "foodlion", tier: "name", price: 3.29, loyalty: false, asOf: "2026-11-11" },
  // Reynolds Wrap, 50–75 sq ft, $5.99 with MVP. Higher than the October 18 estimate.
  { itemId: "foil", storeId: "foodlion", tier: "name", price: 5.99, loyalty: true, asOf: "2026-11-11" },

  // Harris Teeter weekly ad, November 11–17, 2026. VIC prices.
  // Boneless chicken breasts $1.99/lb × the 3 lb package.
  { itemId: "chicken", storeId: "harristeeter", tier: "store", price: 5.97, loyalty: true, asOf: "2026-11-11" },
  // Nature's Own butter bread or sourdough, 20 oz, $2.99 with VIC.
  { itemId: "bread", storeId: "harristeeter", tier: "name", price: 2.99, loyalty: true, asOf: "2026-11-11" },
  // Store foil, 75 sq ft option, $4.29 with VIC. Higher than the October 18 estimate.
  { itemId: "foil", storeId: "harristeeter", tier: "store", price: 4.29, loyalty: true, asOf: "2026-11-11" },

  // Lowes Foods weekly ad, November 11–17, 2026.
  // Boneless skinless chicken breast, family pack, $2.99/lb × the 3 lb package.
  { itemId: "chicken", storeId: "lowes", tier: "store", price: 8.97, loyalty: false, asOf: "2026-11-11" },
  // Store broth, selected 32 oz, $1.79 each.
  { itemId: "broth", storeId: "lowes", tier: "store", price: 1.79, loyalty: false, asOf: "2026-11-11" },
  // Store coffee, selected 10–12 oz, $6.99 each. Higher than the October 18 estimate.
  { itemId: "coffee", storeId: "lowes", tier: "store", price: 6.99, loyalty: false, asOf: "2026-11-11" },

  // Target weekly circular, November 8–14, 2026.
  // Good & Gather orange juice, 52 oz, $4.19. Higher than the October 18 estimate.
  { itemId: "oj", storeId: "target", tier: "store", price: 4.19, loyalty: false, asOf: "2026-11-08" },
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
