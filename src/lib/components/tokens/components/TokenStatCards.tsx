import { formatNumber, formatCostFull } from "$lib/utils/format";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import type { TokenAnalytics, CacheEfficiency } from "$lib/types";
import { cacheReadRatio, getTokenComposition } from "../token-insights";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

function StatCard({
  label,
  value,
  subtitle,
  dragData,
}: {
  label: string;
  value: string;
  subtitle?: string;
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
      <p className="text-lg font-semibold text-text-primary mt-0.5">{value}</p>
      {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function TokenStatCards({
  analytics,
  cacheEfficiency,
  locale,
  dateRangeLabel,
}: {
  analytics: TokenAnalytics | null;
  cacheEfficiency: CacheEfficiency | null;
  locale: Locale;
  dateRangeLabel: string;
}) {
  if (!analytics) return null;

  const composition = getTokenComposition(analytics);

  const cacheRatio = cacheEfficiency
    ? `${(cacheEfficiency.cache_hit_ratio * 100).toFixed(0)}%`
    : `${(cacheReadRatio(composition) * 100).toFixed(0)}%`;

  const cacheSubtitle = cacheEfficiency
    ? t(locale, "tokens.statCards.savedCost", {
        cost: formatCostFull(cacheEfficiency.cache_cost_saved, locale).replace("$", ""),
      })
    : undefined;
  const totalTokensDragData = buildJesseContextDragData({
    kind: "token-overview",
    title: t(locale, "tokens.statCards.totalTokens"),
    source: "tokens.statCards.totalTokens",
    capturedAt: new Date().toISOString(),
    summary: `${t(locale, "tokens.statCards.totalTokens")}: ${formatNumber(composition.total, locale)}. Time range: ${dateRangeLabel}. This card is about total token volume and how it is composed.`,
    metrics: {
      dateRange: dateRangeLabel,
      totalTokens: composition.total,
      inputTokens: composition.input,
      outputTokens: composition.output,
      cacheReadTokens: composition.cacheRead,
      cacheWriteTokens: composition.cacheWrite,
      reasoningTokens: composition.reasoning,
      eventCount: analytics.event_count,
    },
  });

  const estimatedCostDragData = buildJesseContextDragData({
    kind: "token-overview",
    title: t(locale, "tokens.statCards.estimatedCost"),
    source: "tokens.statCards.estimatedCost",
    capturedAt: new Date().toISOString(),
    summary: `${t(locale, "tokens.statCards.estimatedCost")}: ${formatCostFull(analytics.total_cost_usd, locale)}. Time range: ${dateRangeLabel}. This card estimates spend from recorded token usage.`,
    metrics: {
      dateRange: dateRangeLabel,
      totalCostUsd: analytics.total_cost_usd,
      totalTokens: composition.total,
      eventCount: analytics.event_count,
    },
  });

  const messagesDragData = buildJesseContextDragData({
    kind: "token-overview",
    title: t(locale, "tokens.statCards.messages"),
    source: "tokens.statCards.messages",
    capturedAt: new Date().toISOString(),
    summary: `${t(locale, "tokens.statCards.messages")}: ${formatNumber(analytics.event_count, locale)}. Time range: ${dateRangeLabel}. This card counts recorded token events or messages in the selected range.`,
    metrics: {
      dateRange: dateRangeLabel,
      eventCount: analytics.event_count,
      totalTokens: composition.total,
      averageTokensPerEvent: analytics.event_count > 0
        ? Math.round(composition.total / analytics.event_count)
        : null,
    },
  });

  const cacheReadShareDragData = buildJesseContextDragData({
    kind: "token-overview",
    title: t(locale, "tokens.statCards.cacheReadShare"),
    source: "tokens.statCards.cacheReadShare",
    capturedAt: new Date().toISOString(),
    summary: `${t(locale, "tokens.statCards.cacheReadShare")}: ${cacheRatio}. Time range: ${dateRangeLabel}. This card shows how much usage came from cache reads instead of fresh token work.`,
    metrics: {
      dateRange: dateRangeLabel,
      cacheRatio,
      cacheReadTokens: composition.cacheRead,
      cacheWriteTokens: composition.cacheWrite,
      totalTokens: composition.total,
      cacheCostSavedUsd: cacheEfficiency?.cache_cost_saved ?? null,
    },
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t(locale, "tokens.statCards.totalTokens")}
        value={formatNumber(composition.total, locale)}
        subtitle={t(locale, "tokens.statCards.eventsCount", { n: analytics.event_count.toLocaleString() })}
        dragData={totalTokensDragData}
      />
      <StatCard
        label={t(locale, "tokens.statCards.estimatedCost")}
        value={formatCostFull(analytics.total_cost_usd, locale)}
        subtitle={t(locale, "tokens.statCards.estimatedCostSubtitle")}
        dragData={estimatedCostDragData}
      />
      <StatCard
        label={t(locale, "tokens.statCards.messages")}
        value={formatNumber(analytics.event_count, locale)}
        dragData={messagesDragData}
      />
      <StatCard
        label={t(locale, "tokens.statCards.cacheReadShare")}
        value={cacheRatio}
        subtitle={cacheSubtitle}
        dragData={cacheReadShareDragData}
      />
    </div>
  );
}
