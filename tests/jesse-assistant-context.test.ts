import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJesseContextDragData,
  JESSE_CONTEXT_MIME,
  isJesseContextPayload,
  parseJesseContextDragData,
} from "../src/lib/components/tokens/jesse-context.ts";

test("top-session context preserves the spec example title and source", () => {
  const payload = buildJesseContextDragData({
    kind: "top-session",
    title: "Codex session abc123",
    source: "tokens.topSessions",
    capturedAt: "2026-06-20T12:00:00.000Z",
    summary: "Session consumed 42,000 tokens.",
    metrics: {
      totalTokens: 42000,
      costUsd: 1.23,
    },
  });

  const parsed = parseJesseContextDragData(payload);

  assert.equal(parsed?.kind, "top-session");
  assert.equal(parsed?.title, "Codex session abc123");
  assert.equal(parsed?.source, "tokens.topSessions");
  assert.equal(JESSE_CONTEXT_MIME, "application/x-felina-jesse-context+json");
});

test("invalid drop data is rejected without creating context", () => {
  assert.equal(parseJesseContextDragData("not json"), null);
  assert.equal(parseJesseContextDragData(JSON.stringify({ kind: "unknown" })), null);
  assert.equal(parseJesseContextDragData(JSON.stringify({
    kind: "top-session",
    title: "External",
    source: "other",
    capturedAt: "2026-06-20T12:00:00.000Z",
    summary: "plain object without envelope",
    metrics: {},
  })), null);
  assert.equal(isJesseContextPayload({ kind: "quota-snapshot" }), false);
});

test("model-breakdown rows are bounded before sending to Jesse", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    label: `model-${index}`,
    metrics: { totalTokens: index + 1, nested: { unsafe: true } },
    extra: "not forwarded",
  }));

  const payload = parseJesseContextDragData(
    buildJesseContextDragData({
      kind: "model-breakdown",
      title: "Model breakdown",
      source: "tokens.modelBreakdown",
      capturedAt: "2026-06-20T12:00:00.000Z",
      summary: "Models sorted by cost.",
      rows,
    }),
  );

  assert.equal(payload?.kind, "model-breakdown");
  assert.equal(payload?.rows?.length, 8);
  assert.equal(payload?.rows?.[0].label, "model-0");
  assert.equal(payload?.rows?.[7].label, "model-7");
  assert.deepEqual(payload?.rows?.[0].metrics, { totalTokens: 1 });
  assert.equal("extra" in (payload?.rows?.[0] ?? {}), false);
});
