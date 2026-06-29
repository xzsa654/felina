import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { JesseContextPayload, TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber } from "$lib/utils/format";
import { totalTokensForBucket } from "../token-insights";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

export function buildTokenTimeSeriesJesseContext({
  data,
  locale,
  title,
}: {
  data: TokenBucket[];
  locale: Locale;
  title: string;
}): JesseContextPayload {
  const allScopeOnly = data.length === 1 && data[0].label === "all";
  const totals = data.reduce(
    (acc, bucket) => ({
      inputTokens: acc.inputTokens + bucket.input_tokens,
      outputTokens: acc.outputTokens + bucket.output_tokens,
      cacheReadTokens: acc.cacheReadTokens + bucket.cache_read_tokens,
      cacheWriteTokens: acc.cacheWriteTokens + bucket.cache_write_tokens,
      totalTokens: acc.totalTokens + totalTokensForBucket(bucket),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 },
  );
  const howToRead = allScopeOnly
    ? "This is a single aggregate stacked bar. Each colored segment is a token category; taller total bar means more total tokens."
    : "The x-axis is time and the y-axis is token count. Colored stacked areas show input, output, cache read, and cache write tokens; a taller stack means more total usage in that bucket. Cache read means reused cached context, while cache write means new content written into cache.";

  return {
    kind: "token-overview",
    title,
    source: "tokens.tokenTimeSeries",
    capturedAt: new Date().toISOString(),
    summary: `${title}: ${data.length} buckets with ${formatNumber(totals.totalTokens, locale)} total tokens. How to read: ${howToRead}`,
    metrics: {
      chartType: "stacked token time series",
      howToRead,
      bucketCount: data.length,
      allScopeOnly,
      firstBucket: data[0]?.label ?? null,
      lastBucket: data[data.length - 1]?.label ?? null,
      totalTokens: totals.totalTokens,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
    },
  };
}

export default function TokenTimeSeries({
  data,
  locale,
}: {
  data: TokenBucket[];
  locale: Locale;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          {t(locale, "tokens.tokenTimeSeries.title")}
        </h3>
        <div className="flex items-center justify-center h-64 text-text-muted text-sm">
          {t(locale, "tokens.tokenTimeSeries.empty")}
        </div>
      </div>
    );
  }

  const allScopeOnly = data.length === 1 && data[0].label === "all";
  const title = t(locale, "tokens.tokenTimeSeries.title");
  const dragData = buildJesseContextDragData(
    buildTokenTimeSeriesJesseContext({ data, locale, title }),
  );

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3
        className="mb-3 inline-block cursor-grab text-sm font-medium text-text-secondary active:cursor-grabbing"
        draggable
        onDragStart={(event) => setJesseContextDragData(event.dataTransfer, dragData, title)}
        title="Drag to Jesse"
      >
        {title}
      </h3>
      {allScopeOnly && (
        <p className="text-xs text-text-muted mb-2">
          {t(locale, "tokens.tokenTimeSeries.aggregateOnly")}
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        {allScopeOnly ? (
          <BarChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#71717a" />
            <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend />
            <Bar
              dataKey="input_tokens"
              name={t(locale, "tokens.tokenTimeSeries.input")}
              stackId="tokens"
              fill="#3b82f6"
            />
            <Bar
              dataKey="output_tokens"
              name={t(locale, "tokens.tokenTimeSeries.output")}
              stackId="tokens"
              fill="#22c55e"
            />
            <Bar
              dataKey="cache_read_tokens"
              name={t(locale, "tokens.tokenTimeSeries.cacheRead")}
              stackId="tokens"
              fill="#a855f7"
            />
            <Bar
              dataKey="cache_write_tokens"
              name={t(locale, "tokens.tokenTimeSeries.cacheWrite")}
              stackId="tokens"
              fill="#f59e0b"
            />
          </BarChart>
        ) : (
          <AreaChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#71717a" />
          <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="input_tokens"
            name={t(locale, "tokens.tokenTimeSeries.input")}
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="output_tokens"
            name={t(locale, "tokens.tokenTimeSeries.output")}
            stackId="1"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="cache_read_tokens"
            name={t(locale, "tokens.tokenTimeSeries.cacheRead")}
            stackId="1"
            stroke="#a855f7"
            fill="#a855f7"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="cache_write_tokens"
            name={t(locale, "tokens.tokenTimeSeries.cacheWrite")}
            stackId="1"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.3}
          />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
