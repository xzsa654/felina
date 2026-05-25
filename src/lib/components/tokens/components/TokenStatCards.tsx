import { formatNumber, formatCostFull } from "$lib/utils/format";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import type { TokenAnalytics, CacheEfficiency } from "$lib/types";
import { cacheReadRatio, getTokenComposition } from "../token-insights";

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold text-text-primary mt-0.5">{value}</p>
      {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function TokenStatCards({
  analytics,
  cacheEfficiency,
  locale,
}: {
  analytics: TokenAnalytics | null;
  cacheEfficiency: CacheEfficiency | null;
  locale: Locale;
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

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard
        label={t(locale, "tokens.statCards.totalTokens")}
        value={formatNumber(composition.total, locale)}
        subtitle={t(locale, "tokens.statCards.eventsCount", { n: analytics.event_count.toLocaleString() })}
      />
      <StatCard
        label={t(locale, "tokens.statCards.estimatedCost")}
        value={formatCostFull(analytics.total_cost_usd, locale)}
        subtitle={t(locale, "tokens.statCards.estimatedCostSubtitle")}
      />
      <StatCard
        label={t(locale, "tokens.statCards.messages")}
        value={formatNumber(analytics.event_count, locale)}
      />
      <StatCard
        label={t(locale, "tokens.statCards.cacheReadShare")}
        value={cacheRatio}
        subtitle={cacheSubtitle}
      />
    </div>
  );
}
