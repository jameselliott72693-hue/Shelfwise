/**
 * All-in = shelf + drive + quality.
 * Shelf is what you pay at the store. Drive is fuel for a round trip to the
 * nearest store. Quality is a credit (negative) or a penalty (positive) from
 * this app's produce / meat / other scores. It is not a register charge.
 *
 * Balanced counts each quality point as QUALITY_RATE of that department's
 * shelf dollars. Quality first doubles that. Price only ignores it.
 */

import { chains, chainById } from "../data/stores.js";
import { itemById } from "../data/items.js";
import { prices, adFor } from "../data/prices.js";

export const QUALITY_RATE = 0.09;
export const QUALITY_WEIGHT = { price: 0, balanced: 1, quality: 2 };
export const CARD_RATE = 0.05;
export const SPLIT_MIN_SAVE = 1.5;

export const MODE_LABEL = {
  price: "Price only",
  balanced: "Balanced",
  quality: "Quality first",
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cents(value) {
  return Math.sign(value) * Math.round(Math.abs(value) * 100);
}

function fromCents(value) {
  return value / 100;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const radius = 3958.7613;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestLocation(chain, origin) {
  let best = null;
  for (const place of chain.locations) {
    const straight = haversineMiles(origin.lat, origin.lng, place.lat, place.lng);
    if (!best || straight < best.straight) best = { ...place, straight };
  }
  return best;
}

export function tripDistance(straight, roadFactor) {
  const factor = clamp(roadFactor, 1, 2.5, 1.3);
  const oneWay = straight * factor;
  return { straight, factor, oneWay, roundTrip: oneWay * 2 };
}

export function fuelCost(roundTripMiles, drive) {
  if (drive.mode === "perMile") {
    return roundTripMiles * clamp(drive.perMile, 0, 5, 0.158);
  }
  const mpg = clamp(drive.mpg, 5, 100, 26);
  const gas = clamp(drive.gasPrice, 0, 20, 4.11);
  return (roundTripMiles / mpg) * gas;
}

export function quoteUnit(itemId, storeId, tier, options) {
  const chain = chainById[storeId];
  const override = options.overrides?.[storeId]?.[itemId]?.[tier];
  if (override != null && override !== "" && Number.isFinite(Number(override)) && Number(override) >= 0) {
    return { price: round2(Number(override)), source: "yours" };
  }

  const regular = prices[itemId]?.[storeId]?.[tier];
  const ad = adFor(itemId, storeId, tier);
  const cardOn = Boolean(chain?.loyalty) && options.loyalty?.[storeId] !== false;

  let estimate = regular == null ? null : regular;
  let estimateSource = "estimate";
  if (estimate != null && tier === "store" && chain?.loyalty && cardOn) {
    estimate = round2(estimate * (1 - CARD_RATE));
    estimateSource = "card";
  }

  let adPrice = null;
  if (options.weeklyAds && ad && (!ad.loyalty || cardOn)) adPrice = ad.price;

  if (adPrice != null && (estimate == null || adPrice <= estimate)) {
    return { price: round2(adPrice), source: "ad" };
  }
  if (estimate == null) return null;
  return { price: estimate, source: estimateSource };
}

function emptyDepartments() {
  return {
    produce: { shelf: 0, quality: 0 },
    meat: { shelf: 0, quality: 0 },
    other: { shelf: 0, quality: 0 },
  };
}

function scoreChain(chain, lines, options, origin) {
  const weight = QUALITY_WEIGHT[options.priority] ?? 1;
  const nearest = nearestLocation(chain, origin);
  const distance = tripDistance(nearest.straight, options.drive.roadFactor);
  const drive = round2(fuelCost(distance.roundTrip, options.drive));
  const departments = emptyDepartments();
  const priced = [];
  const missing = [];
  let shelfCents = 0;
  let qualityCents = 0;
  let ads = 0;
  let cards = 0;
  let yours = 0;

  for (const line of lines) {
    const entry = itemById[line.itemId];
    if (!entry) continue;
    const quote = quoteUnit(line.itemId, chain.id, line.tier, options);
    if (!quote) {
      missing.push({ itemId: line.itemId, name: entry.name, tier: line.tier, qty: line.qty });
      continue;
    }
    const lineShelf = round2(quote.price * line.qty);
    const point = chain.quality[entry.department] || 0;
    const lineQuality = round2(-point * lineShelf * QUALITY_RATE * weight);
    shelfCents += cents(lineShelf);
    qualityCents += cents(lineQuality);
    departments[entry.department].shelf = round2(departments[entry.department].shelf + lineShelf);
    departments[entry.department].quality = round2(departments[entry.department].quality + lineQuality);
    if (quote.source === "ad") ads += 1;
    if (quote.source === "card") cards += 1;
    if (quote.source === "yours") yours += 1;
    priced.push({
      itemId: line.itemId,
      name: entry.name,
      qty: line.qty,
      tier: line.tier,
      department: entry.department,
      unit: quote.price,
      source: quote.source,
      lineShelf,
      lineQuality,
    });
  }

  const shelf = fromCents(shelfCents);
  const quality = fromCents(qualityCents);
  const allIn = fromCents(cents(shelf) + cents(drive) + cents(quality));

  return {
    id: chain.id,
    name: chain.name,
    complete: missing.length === 0 && priced.length > 0,
    missing,
    priced,
    departments,
    nearest,
    distance,
    shelf,
    drive,
    quality,
    allIn,
    ads,
    cards,
    yours,
    qualityScores: chain.quality,
    qualityNote: chain.qualityNote,
  };
}

function assignCost(quote, qty, chain, department, weight) {
  const shelf = round2(quote.price * qty);
  const point = chain.quality[department] || 0;
  const quality = round2(-point * shelf * QUALITY_RATE * weight);
  return { shelf, quality, score: shelf + quality };
}

function scorePair(left, right, lines, options, origin) {
  const weight = QUALITY_WEIGHT[options.priority] ?? 1;
  const groups = {
    [left.id]: [],
    [right.id]: [],
  };
  let shelfCents = 0;
  let qualityCents = 0;

  for (const line of lines) {
    const entry = itemById[line.itemId];
    if (!entry) continue;
    const leftQuote = quoteUnit(line.itemId, left.id, line.tier, options);
    const rightQuote = quoteUnit(line.itemId, right.id, line.tier, options);
    if (!leftQuote && !rightQuote) return null;

    let pick = left;
    let quote = leftQuote;
    if (!leftQuote) {
      pick = right;
      quote = rightQuote;
    } else if (rightQuote) {
      const leftCost = assignCost(leftQuote, line.qty, left, entry.department, weight);
      const rightCost = assignCost(rightQuote, line.qty, right, entry.department, weight);
      if (rightCost.score < leftCost.score - 0.001) {
        pick = right;
        quote = rightQuote;
      } else if (Math.abs(rightCost.score - leftCost.score) <= 0.001) {
        const leftDrive = fuelCost(tripDistance(nearestLocation(left, origin).straight, options.drive.roadFactor).roundTrip, options.drive);
        const rightDrive = fuelCost(tripDistance(nearestLocation(right, origin).straight, options.drive.roadFactor).roundTrip, options.drive);
        if (rightDrive < leftDrive) {
          pick = right;
          quote = rightQuote;
        }
      }
    }

    const cost = assignCost(quote, line.qty, pick, entry.department, weight);
    shelfCents += cents(cost.shelf);
    qualityCents += cents(cost.quality);
    groups[pick.id].push({ itemId: line.itemId, name: entry.name, qty: line.qty });
  }

  if (groups[left.id].length === 0 || groups[right.id].length === 0) return null;

  const leftTrip = tripDistance(nearestLocation(left, origin).straight, options.drive.roadFactor);
  const rightTrip = tripDistance(nearestLocation(right, origin).straight, options.drive.roadFactor);
  const drive = round2(fuelCost(leftTrip.roundTrip, options.drive) + fuelCost(rightTrip.roundTrip, options.drive));
  const shelf = fromCents(shelfCents);
  const quality = fromCents(qualityCents);
  const allIn = fromCents(cents(shelf) + cents(drive) + cents(quality));

  return {
    ids: [left.id, right.id],
    names: [left.name, right.name],
    groups: [
      { id: left.id, name: left.name, items: groups[left.id], nearest: nearestLocation(left, origin), distance: leftTrip },
      { id: right.id, name: right.name, items: groups[right.id], nearest: nearestLocation(right, origin), distance: rightTrip },
    ],
    shelf,
    drive,
    quality,
    allIn,
  };
}

function bestSplit(lines, options, origin) {
  let best = null;
  for (let i = 0; i < chains.length; i += 1) {
    for (let j = i + 1; j < chains.length; j += 1) {
      const pair = scorePair(chains[i], chains[j], lines, options, origin);
      if (!pair) continue;
      if (!best || pair.allIn < best.allIn) best = pair;
    }
  }
  return best;
}

export function scoreTrip(options) {
  const lines = options.lines || [];
  const origin = options.origin;
  if (!lines.length || !origin) {
    return { stores: [], winner: null, runnerUp: null, priciest: null, split: null };
  }

  const stores = chains.map((chain) => scoreChain(chain, lines, options, origin));
  stores.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (a.allIn !== b.allIn) return a.allIn - b.allIn;
    return a.name.localeCompare(b.name);
  });

  const complete = stores.filter((store) => store.complete);
  const winner = complete[0] || null;
  const runnerUp = complete[1] || null;
  const priciest = complete.length ? complete[complete.length - 1] : null;
  const pair = lines.length ? bestSplit(lines, options, origin) : null;

  let split = null;
  if (pair && winner) {
    const net = fromCents(cents(winner.allIn) - cents(pair.allIn));
    split = {
      ...pair,
      net,
      worthIt: net >= SPLIT_MIN_SAVE,
      shelfSave: fromCents(cents(winner.shelf) - cents(pair.shelf)),
      extraDrive: fromCents(cents(pair.drive) - cents(winner.drive)),
      qualityDelta: fromCents(cents(pair.quality) - cents(winner.quality)),
    };
  }

  return { stores, winner, runnerUp, priciest, split };
}

export function qualityWord(score) {
  if (score >= 2) return "well above typical";
  if (score === 1) return "above typical";
  if (score === 0) return "typical";
  if (score === -1) return "below typical";
  return "well below typical";
}
