import { useState } from "react";
import type { ModelBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatCostFull, formatNumber, formatCtx } from "$lib/utils/format";
import { totalTokensForModel } from "../token-insights";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

type SortField = "model" | "cost_usd" | "input_tokens" | "output_tokens" | "total_tokens";

export default function ModelBreakdownTable({
  data,
  locale,
  dateRangeLabel,
}: {
  data: ModelBreakdown[];
  locale: Locale;
  dateRangeLabel: string;
}) {
  const [sortField, setSortField] = useState<SortField>("total_tokens");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const av = sortField === "total_tokens" ? totalTokensForModel(a) : a[sortField];
    const bv = sortField === "total_tokens" ? totalTokensForModel(b) : b[sortField];
    const cmp = typeof av === "string" ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });
  const dragData = buildJesseContextDragData({
    kind: "model-breakdown",
    title: t(locale, "tokens.modelBreakdown.tableTitle"),
    source: "tokens.modelBreakdown",
    capturedAt: new Date().toISOString(),
    summary: `${sorted.length} models sorted by ${sortField}. Time range: ${dateRangeLabel}.`,
    rows: sorted.map((model) => ({
      label: model.model,
      metrics: {
        dateRange: dateRangeLabel,
        totalTokens: totalTokensForModel(model),
        inputTokens: model.input_tokens,
        outputTokens: model.output_tokens,
        costUsd: model.cost_usd,
      },
      note: [model.provider, model.agent, formatCtx(model.max_input_tokens)]
        .filter(Boolean)
        .join(" · "),
    })),
  });

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs text-text-muted cursor-pointer hover:text-text-secondary"
      onClick={() => toggleSort(field)}
    >
      {label} {sortField === field ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3
        className="mb-3 inline-block cursor-grab text-sm font-medium text-text-secondary active:cursor-grabbing"
        draggable
        onDragStart={(event) => {
          setJesseContextDragData(
            event.dataTransfer,
            dragData,
            t(locale, "tokens.modelBreakdown.tableTitle"),
          );
        }}
        title="Drag to Jesse"
      >
        {t(locale, "tokens.modelBreakdown.tableTitle")}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <SortHeader field="model" label={t(locale, "tokens.modelBreakdown.colModel")} />
              <SortHeader field="total_tokens" label={t(locale, "tokens.topModels.colTotal")} />
              <SortHeader field="input_tokens" label={t(locale, "tokens.modelBreakdown.colInputTokens")} />
              <SortHeader field="output_tokens" label={t(locale, "tokens.modelBreakdown.colOutputTokens")} />
              <SortHeader field="cost_usd" label={t(locale, "tokens.modelBreakdown.colCost")} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const rowDragData = buildJesseContextDragData({
                kind: "model-breakdown",
                title: m.model,
                source: "tokens.modelBreakdown.row",
                capturedAt: new Date().toISOString(),
                summary: `${m.model}: ${formatNumber(totalTokensForModel(m), locale)} tokens · ${formatCostFull(m.cost_usd, locale)}. Time range: ${dateRangeLabel}.`,
                rows: [{
                  label: m.model,
                  metrics: {
                    dateRange: dateRangeLabel,
                    totalTokens: totalTokensForModel(m),
                    inputTokens: m.input_tokens,
                    outputTokens: m.output_tokens,
                    costUsd: m.cost_usd,
                  },
                  note: [m.provider, m.agent, formatCtx(m.max_input_tokens)]
                    .filter(Boolean)
                    .join(" · "),
                }],
              });
              return (
              <tr
                key={`${m.model}-${m.agent}`}
                className="border-b border-border/50"
              >
                <td className="px-3 py-2 max-w-[220px]">
                  <div
                    className="inline-block max-w-full cursor-grab truncate text-text-primary active:cursor-grabbing"
                    draggable
                    onDragStart={(event) => {
                      setJesseContextDragData(event.dataTransfer, rowDragData, m.model);
                    }}
                    title="Drag to Jesse"
                  >
                    {m.model}
                  </div>
                  <div className="text-[10px] text-text-muted truncate">
                    {[m.provider, formatCtx(m.max_input_tokens)].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-3 py-2 text-text-primary font-medium">
                  {formatNumber(totalTokensForModel(m), locale)}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {formatNumber(m.input_tokens, locale)}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {formatNumber(m.output_tokens, locale)}
                </td>
                <td className="px-3 py-2 text-text-primary font-medium">
                  {formatCostFull(m.cost_usd, locale)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
