import assert from "node:assert/strict";
import test from "node:test";

import { nextHistoryPageOffset } from "../src/lib/components/history/hooks/useHistoryQueries.ts";

test("empty list with total 0 has no next page", () => {
  assert.equal(nextHistoryPageOffset(0, 0), undefined);
});

test("loadedCount < total returns loadedCount as next offset", () => {
  assert.equal(nextHistoryPageOffset(50, 120), 50);
});

test("loadedCount === total has no next page", () => {
  assert.equal(nextHistoryPageOffset(120, 120), undefined);
});

test("total smaller than one page has no next page", () => {
  assert.equal(nextHistoryPageOffset(7, 7), undefined);
});
