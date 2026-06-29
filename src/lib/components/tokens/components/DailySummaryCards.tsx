import { useMemo } from "react";
import type { TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber, formatCostFull, formatDate } from "$lib/utils/format";
import { totalTokensForBucket } from "../token-insights";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

function Card({
  label,
  value,
  sub,
  dragData,
}: {
  label: string;
  value: string;
  sub?: string;
  dragData?: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg px-4 py-3">
      <p
        className={dragData ? "inline-block cursor-grab text-xs text-text-muted active:cursor-grabbing" : "text-xs text-text-muted"}
        draggable={Boolean(dragData)}
        onDragStart={(event) => {
          if (!dragData) return;
          setJesseContextDragData(event.dataTransfer, dragData, label);
        }}
        title={dragData ? "Drag to Jesse" : undefined}
      >
        {label}
      </p>
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

  const capturedAt = new Date().toISOString();
  const busiestLabel = t(locale, "tokens.daily.busiestDay" as never);
  const avgLabel = t(locale, "tokens.daily.avgPerDay" as never);
  const activeDaysLabel = t(locale, "tokens.daily.activeDays" as never);
  const totalCostLabel = t(locale, "tokens.daily.totalCost" as never);

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Card
        label={busiestLabel}
        value={formatNumber(stats.busiest.total, locale)}
        sub={formatDate(stats.busiest.label, locale)}
        dragData={buildJesseContextDragData({
          kind: "token-overview",
          title: busiestLabel,
          source: "tokens.daily.busiestDay",
          capturedAt,
          summary: `${busiestLabel}: ${formatNumber(stats.busiest.total, locale)} on ${formatDate(stats.busiest.label, locale)}.`,
          metrics: {
            date: stats.busiest.label,
            totalTokens: stats.busiest.total,
            eventCount: stats.busiest.event_count,
            costUsd: stats.busiest.cost_usd,
          },
        })}
      />
      <Card
        label={avgLabel}
        value={formatNumber(Math.round(stats.sumTokens / Math.max(stats.activeDays, 1)), locale)}
        sub={t(locale, "tokens.daily.activeDaysOf" as never, {
          active: stats.activeDays,
          total: stats.totalDays,
        })}
        dragData={buildJesseContextDragData({
          kind: "token-overview",
          title: avgLabel,
          source: "tokens.daily.avgPerDay",
          capturedAt,
          summary: `${avgLabel}: ${formatNumber(Math.round(stats.sumTokens / Math.max(stats.activeDays, 1)), locale)} across ${stats.activeDays} active days.`,
          metrics: {
            averageTokensPerActiveDay: Math.round(stats.sumTokens / Math.max(stats.activeDays, 1)),
            activeDays: stats.activeDays,
            totalDays: stats.totalDays,
            totalTokens: stats.sumTokens,
          },
        })}
      />
      <Card
        label={activeDaysLabel}
        value={`${stats.activeDays}`}
        sub={t(locale, "tokens.daily.totalDays" as never, { n: stats.totalDays })}
        dragData={buildJesseContextDragData({
          kind: "token-overview",
          title: activeDaysLabel,
          source: "tokens.daily.activeDays",
          capturedAt,
          summary: `${activeDaysLabel}: ${stats.activeDays} of ${stats.totalDays} days have activity.`,
          metrics: {
            activeDays: stats.activeDays,
            totalDays: stats.totalDays,
            inactiveDays: stats.totalDays - stats.activeDays,
          },
        })}
      />
      <Card
        label={totalCostLabel}
        value={formatCostFull(stats.sumCost, locale)}
        dragData={buildJesseContextDragData({
          kind: "token-overview",
          title: totalCostLabel,
          source: "tokens.daily.totalCost",
          capturedAt,
          summary: `${totalCostLabel}: ${formatCostFull(stats.sumCost, locale)} across ${stats.totalDays} days.`,
          metrics: {
            totalCostUsd: stats.sumCost,
            totalDays: stats.totalDays,
            activeDays: stats.activeDays,
            totalTokens: stats.sumTokens,
          },
        })}
      />
    </div>
  );
}
