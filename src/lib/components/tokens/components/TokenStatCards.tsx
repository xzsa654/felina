import { formatNumber, formatCostFull } from "$lib/utils/format";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import type { TokenAnalytics, CacheEfficiency } from "$lib/types";

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

  const totalTokens =
    analytics.total_input_tokens +
    analytics.total_output_tokens +
    analytics.total_cache_read_tokens +
    analytics.total_cache_write_tokens +
    analytics.total_reasoning_tokens;

  const cacheRatio = cacheEfficiency
    ? `${(cacheEfficiency.cache_hit_ratio * 100).toFixed(0)}%`
    : t(locale, "common.na");

  const cacheSubtitle = cacheEfficiency
    ? t(locale, "tokens.statCards.savedCost", {
        cost: formatCostFull(cacheEfficiency.cache_cost_saved, locale).replace("$", ""),
      })
    : undefined;

  return (
    <div className="grid grid-cols-5 gap-3">
      <StatCard
        label={t(locale, "tokens.statCards.totalTokens")}
        value={formatNumber(totalTokens, locale)}
        subtitle={t(locale, "tokens.statCards.eventsCount", { n: analytics.event_count.toLocaleString() })}
      />
      <StatCard
        label={t(locale, "tokens.statCards.totalCost")}
        value={formatCostFull(analytics.total_cost_usd, locale)}
      />
      <StatCard
        label={t(locale, "tokens.statCards.events")}
        value={formatNumber(analytics.event_count, locale)}
      />
      <StatCard
        label={t(locale, "tokens.statCards.activeAgents")}
        value={`${analytics.agent_breakdown.filter(a => a.event_count > 0).length}`}
      />
      <StatCard
        label={t(locale, "tokens.statCards.cacheHitRatio")}
        value={cacheRatio}
        subtitle={cacheSubtitle}
      />
    </div>
  );
}
