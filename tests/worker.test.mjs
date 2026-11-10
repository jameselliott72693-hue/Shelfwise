import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/src/index.js";

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

function post(path, body, headers = {}) {
  return new Request(`https://shelfwise.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("health reports which secrets are present and never echoes them", async () => {
  const response = await handle(new Request("https://shelfwise.test/health"), {
    EIA_API_KEY: "secret-eia",
    SHELFWISE: memoryKv(),
  });
  const body = await response.json();
  assert.equal(body.gas, true);
  assert.equal(body.instacart, false);
  assert.equal(body.pool, true);
  assert.equal(JSON.stringify(body).includes("secret-eia"), false);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

describe("outbound calls", { concurrency: false }, () => {
test("gas uses the EIA payload and serves the last saved week when EIA fails", async () => {
  const kv = memoryKv();
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    response: { data: [{ period: "2026-11-09", value: "3.712", series: "EMM_EPMR_PTE_R1Z_DPG" }] },
  }), { status: 200 });
  try {
    const live = await handle(new Request("https://shelfwise.test/gas"), { EIA_API_KEY: "k", SHELFWISE: kv });
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
    const cached = await handle(new Request("https://shelfwise.test/gas"), { EIA_API_KEY: "k", SHELFWISE: kv });
    const body = await cached.json();
    assert.equal(body.price, 3.712);
    assert.equal(body.stale, true);
  } finally {
    globalThis.fetch = original;
  }
  const missing = await handle(new Request("https://shelfwise.test/gas"), { SHELFWISE: kv });
  assert.equal(missing.status, 503);
});

test("price posts are validated, rate limited, and returned as medians", async () => {
  const kv = memoryKv();
  const env = { SHELFWISE: kv };
  const first = await handle(post("/prices", {
    reports: [
      { storeId: "aldi", itemId: "milk", tier: "store", price: 2.7, date: new Date().toISOString().slice(0, 10), town: "greensboro" },
      { storeId: "aldi", itemId: "milk", tier: "store", price: 2.9, date: new Date().toISOString().slice(0, 10), town: "greensboro" },
    ],
  }), env);
  assert.equal(first.status, 200);
  const saved = await first.json();
  const region = saved.prices.find((row) => row.itemId === "milk" && row.town == null);
  assert.equal(region.price, 2.8);
  assert.equal(region.n, 2);
  const bad = await handle(post("/prices", {
    reports: [{ storeId: "aldi", itemId: "milk", tier: "store", price: 900, date: "2026-11-10", town: "" }],
  }), env);
  assert.equal(bad.status, 400);
  const flood = [];
  for (let i = 0; i < 40; i += 1) {
    flood.push({ storeId: "lidl", itemId: "bread", tier: "store", price: 1.5, date: new Date().toISOString().slice(0, 10), town: "" });
  }
  const limited = await handle(post("/prices", { reports: flood }), env);
  assert.equal(limited.status, 429);
});

test("Instacart list creation stays on the official host and falls back when no key is set", async () => {
  const original = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, options) => {
    seen = { url: String(url), body: JSON.parse(options.body), auth: options.headers.Authorization };
    return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping_lists/demo" }), { status: 200 });
  };
  try {
    const response = await handle(post("/instacart/list", {
      title: "Week",
      linkback: "https://example.github.io/shelfwise/",
      lines: [{ name: "Whole milk 1 gal", quantity: 2, display: "Whole milk" }],
    }), { INSTACART_API_KEY: "test-key", INSTACART_API_BASE: "https://evil.example/steal" });
    assert.equal(response.status, 500);
    assert.equal(seen, null);
    const ok = await handle(post("/instacart/list", {
      title: "Week",
      linkback: "https://example.github.io/shelfwise/",
      lines: [{ name: "Whole milk 1 gal", quantity: 2, display: "Whole milk" }],
    }), { INSTACART_API_KEY: "test-key" });
    const body = await ok.json();
    assert.equal(body.url, "https://www.instacart.com/store/shopping_lists/demo");
    assert.equal(seen.auth, "Bearer test-key");
    assert.equal(seen.url, "https://connect.instacart.com/idp/v1/products/products_link");
    assert.equal(seen.body.line_items[0].quantity, 2);
    assert.equal(seen.body.link_type, "shopping_list");
    assert.equal(seen.body.landing_page_configuration.partner_linkback_url, "https://example.github.io/shelfwise/");
  } finally {
    globalThis.fetch = original;
  }
  const missing = await handle(post("/instacart/list", { lines: [{ name: "Milk", quantity: 1 }] }), {});
  assert.equal(missing.status, 503);
});
});
