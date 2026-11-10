/**
 * Optional Shelfwise worker. Holds the EIA key and the Instacart key,
 * and stores anonymous shelf reports. The static site works without it.
 */
import { GAS_FALLBACK, GAS_SERIES } from "../../data/gas.js";
import { parseEiaPayload } from "../../js/gas.js";
import {
  aggregateReports,
  DAILY_REPORT_LIMIT,
  REPORT_MAX_BATCH,
  trimReports,
  validateReport,
  withinDailyLimit,
} from "../../js/pool.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

const GAS_TTL_MS = 6 * 60 * 60 * 1000;
const INSTACART_HOSTS = new Set(["connect.instacart.com", "connect.dev.instacart.tools"]);

export default {
  async fetch(request, env) {
    return handle(request, env || {});
  },
};

export async function handle(request, env = {}) {
  try {
    return await route(request, env);
  } catch {
    return json({ error: "server" }, 500);
  }
}

async function route(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "GET" && path === "/health") return health(env);
  if (request.method === "GET" && path === "/gas") return gas(env);
  if (request.method === "GET" && path === "/prices") return prices(env);
  if (request.method === "POST" && path === "/prices") return savePrices(request, env);
  if (request.method === "POST" && path === "/instacart/list") return instacartList(request, env);
  return json({ error: "not_found" }, 404);
}

function health(env) {
  return json({
    ok: true,
    gas: Boolean(env.EIA_API_KEY),
    instacart: Boolean(env.INSTACART_API_KEY),
    pool: Boolean(env.SHELFWISE),
  });
}

async function gas(env) {
  if (!env.EIA_API_KEY) return json({ error: "eia_unconfigured" }, 503);
  const cached = await readGas(env);
  if (cached && Date.now() - Date.parse(cached.fetchedAt || 0) < GAS_TTL_MS) {
    return json({ ...cached, stale: false });
  }
  try {
    const response = await fetch(eiaUrl(env.EIA_API_KEY), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("eia");
    const parsed = parseEiaPayload(await response.json());
    if (!parsed) throw new Error("eia");
    const payload = {
      ...parsed,
      label: `Week of ${parsed.period}`,
      fetchedAt: new Date().toISOString(),
      stale: false,
      note: GAS_FALLBACK.note,
    };
    await writeGas(env, payload);
    return json(payload);
  } catch {
    if (cached) return json({ ...cached, stale: true });
    return json({ error: "eia_unavailable" }, 502);
  }
}

function eiaUrl(key) {
  const url = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/");
  url.searchParams.set("api_key", key);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.set("data[0]", "value");
  url.searchParams.set("facets[series][]", GAS_SERIES);
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("length", "1");
  return url;
}

async function prices(env) {
  if (!env.SHELFWISE) return json({ error: "pool_unconfigured" }, 503);
  const today = utcDay();
  const reports = await readPool(env);
  return json({ prices: aggregateReports(reports, today), asOf: today });
}

async function savePrices(request, env) {
  if (!env.SHELFWISE) return json({ error: "pool_unconfigured" }, 503);
  const body = await readBody(request);
  if (!body.ok) return body.response;
  const incoming = body.value?.reports;
  if (!Array.isArray(incoming) || !incoming.length || incoming.length > REPORT_MAX_BATCH) {
    return json({ error: "reports" }, 400);
  }
  const today = utcDay();
  const cleaned = [];
  for (let index = 0; index < incoming.length; index += 1) {
    const result = validateReport(incoming[index], today);
    if (!result.ok) return json({ error: result.error, index }, 400);
    cleaned.push(result.report);
  }
  const limit = await takeRate(env, request, cleaned.length);
  if (!limit.ok) return json({ error: "rate_limit" }, 429);
  const reports = trimReports([...(await readPool(env)), ...cleaned], today);
  await env.SHELFWISE.put("pool:v1", JSON.stringify({ reports }));
  return json({ saved: cleaned.length, prices: aggregateReports(reports, today) });
}

async function instacartList(request, env) {
  if (!env.INSTACART_API_KEY) return json({ error: "instacart_unconfigured" }, 503);
  const endpoint = instacartEndpoint(env);
  if (!endpoint) return json({ error: "instacart_base" }, 500);
  const body = await readBody(request);
  if (!body.ok) return body.response;
  const lines = Array.isArray(body.value?.lines) ? body.value.lines.slice(0, 80) : [];
  if (!lines.length) return json({ error: "lines" }, 400);
  const lineItems = [];
  for (const line of lines) {
    const name = String(line?.name || "").trim().slice(0, 140);
    const display = String(line?.display || name).trim().slice(0, 140);
    const quantity = Math.min(99, Math.max(1, Math.round(Number(line?.quantity) || 1)));
    if (!name) return json({ error: "line_name" }, 400);
    lineItems.push({
      name,
      display_text: display || name,
      quantity,
      unit: "each",
      line_item_measurements: [{ quantity, unit: "each" }],
    });
  }
  const payload = {
    title: String(body.value?.title || "Shelfwise list").slice(0, 80),
    link_type: "shopping_list",
    expires_in: 7,
    instructions: ["Match these items in Instacart before checkout. Shelfwise prices are not Instacart prices."],
    line_items: lineItems,
  };
  const linkback = safeLinkback(body.value?.linkback);
  if (linkback) payload.landing_page_configuration = { partner_linkback_url: linkback };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.INSTACART_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return json({ error: "instacart_failed" }, 502);
  const result = await response.json().catch(() => null);
  if (!result?.products_link_url) return json({ error: "instacart_failed" }, 502);
  return json({ url: result.products_link_url });
}

function instacartEndpoint(env) {
  try {
    const url = new URL(env.INSTACART_API_BASE || "https://connect.instacart.com");
    if (url.protocol !== "https:" || !INSTACART_HOSTS.has(url.host)) return "";
    return `${url.origin}/idp/v1/products/products_link`;
  } catch {
    return "";
  }
}

function safeLinkback(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString().slice(0, 300);
  } catch {
    return "";
  }
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 20000) return { ok: false, response: json({ error: "too_large" }, 413) };
  try {
    return { ok: true, value: JSON.parse(text || "{}") };
  } catch {
    return { ok: false, response: json({ error: "json" }, 400) };
  }
}

async function readPool(env) {
  const raw = await env.SHELFWISE.get("pool:v1");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.reports) ? parsed.reports : [];
  } catch {
    return [];
  }
}

async function readGas(env) {
  if (!env.SHELFWISE) return null;
  const raw = await env.SHELFWISE.get("gas:last");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeGas(env, payload) {
  if (!env.SHELFWISE) return;
  await env.SHELFWISE.put("gas:last", JSON.stringify(payload));
}

async function takeRate(env, request, adding) {
  const bucket = await rateKey(request);
  const current = Number(await env.SHELFWISE.get(bucket)) || 0;
  if (!withinDailyLimit(current, adding, DAILY_REPORT_LIMIT)) return { ok: false };
  await env.SHELFWISE.put(bucket, String(current + adding), { expirationTtl: 60 * 60 * 48 });
  return { ok: true };
}

async function rateKey(request) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const day = utcDay();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${day}|shelfwise`));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `rl:${day}:${hex.slice(0, 20)}`;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
