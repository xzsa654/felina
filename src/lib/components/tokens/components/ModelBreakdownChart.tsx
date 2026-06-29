import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { JesseContextPayload, ModelBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatCostFull, formatNumber } from "$lib/utils/format";
import { totalTokensForModel } from "../token-insights";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

export function buildModelBreakdownChartJesseContext({
  data,
  locale,
  title,
}: {
  data: ModelBreakdown[];
  locale: Locale;
  title: string;
}): JesseContextPayload {
  const howToRead =
    "This is a horizontal ranking bar chart. Each row is a model; longer bars mean higher estimated cost among the displayed top models. Use it to spot which model is driving spend, not total token volume alone.";

  return {
    kind: "model-breakdown",
    title,
    source: "tokens.modelBreakdownChart",
    capturedAt: new Date().toISOString(),
    summary: `${title}: top ${Math.min(data.length, 10)} models by displayed chart cost. How to read: ${howToRead}`,
    metrics: {
      chartType: "model cost ranking bar chart",
      howToRead,
      displayedModels: Math.min(data.length, 10),
    },
    rows: data.slice(0, 10).map((model) => ({
      label: model.model,
      metrics: {
        totalTokens: totalTokensForModel(model),
        costUsd: model.cost_usd,
        inputTokens: model.input_tokens,
        outputTokens: model.output_tokens,
      },
      note: `${model.provider} · ${formatNumber(totalTokensForModel(model), locale)} tokens · ${formatCostFull(model.cost_usd, locale)}`,
    })),
  };
}

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
  const title = t(locale, "tokens.modelBreakdown.chartTitle");

  const chartData = data
    .slice(0, 10)
    .map((m) => ({
      name: m.model.length > 25 ? m.model.slice(0, 25) + "..." : m.model,
      cost: +m.cost_usd.toFixed(4),
      tokens: totalTokensForModel(m),
    }))
    .reverse();
  const dragData = buildJesseContextDragData(
    buildModelBreakdownChartJesseContext({ data, locale, title }),
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
