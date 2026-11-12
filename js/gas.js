import { GAS_FALLBACK, GAS_SERIES } from "../data/gas.js";

export function roundGas(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function parseEiaPayload(payload) {
  const rows = payload?.response?.data;
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[0];
  const price = Number(row.value ?? row.price);
  const period = String(row.period || "");
  if (!Number.isFinite(price) || price <= 0 || price > 20) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return null;
  return {
    price: roundGas(price),
    period,
    series: row.series || GAS_SERIES,
    region: "Lower Atlantic (PADD 1C)",
    product: "Regular gasoline, all formulations",
    units: "dollars per gallon",
    sourceName: "U.S. Energy Information Administration",
    sourceUrl: GAS_FALLBACK.sourceUrl,
  };
}

function publishedGas(live, fallback) {
  const price = Number(live?.price);
  const period = String(live?.period || "");
  const usable = Number.isFinite(price)
    && price > 0
    && price <= 20
    && /^\d{4}-\d{2}-\d{2}$/.test(period)
    && period >= fallback.period;
  if (!usable) return { ...fallback, live: false };
  return {
    price: roundGas(price),
    period,
    label: live.label || fallback.label,
    region: live.region || fallback.region,
    product: live.product || fallback.product,
    sourceName: live.sourceName || fallback.sourceName,
    sourceUrl: live.sourceUrl || fallback.sourceUrl,
    series: live.series || fallback.series,
    released: live.released || "",
    note: live.note || fallback.note,
    live: true,
  };
}

/**
 * Pump override wins. Otherwise the newest EIA week we have, which is the
 * worker response when it is newer than the bundled week, else the bundle.
 */
export function effectiveGas({ pumpPrice, live, fallback = GAS_FALLBACK } = {}) {
  const pump = Number(pumpPrice);
  if (pumpPrice != null && pumpPrice !== "" && Number.isFinite(pump) && pump >= 0 && pump <= 20) {
    return {
      price: roundGas(pump),
      source: "pump",
      period: null,
      label: "Price you paid at the pump",
      region: fallback.region,
      product: fallback.product,
      sourceName: "Your pump price",
      sourceUrl: "",
      live: false,
      bundled: false,
    };
  }
  const published = publishedGas(live, fallback);
  return {
    price: published.price,
    source: "eia",
    period: published.period,
    label: published.label,
    region: published.region,
    product: published.product,
    sourceName: published.sourceName,
    sourceUrl: published.sourceUrl,
    series: published.series,
    released: published.released,
    note: published.note,
    live: Boolean(published.live),
    bundled: !published.live,
  };
}
