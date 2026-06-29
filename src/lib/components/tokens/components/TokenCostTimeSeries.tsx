import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { JesseContextPayload, TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatCostFull } from "$lib/utils/format";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

export function buildTokenCostTimeSeriesJesseContext({
  data,
  locale,
  title,
}: {
  data: TokenBucket[];
  locale: Locale;
  title: string;
}): JesseContextPayload {
  const allScopeOnly = data.length === 1 && data[0].label === "all";
  const totalCost = data.reduce((sum, bucket) => sum + bucket.cost_usd, 0);
  const howToRead = allScopeOnly
    ? "This is a single aggregate bar. The y-axis is estimated USD cost; a taller bar means higher total spend for the selected scope."
    : "The x-axis is time and the y-axis is estimated USD cost. Higher points mean more estimated spend in that bucket; spikes usually mean heavier usage or a more expensive model during that period.";

  return {
    kind: "token-overview",
    title,
    source: "tokens.costTimeSeries",
    capturedAt: new Date().toISOString(),
    summary: `${title}: ${data.length} buckets with ${formatCostFull(totalCost, locale)} estimated cost. How to read: ${howToRead}`,
    metrics: {
      chartType: "cost time series",
      howToRead,
      bucketCount: data.length,
      allScopeOnly,
      firstBucket: data[0]?.label ?? null,
      lastBucket: data[data.length - 1]?.label ?? null,
      totalCostUsd: totalCost,
    },
  };
}

export default function TokenCostTimeSeries({
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
          {t(locale, "tokens.costTimeSeries.title")}
        </h3>
        <div className="flex items-center justify-center h-64 text-text-muted text-sm">
          {t(locale, "tokens.costTimeSeries.empty")}
        </div>
      </div>
    );
  }

  const costLabel = t(locale, "tokens.costTimeSeries.cost");
  const allScopeOnly = data.length === 1 && data[0].label === "all";
  const title = t(locale, "tokens.costTimeSeries.title");
  const dragData = buildJesseContextDragData(
    buildTokenCostTimeSeriesJesseContext({ data, locale, title }),
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
          {t(locale, "tokens.costTimeSeries.aggregateOnly")}
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        {allScopeOnly ? (
          <BarChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#71717a" />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#71717a"
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`$${Number(value).toFixed(4)}`, costLabel]}
            />
            <Bar dataKey="cost_usd" name={costLabel} fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#71717a" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="#71717a"
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => [`$${Number(value).toFixed(4)}`, costLabel]}
          />
          <Area
            type="monotone"
            dataKey="cost_usd"
            name={costLabel}
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.2}
          />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
