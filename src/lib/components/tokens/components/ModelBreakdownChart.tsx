import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ModelBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";

export default function ModelBreakdownChart({
  data,
  locale,
}: {
  data: ModelBreakdown[];
  locale: Locale;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        {t(locale, "tokens.modelBreakdown.chartEmpty")}
      </div>
    );
  }

  const costLabel = t(locale, "tokens.modelBreakdown.tooltipCost");

  const chartData = data
    .slice(0, 10)
    .map((m) => ({
      name: m.model.length > 25 ? m.model.slice(0, 25) + "..." : m.model,
      cost: +m.cost_usd.toFixed(4),
      tokens: m.input_tokens + m.output_tokens,
    }))
    .reverse();

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        {t(locale, "tokens.modelBreakdown.chartTitle")}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="#71717a" />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10 }}
            stroke="#71717a"
            width={150}
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
          <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
