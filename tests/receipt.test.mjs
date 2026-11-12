import test from "node:test";
import assert from "node:assert/strict";
import { parseReceiptText } from "../js/receipt.js";

const SAMPLE = `
FOOD LION
4548 US Highway 220 N
Summerfield NC
11/08/2026

MILK WHOLE GAL                 3.49
LARGE EGGS                     2.89
BANANAS                        1.77
CHEERIOS                       4.79
TIDE DETERGENT                12.99
2 @ 1.99 STORE BREAD
SUBTOTAL                      27.91
TAX                            0.91
TOTAL                         28.82
VISA                          28.82
`;

test("receipt text finds the store, the date, and shelf lines", () => {
  const parsed = parseReceiptText(SAMPLE);
  assert.equal(parsed.storeId, "foodlion");
  assert.equal(parsed.date, "2026-11-08");
  const byItem = Object.fromEntries(parsed.rows.filter((row) => row.itemId).map((row) => [row.itemId, row]));
  assert.equal(byItem.milk.price, 3.49);
  assert.equal(byItem.milk.tier, "store");
  assert.equal(byItem.eggs.price, 2.89);
  assert.equal(byItem.bananas.price, 1.77);
  assert.equal(byItem.bananas.tier, "store");
  assert.equal(parseReceiptText("ORGANIC BANANAS  2.49").rows[0].tier, "premium");
  assert.equal(byItem.cereal.tier, "name");
  assert.equal(byItem.cereal.price, 4.79);
  assert.equal(byItem.detergent.tier, "name");
  assert.equal(byItem.detergent.price, 12.99);
  assert.equal(byItem.bread.price, 1.99);
  assert.equal(parsed.rows.some((row) => /total/i.test(row.label)), false);
});

test("a name-brand nickname maps to the right tier and unmatched lines stay out", () => {
  const parsed = parseReceiptText("Harris Teeter\nNov 2, 2026\nCOKE 12PK  8.49\nMYSTERY SNACK  1.25\n");
  assert.equal(parsed.storeId, "harristeeter");
  assert.equal(parsed.date, "2026-11-02");
  const coke = parsed.rows.find((row) => row.itemId === "coke");
  assert.equal(coke.tier, "name");
  assert.equal(coke.include, true);
  const mystery = parsed.rows.find((row) => /mystery/i.test(row.label));
  assert.equal(mystery.itemId, "");
  assert.equal(mystery.include, false);
});
