import type { TokenAnalytics } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumberFull, formatCostFull } from "$lib/utils/format";

export default function CostBudgetCard({
  analytics,
  locale,
}: {
  analytics: TokenAnalytics | null;
  locale: Locale;
}) {
  if (!analytics) return null;

  const nDays = analytics.time_series.length;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        {t(locale, "tokens.costBudget.title")}
      </h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-text-muted">
              {t(locale, "tokens.costBudget.totalCost")}
            </span>
            <p className="text-lg font-semibold text-text-primary">
              {formatCostFull(analytics.total_cost_usd, locale)}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              {t(locale, "tokens.costBudget.events")}
            </span>
            <p className="text-lg font-semibold text-text-primary">
              {formatNumberFull(analytics.event_count, locale)}
            </p>
          </div>
        </div>
        {nDays > 0 && (
          <div>
            <span className="text-xs text-text-muted">
              {t(locale, "tokens.costBudget.avgDailyCost", { n: nDays })}
            </span>
            <p className="text-sm font-medium text-text-primary">
              {formatCostFull(
                analytics.time_series.reduce((s, b) => s + b.cost_usd, 0) / nDays,
                locale,
              )}{" "}
              {t(locale, "tokens.costBudget.perDay")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
