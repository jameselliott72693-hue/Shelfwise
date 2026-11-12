/**
 * Optional Shelfwise worker. Holds the EIA key and the Instacart key,
 * and stores anonymous shelf reports. The static site works without it.
 *
 * The price pool is one Durable Object, so rate-limit checks and pool
 * writes run one at a time. KV only caches the last EIA week, where a
 * last write is the latest week.
 */
import { GAS_FALLBACK, GAS_SERIES } from "../../data/gas.js";
import { parseEiaPayload } from "../../js/gas.js";
import { instacartLinkUrl } from "../../js/links.js";
import {
  aggregateReports,
  DAILY_REPORT_LIMIT,
  REPORT_MAX_BATCH,
  trimReports,
  validateReport,
  withinDailyLimit,
} from "../../js/pool.js";

const GAS_TTL_MS = 6 * 60 * 60 * 1000;
const INSTACART_HOSTS = new Set(["connect.instacart.com", "connect.dev.instacart.tools"]);
const locks = new WeakMap();

export default {
  async fetch(request, env) {
    return handle(request, env || {});
  },
};

export class PricePool {
  constructor(state) {
    this.storage = state.storage;
  }

  fetch(request) {
    return pricePoolFetch(request, this.storage);
  }
}

export async function handle(request, env = {}) {
  try {
    return await route(request, env);
  } catch {
    return json({ error: "server" }, 500, request, env);
  }
}

async function route(request, env) {
  const cors = originDecision(request, env);
  if (request.method === "OPTIONS") {
    if (!cors.allow) return json({ error: "origin" }, 403, request, env);
    return new Response(null, { status: 204, headers: corsHeaders(cors) });
  }
  if (!cors.allow) return json({ error: "origin" }, 403, request, env);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "GET" && path === "/health") return health(request, env);
  if (request.method === "GET" && path === "/gas") return gas(request, env);
  if (request.method === "GET" && path === "/prices") return prices(request, env);
  if (request.method === "POST" && path === "/prices") return savePrices(request, env);
  if (request.method === "POST" && path === "/instacart/list") return instacartList(request, env);
  return json({ error: "not_found" }, 404, request, env);
}

function health(request, env) {
  return json({
    ok: true,
    gas: Boolean(env.EIA_API_KEY),
    instacart: Boolean(env.INSTACART_API_KEY),
    pool: Boolean(env.POOL),
  }, 200, request, env);
}

async function gas(request, env) {
  if (!env.EIA_API_KEY) return json({ error: "eia_unconfigured" }, 503, request, env);
  const cached = await readGas(env);
  if (cached && Date.now() - Date.parse(cached.fetchedAt || 0) < GAS_TTL_MS) {
    return json({ ...cached, stale: false }, 200, request, env);
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
    return json(payload, 200, request, env);
  } catch {
    if (cached) return json({ ...cached, stale: true }, 200, request, env);
    return json({ error: "eia_unavailable" }, 502, request, env);
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

async function prices(request, env) {
  if (!env.POOL) return json({ error: "pool_unconfigured" }, 503, request, env);
  const today = utcDay();
  const stored = await poolSend(env, "GET", { today });
  if (!stored.ok) return json({ error: "pool" }, 502, request, env);
  return json({ prices: aggregateReports(stored.reports, today), asOf: today }, 200, request, env);
}

async function savePrices(request, env) {
  if (!env.POOL) return json({ error: "pool_unconfigured" }, 503, request, env);
  const body = await readBody(request, env);
  if (!body.ok) return body.response;
  if (body.value?.consent !== true) return json({ error: "consent" }, 400, request, env);
  const session = String(body.value?.session || "");
  if (!/^[a-zA-Z0-9]{16,64}$/.test(session)) return json({ error: "session" }, 400, request, env);
  const incoming = body.value?.reports;
  if (!Array.isArray(incoming) || !incoming.length || incoming.length > REPORT_MAX_BATCH) {
    return json({ error: "reports" }, 400, request, env);
  }
  const today = utcDay();
  const cleaned = [];
  for (let index = 0; index < incoming.length; index += 1) {
    const result = validateReport({ ...incoming[index], session }, today);
    if (!result.ok) return json({ error: result.error, index }, 400, request, env);
    cleaned.push(result.report);
  }
  const stored = await poolSend(env, "POST", {
    today,
    reports: cleaned,
    rateKey: await rateKey(request),
    limit: DAILY_REPORT_LIMIT,
  });
  if (stored.status === 429) return json({ error: "rate_limit" }, 429, request, env);
  if (!stored.ok) return json({ error: "pool" }, 502, request, env);
  return json({
    saved: cleaned.length,
    prices: aggregateReports(stored.reports, today),
  }, 200, request, env);
}

async function poolSend(env, method, payload) {
  const stub = env.POOL.get(env.POOL.idFromName("shelfwise"));
  const response = await stub.fetch("https://pool.internal/prices", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, reports: body.reports || [] };
}

export async function pricePoolFetch(request, storage) {
  return withLock(storage, async () => {
    if (request.method === "GET") {
      const reports = (await storage.get("reports")) || [];
      return Response.json({ reports });
    }
    const body = await request.json();
    const incoming = Array.isArray(body.reports) ? body.reports : [];
    const today = String(body.today || new Date().toISOString().slice(0, 10));
    const rateKey = `rl:${body.rateKey || "anon"}`;
    const count = Number(await storage.get(rateKey)) || 0;
    if (!withinDailyLimit(count, incoming.length, body.limit || DAILY_REPORT_LIMIT)) {
      return Response.json({ error: "rate_limit" }, { status: 429 });
    }
    const existing = (await storage.get("reports")) || [];
    const reports = trimReports([...existing, ...incoming], today);
    await storage.put("reports", reports);
    await storage.put(rateKey, count + incoming.length);
    return Response.json({ reports, saved: incoming.length });
  });
}

function withLock(storage, fn) {
  const previous = locks.get(storage) || Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  locks.set(storage, run.catch(() => {}));
  return run;
}

async function instacartList(request, env) {
  if (!env.INSTACART_API_KEY) return json({ error: "instacart_unconfigured" }, 503, request, env);
  const endpoint = instacartEndpoint(env);
  if (!endpoint) return json({ error: "instacart_base" }, 500, request, env);
  const body = await readBody(request, env);
  if (!body.ok) return body.response;
  const lines = Array.isArray(body.value?.lines) ? body.value.lines.slice(0, 80) : [];
  if (!lines.length) return json({ error: "lines" }, 400, request, env);
  const lineItems = [];
  for (const line of lines) {
    const name = String(line?.name || "").trim().slice(0, 140);
    const display = String(line?.display || name).trim().slice(0, 140);
    const quantity = Math.min(99, Math.max(1, Math.round(Number(line?.quantity) || 1)));
    if (!name) return json({ error: "line_name" }, 400, request, env);
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
  if (!response.ok) return json({ error: "instacart_failed" }, 502, request, env);
  const result = await response.json().catch(() => null);
  const url = instacartLinkUrl(result?.products_link_url);
  if (!url) return json({ error: "instacart_failed" }, 502, request, env);
  return json({ url }, 200, request, env);
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

async function readBody(request, env) {
  const text = await request.text();
  if (text.length > 20000) return { ok: false, response: json({ error: "too_large" }, 413, request, env) };
  try {
    return { ok: true, value: JSON.parse(text || "{}") };
  } catch {
    return { ok: false, response: json({ error: "json" }, 400, request, env) };
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

async function rateKey(request) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const day = utcDay();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${day}|shelfwise`));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${day}:${hex.slice(0, 20)}`;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export function originDecision(request, env = {}) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return { origin: "", allow: true, browser: false };
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  return { origin, allow: allowed.includes(origin), browser: true };
}

function corsHeaders(cors) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (cors?.allow && cors.browser) headers["Access-Control-Allow-Origin"] = cors.origin;
  return headers;
}

function json(data, status, request, env) {
  const cors = request ? originDecision(request, env || {}) : { allow: false, browser: false };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(cors), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
