import assert from "node:assert/strict";
import test from "node:test";

import type { ModelBreakdown, TokenBucket } from "../src/lib/types/index.ts";
import {
  buildContributionGraphJesseContext,
} from "../src/lib/components/tokens/components/ContributionGraph.tsx";
import {
  buildModelBreakdownChartJesseContext,
} from "../src/lib/components/tokens/components/ModelBreakdownChart.tsx";
import {
  buildTokenCostTimeSeriesJesseContext,
} from "../src/lib/components/tokens/components/TokenCostTimeSeries.tsx";
import {
  buildTokenTimeSeriesJesseContext,
} from "../src/lib/components/tokens/components/TokenTimeSeries.tsx";

function bucket(label: string, tokens: number): TokenBucket {
  return {
    label,
    input_tokens: tokens,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    reasoning_tokens: 0,
    cost_usd: tokens / 1000,
    event_count: tokens > 0 ? 1 : 0,
    agent_count: tokens > 0 ? 1 : 0,
    model_count: tokens > 0 ? 1 : 0,
  };
}

test("contribution graph Jesse context counts calendar gaps as inactive days", () => {
  const context = buildContributionGraphJesseContext({
    data: [
      bucket("2026-06-01", 100),
      bucket("2026-06-05", 200),
    ],
    locale: "zh-TW",
    title: "每日活動",
  });

  assert.ok(context);
  assert.equal(context.metrics.activeDays, 2);
  assert.equal(context.metrics.totalDays, 5);
  assert.equal(context.metrics.inactiveDays, 3);
  assert.match(context.summary, /2 active days across 5 calendar days/);
  assert.doesNotMatch(context.summary, /every day/i);
  assert.match(String(context.metrics.howToRead), /Each square is one calendar day/);
});

test("token cache time-series Jesse context explains how to read stacked cache lines", () => {
  const context = buildTokenTimeSeriesJesseContext({
    data: [
      bucket("2026-06-01", 100),
      { ...bucket("2026-06-02", 200), cache_read_tokens: 80, cache_write_tokens: 20 },
    ],
    locale: "zh-TW",
    title: "Token 使用趨勢",
  });

  assert.equal(context.metrics.chartType, "stacked token time series");
  assert.match(context.summary, /How to read/);
  assert.match(String(context.metrics.howToRead), /x-axis/i);
  assert.match(String(context.metrics.howToRead), /cache read/i);
  assert.match(String(context.metrics.howToRead), /cache write/i);
});

test("cost and model chart Jesse contexts include chart reading guidance", () => {
  const costContext = buildTokenCostTimeSeriesJesseContext({
    data: [bucket("2026-06-01", 100), bucket("2026-06-02", 200)],
    locale: "zh-TW",
    title: "成本趨勢",
  });
  assert.equal(costContext.metrics.chartType, "cost time series");
  assert.match(String(costContext.metrics.howToRead), /x-axis/i);
  assert.match(String(costContext.metrics.howToRead), /y-axis/i);

  const model: ModelBreakdown = {
    model: "claude-sonnet-4",
    provider: "anthropic",
    agent: "claude-code",
    input_tokens: 100,
    output_tokens: 20,
    cache_read_tokens: 30,
    cache_write_tokens: 10,
    reasoning_tokens: 0,
    cost_usd: 1.25,
    event_count: 3,
    max_input_tokens: null,
  };
  const modelContext = buildModelBreakdownChartJesseContext({
    data: [model],
    locale: "zh-TW",
    title: "模型成本排行",
  });
  assert.equal(modelContext.metrics?.chartType, "model cost ranking bar chart");
  assert.match(String(modelContext.metrics?.howToRead), /longer bars/i);
});
