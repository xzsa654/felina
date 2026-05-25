import { useState } from "react";
import type { ModelBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatCostFull, formatNumber, formatCtx } from "$lib/utils/format";
import { totalTokensForModel } from "../token-insights";

type SortField = "model" | "cost_usd" | "input_tokens" | "output_tokens" | "total_tokens";

export default function ModelBreakdownTable({
  data,
  locale,
}: {
  data: ModelBreakdown[];
  locale: Locale;
}) {
  const [sortField, setSortField] = useState<SortField>("total_tokens");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const av = sortField === "total_tokens" ? totalTokensForModel(a) : a[sortField];
    const bv = sortField === "total_tokens" ? totalTokensForModel(b) : b[sortField];
    const cmp = typeof av === "string" ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
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
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
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
            {sorted.map((m) => (
              <tr key={`${m.model}-${m.agent}`} className="border-b border-border/50">
                <td className="px-3 py-2 max-w-[220px]">
                  <div className="text-text-primary truncate">{m.model}</div>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
