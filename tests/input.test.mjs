import test from "node:test";
import assert from "node:assert/strict";
import { isPartialNumber, shouldRefreshPriceField } from "../js/input.js";
import { instacartLinkUrl } from "../js/links.js";

test("a paused decimal is not refreshed back to the digits already typed", () => {
  assert.equal(isPartialNumber("3."), true);
  assert.equal(isPartialNumber("."), true);
  assert.equal(shouldRefreshPriceField("3"), true);
  assert.equal(shouldRefreshPriceField("3."), false);
  assert.equal(shouldRefreshPriceField("3.5"), true);
  assert.equal(shouldRefreshPriceField("3.695"), true);
  const typed = ["3", "3."];
  const refresh = typed.map((value) => shouldRefreshPriceField(value));
  assert.deepEqual(refresh, [true, false]);
});

test("Instacart links must be https on an Instacart host", () => {
  assert.equal(
    instacartLinkUrl("https://www.instacart.com/store/shopping_lists/demo"),
    "https://www.instacart.com/store/shopping_lists/demo",
  );
  assert.equal(instacartLinkUrl("http://www.instacart.com/store/shopping_lists/demo"), "");
  assert.equal(instacartLinkUrl("https://evil.example/store"), "");
  assert.equal(instacartLinkUrl("https://instacart.com.evil.example/store"), "");
  assert.equal(instacartLinkUrl("javascript:alert(1)"), "");
});
