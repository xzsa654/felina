import type { ModelBreakdown } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatCostFull, formatNumber, formatNumberFull, formatCtx } from "$lib/utils/format";
import { getTopModelInsights } from "../token-insights";

function pct(value: number): string {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

export default function TopModelsInsightTable({
  data,
  locale,
}: {
  data: ModelBreakdown[];
  locale: Locale;
}) {
  const rows = getTopModelInsights(data).slice(0, 8);

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-text-secondary">
            {t(locale, "tokens.topModels.title")}
          </h3>
          <p className="text-xs text-text-muted mt-1">
            {t(locale, "tokens.topModels.subtitle")}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-text-muted px-2 py-1 rounded bg-bg-tertiary border border-border">
          {t(locale, "tokens.topModels.sortedByTotal")}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-sm text-text-muted">
          {t(locale, "tokens.modelBreakdown.chartEmpty")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-3 py-2 text-left font-medium">
                  {t(locale, "tokens.topModels.colModel")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t(locale, "tokens.topModels.colAgent")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t(locale, "tokens.topModels.colTotal")}
                </th>
                <th className="px-3 py-2 text-left font-medium min-w-[220px]">
                  {t(locale, "tokens.topModels.colComposition")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t(locale, "tokens.topModels.colCacheRead")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t(locale, "tokens.topModels.colMessages")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t(locale, "tokens.topModels.colEstimatedCost")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const parts = [
                  {
                    key: "input",
                    value: row.input,
                    label: t(locale, "tokens.tokenTimeSeries.input"),
                    className: "bg-blue-500",
                  },
                  {
                    key: "output",
                    value: row.output,
                    label: t(locale, "tokens.tokenTimeSeries.output"),
                    className: "bg-green-500",
                  },
                  {
                    key: "cacheRead",
                    value: row.cacheRead,
                    label: t(locale, "tokens.tokenTimeSeries.cacheRead"),
                    className: "bg-purple-500",
                  },
                  {
                    key: "cacheWrite",
                    value: row.cacheWrite,
                    label: t(locale, "tokens.tokenTimeSeries.cacheWrite"),
                    className: "bg-amber-500",
                  },
                  {
                    key: "reasoning",
                    value: row.reasoning,
                    label: t(locale, "tokens.topModels.reasoning"),
                    className: "bg-cyan-500",
                  },
                ].filter((part) => part.value > 0);

                return (
                  <tr key={`${row.model}-${row.agent}`} className="border-b border-border/50">
                    <td className="px-3 py-3 text-text-primary max-w-[240px]">
                      <div className="truncate font-medium" title={row.model}>
                        {row.model}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {[row.provider, formatCtx(row.maxInputTokens)].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-text-secondary whitespace-nowrap">
                      {row.agent}
                    </td>
                    <td className="px-3 py-3 text-right text-text-primary font-medium whitespace-nowrap">
                      {formatNumber(row.total, locale)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-2 w-full rounded-full overflow-hidden bg-bg-tertiary flex">
                        {parts.map((part) => (
                          <div
                            key={part.key}
                            className={part.className}
                            style={{ width: `${Math.max((part.value / row.total) * 100, 1)}%` }}
                            title={`${part.label}: ${formatNumberFull(part.value, locale)}`}
                          />
                        ))}
                      </div>
                      <div className="mt-1 text-[10px] text-text-muted truncate">
                        {parts
                          .slice(0, 3)
                          .map((part) => `${part.label} ${pct(part.value / row.total)}`)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-text-secondary whitespace-nowrap">
                      {pct(row.cacheReadRatio)}
                    </td>
                    <td className="px-3 py-3 text-right text-text-secondary whitespace-nowrap">
                      {formatNumberFull(row.eventCount, locale)}
                    </td>
                    <td className="px-3 py-3 text-right text-text-primary whitespace-nowrap">
                      {formatCostFull(row.estimatedCostUsd, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
