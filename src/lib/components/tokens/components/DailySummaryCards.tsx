import { useMemo } from "react";
import type { TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber, formatCostFull, formatDate } from "$lib/utils/format";
import { totalTokensForBucket } from "../token-insights";

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold text-text-primary mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export default function DailySummaryCards({
  data,
  locale,
}: {
  data: TokenBucket[];
  locale: Locale;
}) {
  const stats = useMemo(() => {
    const dated = data.filter((b) => /^\d{4}-\d{2}-\d{2}/.test(b.label));
    if (dated.length === 0) return null;

    const totals = dated.map((b) => ({ ...b, total: totalTokensForBucket(b) }));
    const busiest = totals.reduce((max, b) => (b.total > max.total ? b : max), totals[0]);
    const sumTokens = totals.reduce((s, b) => s + b.total, 0);
    const sumCost = totals.reduce((s, b) => s + b.cost_usd, 0);
    const activeDays = totals.filter((b) => b.total > 0).length;

    return { busiest, sumTokens, sumCost, activeDays, totalDays: dated.length };
  }, [data]);

  if (!stats) return null;

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Card
        label={t(locale, "tokens.daily.busiestDay" as never)}
        value={formatNumber(stats.busiest.total, locale)}
        sub={formatDate(stats.busiest.label, locale)}
      />
      <Card
        label={t(locale, "tokens.daily.avgPerDay" as never)}
        value={formatNumber(Math.round(stats.sumTokens / Math.max(stats.activeDays, 1)), locale)}
        sub={t(locale, "tokens.daily.activeDaysOf" as never, {
          active: stats.activeDays,
          total: stats.totalDays,
        })}
      />
      <Card
        label={t(locale, "tokens.daily.activeDays" as never)}
        value={`${stats.activeDays}`}
        sub={t(locale, "tokens.daily.totalDays" as never, { n: stats.totalDays })}
      />
      <Card
        label={t(locale, "tokens.daily.totalCost" as never)}
        value={formatCostFull(stats.sumCost, locale)}
      />
    </div>
  );
}
