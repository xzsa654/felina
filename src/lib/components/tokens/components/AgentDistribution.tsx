import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { AgentBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber, formatNumberFull } from "$lib/utils/format";
import { totalTokensForAgent } from "../token-insights";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

export default function AgentDistribution({
  data,
  locale,
}: {
  data: AgentBreakdown[];
  locale: Locale;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          {t(locale, "tokens.agentDistribution.title")}
        </h3>
        <p className="text-xs text-text-muted">
          {t(locale, "tokens.agentDistribution.empty")}
        </p>
      </div>
    );
  }

  const chartData = data
    .filter((a) => a.event_count > 0)
    .map((a) => ({
      name: a.agent,
      value: totalTokensForAgent(a),
      eventCount: a.event_count,
    }));
  const totalTokens = chartData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        {t(locale, "tokens.agentDistribution.title")}
      </h3>
      <div className="grid md:grid-cols-[180px_1fr] gap-4 items-center">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [formatNumberFull(Number(value), locale), t(locale, "tokens.agentDistribution.tokens")]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-text-primary truncate">{entry.name}</span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-text-primary font-medium">
                  {totalTokens > 0 ? `${((entry.value / totalTokens) * 100).toFixed(0)}%` : "0%"}
                </div>
                <div className="text-text-muted">
                  {formatNumber(entry.value, locale)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
