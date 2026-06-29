import assert from "node:assert/strict";
import test from "node:test";

import { buildSchedulerJesseContext } from "../src/lib/components/tokens/components/QuotaWindowSchedulerPanel.tsx";

test("scheduler Jesse context uses the live edited draft instead of stale query data", () => {
  const context = buildSchedulerJesseContext({
    title: "流量到期日控制",
    stored: {
      enabled: false,
      time: "09:00",
      message: "old prompt",
    },
    draft: {
      enabled: true,
      time: "07:00",
      message: "new prompt for Jesse",
    },
    lastResult: null,
  });

  assert.equal(context.metrics.time, "07:00");
  assert.equal(context.metrics.enabled, true);
  assert.equal(context.metrics.message, "new prompt for Jesse");
  assert.equal(context.metrics.messageLength, "new prompt for Jesse".length);
  assert.equal(context.metrics.hasUnsavedChanges, true);
  assert.match(context.summary, /07:00/);
  assert.doesNotMatch(context.summary, /09:00/);
});

test("scheduler Jesse context includes a concrete quota-window example from the edited time", () => {
  const context = buildSchedulerJesseContext({
    title: "流量到期日控制",
    stored: {
      enabled: false,
      time: "09:00",
      message: "old prompt",
    },
    draft: {
      enabled: true,
      time: "07:00",
      message: "請幫我用白話摘要 token 狀態",
    },
    lastResult: null,
  });

  assert.match(context.summary, /first scheduled Claude Code message/i);
  assert.match(context.summary, /quota-management message/i);
  assert.match(context.summary, /quota\/billing window/i);
  assert.match(context.summary, /07:00/);
  assert.match(context.summary, /12:00/);
  assert.equal(context.metrics.windowHours, 5);
  assert.equal(context.metrics.exampleFirstMessageAt, "07:00");
  assert.equal(context.metrics.exampleResetAt, "12:00");
  assert.match(String(context.metrics.example), /07:00/);
  assert.match(String(context.metrics.example), /12:00/);
});

test("scheduler Jesse context example wraps reset time across midnight", () => {
  const context = buildSchedulerJesseContext({
    title: "流量到期日控制",
    stored: {
      enabled: false,
      time: "09:00",
      message: "old prompt",
    },
    draft: {
      enabled: true,
      time: "22:30",
      message: "請幫我用白話摘要 token 狀態",
    },
    lastResult: null,
  });

  assert.equal(context.metrics.exampleFirstMessageAt, "22:30");
  assert.equal(context.metrics.exampleResetAt, "03:30");
  assert.match(context.summary, /22:30/);
  assert.match(context.summary, /03:30/);
});
