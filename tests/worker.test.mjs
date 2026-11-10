import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { handle, pricePoolFetch } from "../worker/src/index.js";
import { instacartLinkUrl } from "../js/links.js";

const ORIGIN = "https://shelfwise.test";
const SESSION_A = "aaaaaaaaaaaaaaaa";
const SESSION_B = "bbbbbbbbbbbbbbbb";

function memoryKv(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
  };
}

function memoryStorage() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : undefined;
    },
    async put(key, value) {
      map.set(key, value);
    },
  };
}

function poolBinding(storage) {
  return {
    idFromName() {
      return "shelfwise";
    },
    get() {
      return {
        fetch(input, init) {
          const request = input instanceof Request ? input : new Request(input, init);
          return pricePoolFetch(request, storage);
        },
      };
    },
  };
}

function baseEnv(extra = {}) {
  const storage = extra.storage || memoryStorage();
  return {
    ALLOWED_ORIGINS: ORIGIN,
    POOL: poolBinding(storage),
    SHELFWISE: extra.SHELFWISE || memoryKv(),
    ...extra,
    storage,
    POOL: extra.POOL || poolBinding(storage),
  };
}

function post(path, body, headers = {}) {
  return new Request(`https://shelfwise.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function priceReport(price, session = SESSION_A, itemId = "milk") {
  return {
    storeId: "aldi",
    itemId,
    tier: "store",
    price,
    date: today(),
    town: "greensboro",
    session,
  };
}

test("health hides secrets and only echoes an allowed origin", async () => {
  const response = await handle(new Request("https://shelfwise.test/health", {
    headers: { Origin: ORIGIN },
  }), {
    EIA_API_KEY: "secret-eia",
    ALLOWED_ORIGINS: ORIGIN,
    POOL: poolBinding(memoryStorage()),
  });
  const body = await response.json();
  assert.equal(body.gas, true);
  assert.equal(body.instacart, false);
  assert.equal(body.pool, true);
  assert.equal(JSON.stringify(body).includes("secret-eia"), false);
  assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
  const blocked = await handle(new Request("https://shelfwise.test/health", {
    headers: { Origin: "https://evil.example" },
  }), { ALLOWED_ORIGINS: ORIGIN });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
});

describe("outbound calls", { concurrency: false }, () => {
test("gas uses the EIA payload and serves the last saved week when EIA fails", async () => {
  const kv = memoryKv();
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    response: { data: [{ period: "2026-11-09", value: "3.712", series: "EMM_EPMR_PTE_R1Z_DPG" }] },
  }), { status: 200 });
  try {
    const live = await handle(new Request("https://shelfwise.test/gas"), { EIA_API_KEY: "k", SHELFWISE: kv, ALLOWED_ORIGINS: ORIGIN });
    const body = await live.json();
    assert.equal(body.price, 3.712);
    assert.equal(body.period, "2026-11-09");
    assert.equal(body.stale, false);
    const saved = JSON.parse(await kv.get("gas:last"));
    saved.fetchedAt = "2020-01-01T00:00:00.000Z";
    await kv.put("gas:last", JSON.stringify(saved));
  } finally {
    globalThis.fetch = original;
  }
  globalThis.fetch = async () => { throw new Error("down"); };
  try {
    const cached = await handle(new Request("https://shelfwise.test/gas"), { EIA_API_KEY: "k", SHELFWISE: kv, ALLOWED_ORIGINS: ORIGIN });
    const body = await cached.json();
    assert.equal(body.price, 3.712);
    assert.equal(body.stale, true);
  } finally {
    globalThis.fetch = original;
  }
  const missing = await handle(new Request("https://shelfwise.test/gas"), { SHELFWISE: kv, ALLOWED_ORIGINS: ORIGIN });
  assert.equal(missing.status, 503);
});

test("price posts require consent, keep two shoppers, and rate limit", async () => {
  const env = baseEnv();
  const denied = await handle(post("/prices", {
    reports: [priceReport(2.7)],
  }), env);
  assert.equal(denied.status, 400);
  const first = await handle(post("/prices", {
    consent: true,
    session: SESSION_A,
    reports: [priceReport(2.7), priceReport(2.9)],
  }), env);
  assert.equal(first.status, 200);
  const saved = await first.json();
  const region = saved.prices.find((row) => row.itemId === "milk" && row.town == null);
  assert.equal(region.price, 2.8);
  assert.equal(region.n, 2);
  assert.equal(JSON.stringify(saved).includes(SESSION_A), false);
  const bad = await handle(post("/prices", {
    consent: true,
    session: SESSION_A,
    reports: [{ storeId: "aldi", itemId: "milk", tier: "store", price: 900, date: today(), town: "" }],
  }), env);
  assert.equal(bad.status, 400);
  const flood = [];
  for (let i = 0; i < 40; i += 1) flood.push(priceReport(1.5, SESSION_A, "bread"));
  const limited = await handle(post("/prices", { consent: true, session: SESSION_A, reports: flood }), env);
  assert.equal(limited.status, 429);
});

test("two shoppers paying the same price both survive a concurrent submit", async () => {
  const env = baseEnv();
  const [left, right] = await Promise.all([
    handle(post("/prices", { consent: true, session: SESSION_A, reports: [priceReport(2.5)] }), env),
    handle(post("/prices", { consent: true, session: SESSION_B, reports: [priceReport(2.5)] }), env),
  ]);
  assert.equal(left.status, 200);
  assert.equal(right.status, 200);
  const listed = await handle(new Request("https://shelfwise.test/prices", { headers: { Origin: ORIGIN } }), env);
  const body = await listed.json();
  const region = body.prices.find((row) => row.itemId === "milk" && row.town == null);
  assert.equal(region.n, 2);
  assert.equal(region.price, 2.5);
  const again = await handle(post("/prices", { consent: true, session: SESSION_A, reports: [priceReport(2.5)] }), env);
  const repeat = await again.json();
  assert.equal(repeat.prices.find((row) => row.itemId === "milk" && row.town == null).n, 2);
});

test("Instacart list creation stays on the official host and drops a foreign link", async () => {
  const original = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, options) => {
    seen = { url: String(url), body: JSON.parse(options.body), auth: options.headers.Authorization };
    return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping_lists/demo" }), { status: 200 });
  };
  const env = { INSTACART_API_KEY: "test-key", ALLOWED_ORIGINS: ORIGIN };
  try {
    const response = await handle(post("/instacart/list", {
      title: "Week",
      linkback: "https://example.github.io/shelfwise/",
      lines: [{ name: "Whole milk 1 gal", quantity: 2, display: "Whole milk" }],
    }), { ...env, INSTACART_API_BASE: "https://evil.example/steal" });
    assert.equal(response.status, 500);
    assert.equal(seen, null);
    const ok = await handle(post("/instacart/list", {
      title: "Week",
      linkback: "https://example.github.io/shelfwise/",
      lines: [{ name: "Whole milk 1 gal", quantity: 2, display: "Whole milk" }],
    }), env);
    const body = await ok.json();
    assert.equal(body.url, "https://www.instacart.com/store/shopping_lists/demo");
    assert.equal(instacartLinkUrl(body.url), body.url);
    assert.equal(seen.auth, "Bearer test-key");
    assert.equal(seen.url, "https://connect.instacart.com/idp/v1/products/products_link");
    assert.equal(seen.body.line_items[0].quantity, 2);
    assert.equal(seen.body.link_type, "shopping_list");
    globalThis.fetch = async () => new Response(JSON.stringify({
      products_link_url: "https://evil.example/phish",
    }), { status: 200 });
    const phish = await handle(post("/instacart/list", {
      lines: [{ name: "Milk", quantity: 1 }],
    }), env);
    assert.equal(phish.status, 502);
  } finally {
    globalThis.fetch = original;
  }
  const missing = await handle(post("/instacart/list", { lines: [{ name: "Milk", quantity: 1 }] }), { ALLOWED_ORIGINS: ORIGIN });
  assert.equal(missing.status, 503);
});
});
