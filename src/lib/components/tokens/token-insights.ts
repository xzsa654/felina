import type {
  AgentBreakdown,
  HourlyHeatmapEntry,
  ModelBreakdown,
  TokenAnalytics,
  TokenBucket,
} from "$lib/types";

export type DataResolutionKind = "empty" | "aggregate" | "dated" | "hourly";

export interface DataResolution {
  kind: DataResolutionKind;
  hasDatedBuckets: boolean;
  hasHourlyBuckets: boolean;
  aggregateOnly: boolean;
  bucketCount: number;
  datedBucketCount: number;
}

export interface TokenComposition {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  total: number;
}

export interface TopModelInsight extends TokenComposition {
  model: string;
  provider: string;
  agent: string;
  estimatedCostUsd: number;
  eventCount: number;
  cacheReadRatio: number;
}

const DATED_LABEL_RE = /^\d{4}-\d{2}-\d{2}/;

export function totalTokensForBucket(bucket: TokenBucket): number {
  return (
    bucket.input_tokens +
    bucket.output_tokens +
    bucket.cache_read_tokens +
    bucket.cache_write_tokens +
    bucket.reasoning_tokens
  );
}

export function totalTokensForModel(model: ModelBreakdown): number {
  return (
    model.input_tokens +
    model.output_tokens +
    model.cache_read_tokens +
    model.cache_write_tokens +
    model.reasoning_tokens
  );
}

export function totalTokensForAgent(agent: AgentBreakdown): number {
  return (
    agent.input_tokens +
    agent.output_tokens +
    agent.cache_read_tokens +
    agent.cache_write_tokens +
    agent.reasoning_tokens
  );
}

export function getTokenComposition(analytics: TokenAnalytics | null): TokenComposition {
  if (!analytics) {
    return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
      total: 0,
    };
  }

  const input = analytics.total_input_tokens;
  const output = analytics.total_output_tokens;
  const cacheRead = analytics.total_cache_read_tokens;
  const cacheWrite = analytics.total_cache_write_tokens;
  const reasoning = analytics.total_reasoning_tokens;

  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning,
    total: input + output + cacheRead + cacheWrite + reasoning,
  };
}

export function cacheReadRatio(composition: TokenComposition): number {
  return composition.total > 0 ? composition.cacheRead / composition.total : 0;
}

export function classifyDataResolution(
  timeSeries: TokenBucket[] = [],
  hourlyHeatmap: HourlyHeatmapEntry[] = [],
): DataResolution {
  const datedBucketCount = timeSeries.filter((bucket) =>
    DATED_LABEL_RE.test(bucket.label),
  ).length;
  const hasDatedBuckets = datedBucketCount > 0;
  const hasHourlyBuckets = hourlyHeatmap.length > 0;
  const aggregateOnly =
    timeSeries.length > 0 &&
    datedBucketCount === 0 &&
    timeSeries.every((bucket) => bucket.label === "all");

  let kind: DataResolutionKind = "empty";
  if (hasHourlyBuckets) kind = "hourly";
  else if (hasDatedBuckets) kind = "dated";
  else if (aggregateOnly) kind = "aggregate";

  return {
    kind,
    hasDatedBuckets,
    hasHourlyBuckets,
    aggregateOnly,
    bucketCount: timeSeries.length,
    datedBucketCount,
  };
}

export function getTopModelInsights(data: ModelBreakdown[]): TopModelInsight[] {
  return data
    .map((model) => {
      const total = totalTokensForModel(model);
      return {
        model: model.model,
        provider: model.provider,
        agent: model.agent,
        input: model.input_tokens,
        output: model.output_tokens,
        cacheRead: model.cache_read_tokens,
        cacheWrite: model.cache_write_tokens,
        reasoning: model.reasoning_tokens,
        total,
        estimatedCostUsd: model.cost_usd,
        eventCount: model.event_count,
        cacheReadRatio: total > 0 ? model.cache_read_tokens / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total || b.estimatedCostUsd - a.estimatedCostUsd);
}
