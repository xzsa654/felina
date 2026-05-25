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
import type { TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";

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

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        {t(locale, "tokens.costTimeSeries.title")}
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
