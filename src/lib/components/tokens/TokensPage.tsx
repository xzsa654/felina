import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { api } from "$lib/tauri/commands";
import type {
  TokenAnalytics,
  CacheEfficiency,
} from "$lib/types";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { PageBody } from "$lib/components/shared/PageScaffold";
import TokenStatCards from "./components/TokenStatCards";
import TokenTimeSeries from "./components/TokenTimeSeries";
import TokenCostTimeSeries from "./components/TokenCostTimeSeries";
import ModelBreakdownChart from "./components/ModelBreakdownChart";
import ModelBreakdownTable from "./components/ModelBreakdownTable";
import CacheEfficiencyCard from "./components/CacheEfficiencyCard";
import TopSessionsCard from "./components/TopSessionsCard";
import CostBudgetCard from "./components/CostBudgetCard";
import AgentQuotaPanel from "./components/AgentQuotaPanel";
import TimeBucketTable from "./components/TimeBucketTable";
import DailySummaryCards from "./components/DailySummaryCards";
import ContributionGraph from "./components/ContributionGraph";
import {
  DailyTokensPageSkeleton,
  ModelsTokensPageSkeleton,
  OverviewTokensPageSkeleton,
} from "./components/TokensPageSkeleton";
import { RefreshCw } from "lucide-react";
import {
  cacheReadRatio,
  classifyDataResolution,
  getTokenComposition,
} from "./token-insights";

type Tab = "overview" | "daily" | "models";
type DatePreset = "today" | "days7" | "days30" | "days90";

// ── Module-level cache ────────────────────────────────────────────────────────
// Survives route changes so the page feels instant when revisiting.
// Cleared by refresh or when datePreset changes.
interface PageCache {
  analytics: TokenAnalytics;
  analyticsDaily: TokenAnalytics;
  cacheEfficiency: CacheEfficiency;
  datePreset: DatePreset;
  dailyPreset: DatePreset;
}
let _cache: PageCache | null = null;

const DATE_PRESETS: { key: DatePreset; days: number }[] = [
  { key: "today", days: 1 },
  { key: "days7", days: 7 },
  { key: "days30", days: 30 },
  { key: "days90", days: 90 },
];

const TABS: { key: Tab; i18nKey: string }[] = [
  { key: "overview", i18nKey: "tokens.tabs.overview" },
  { key: "daily", i18nKey: "tokens.tabs.daily" },
  { key: "models", i18nKey: "tokens.tabs.models" },
];

const DATE_LABEL_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseTab(value: string | null): Tab | null {
  return value === "overview" || value === "daily" || value === "models" ? value : null;
}

function parseDate(value: string | null): string | null {
  return value && DATE_LABEL_RE.test(value) ? value : null;
}

function TokensPageSkeletonForTab({ tab }: { tab: Tab }) {
  switch (tab) {
    case "daily":
      return <DailyTokensPageSkeleton />;
    case "models":
      return <ModelsTokensPageSkeleton />;
    default:
      return <OverviewTokensPageSkeleton />;
  }
}

export default function TokensPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(
    () => parseTab(searchParams.get("tab")) ?? (parseDate(searchParams.get("date")) ? "daily" : "overview"),
  );
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(() => parseDate(searchParams.get("date")));
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dailyPreset, setDailyPreset] = useState<DatePreset>("days90");

  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [analyticsDaily, setAnalyticsDaily] = useState<TokenAnalytics | null>(null);
  const [cacheEfficiency, setCacheEfficiency] = useState<CacheEfficiency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Prevents StrictMode's double-invocation of effects from firing 2× fetches.
  const isFetchingRef = useRef(false);

  function getDateBounds(days: number): { dateStart: number; dateEnd: number } {
    const dateEnd = Math.floor(Date.now() / 1000);
    return { dateStart: dateEnd - days * 86400, dateEnd };
  }

  function cacheEfficiencyFromDaily(ad: TokenAnalytics): CacheEfficiency {
    const totalInput = ad.total_input_tokens + ad.total_cache_read_tokens;
    return {
      total_input_tokens: ad.total_input_tokens,
      cache_read_tokens: ad.total_cache_read_tokens,
      cache_write_tokens: ad.total_cache_write_tokens,
      cache_hit_ratio: totalInput > 0 ? ad.total_cache_read_tokens / totalInput : 0,
      cache_cost_saved: ad.total_cache_read_tokens / 1_000_000 * (3.0 - 0.3),
    };
  }

  function updateTokenSearchParams(next: { tab?: Tab; date?: string | null }) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next.tab) params.set("tab", next.tab);
      if (next.date === null) params.delete("date");
      else if (next.date) params.set("date", next.date);
      return params;
    });
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "daily") {
      updateTokenSearchParams({ tab });
    } else {
      setSelectedDailyDate(null);
      updateTokenSearchParams({ tab, date: null });
    }
  }

  function handleDailyDateSelect(date: string) {
    setActiveTab("daily");
    setSelectedDailyDate(date);
    updateTokenSearchParams({ tab: "daily", date });
  }

  function dayDetailHref(date: string): string {
    return `/tokens?tab=daily&date=${encodeURIComponent(date)}`;
  }

  async function fetchAnalyticsSnapshot(
    nextDatePreset: DatePreset,
    nextDailyPreset: DatePreset,
    refreshFirst: boolean,
  ): Promise<PageCache> {
    if (refreshFirst) {
      await api.tokenAnalytics.refresh();
    }

    const bounds = getDateBounds(DATE_PRESETS.find((p) => p.key === nextDatePreset)!.days);
    const dailyBounds = getDateBounds(DATE_PRESETS.find((p) => p.key === nextDailyPreset)!.days);
    const [monthly, ad] = await Promise.all([
      api.tokenAnalytics.get({ granularity: "monthly", ...bounds,
        sourceOverride: nextDatePreset !== "days90" ? "auto_dated" : undefined }),
      api.tokenAnalytics.get({ granularity: "daily", ...dailyBounds,
        sourceOverride: "auto_dated" }),
    ]);

    return {
      analytics: monthly,
      analyticsDaily: ad,
      cacheEfficiency: cacheEfficiencyFromDaily(ad),
      datePreset: nextDatePreset,
      dailyPreset: nextDailyPreset,
    };
  }

  async function handleRefresh() {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    _cache = null;
    setAnalytics(null);
    setAnalyticsDaily(null);
    setCacheEfficiency(null);
    setLoading(true);
    setError(null);

    try {
      const snapshot = await fetchAnalyticsSnapshot(datePreset, dailyPreset, true);
      setAnalytics(snapshot.analytics);
      setAnalyticsDaily(snapshot.analyticsDaily);
      setCacheEfficiency(snapshot.cacheEfficiency);
      _cache = snapshot;
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }

  // Main data fetch — runs when datePreset changes.
  useEffect(() => {
    // StrictMode mounts twice; skip the second if first is already running.
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    let cancelled = false;

    // Clear stale cache when preset changes.
    if (_cache && (_cache.datePreset !== datePreset || _cache.dailyPreset !== dailyPreset)) _cache = null;

    // If cache hit → show skeleton for one paint then swap in cached data.
    const cached = _cache?.datePreset === datePreset && _cache.dailyPreset === dailyPreset ? _cache : null;
    if (cached) {
      // rAF schedules BEFORE next paint; setTimeout(0) inside ensures
      // the skeleton is actually visible for at least one frame.
      const raf = requestAnimationFrame(() => {
        const timer = setTimeout(() => {
          if (cancelled) return;
          setAnalytics(cached.analytics);
          setAnalyticsDaily(cached.analyticsDaily);
          setCacheEfficiency(cached.cacheEfficiency);
          setLoading(false);
          isFetchingRef.current = false;
        }, 0);
        return () => clearTimeout(timer);
      });
      return () => { cancelled = true; cancelAnimationFrame(raf); isFetchingRef.current = false; };
    }

    // No cache → defer fetch start until after skeleton is painted.
    // rAF fires before the next paint; setTimeout(0) inside pushes it
    // to the following task so the browser has painted the skeleton first.
    let rafId: number;
    let timerId: ReturnType<typeof setTimeout>;

    rafId = requestAnimationFrame(() => {
      timerId = setTimeout(async () => {
        if (cancelled) return;

        setLoading(true);
        setError(null);

        try {
          const snapshot = await fetchAnalyticsSnapshot(datePreset, dailyPreset, false);
          if (cancelled) return;
          setAnalytics(snapshot.analytics);
          setAnalyticsDaily(snapshot.analyticsDaily);
          setCacheEfficiency(snapshot.cacheEfficiency);
          _cache = snapshot;
        } catch (e) {
          if (!cancelled) setError(String(e));
        } finally {
          if (!cancelled) setLoading(false);
          isFetchingRef.current = false;
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      isFetchingRef.current = false;
    };
  }, [datePreset, dailyPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextTab = parseTab(searchParams.get("tab"));
    const nextDate = parseDate(searchParams.get("date"));
    const resolvedTab = nextTab ?? (nextDate ? "daily" : null);
    if (resolvedTab) {
      setActiveTab((current) => (current === resolvedTab ? current : resolvedTab));
    }
    setSelectedDailyDate(nextDate);
  }, [searchParams]);

  const dataResolution = classifyDataResolution(
    analyticsDaily?.time_series ?? [],
    analyticsDaily?.hourly_heatmap ?? [],
  );
  const composition = getTokenComposition(analytics);
  const canShowTemporalCharts = dataResolution.hasDatedBuckets;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar + Tab bar (single row with border-b) */}
      <div className="px-6 pt-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-text-primary">{t(locale, "tokens.title")}</h1>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-text-primary text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {t(locale, tab.i18nKey as never)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 pb-2">
          {DATE_PRESETS.map((preset) => {
            const isDaily = activeTab === "daily";
            const active = isDaily ? dailyPreset : datePreset;
            const setter = isDaily ? setDailyPreset : setDatePreset;
            return (
              <div key={preset.key} className="flex items-center gap-1">
                {preset.key === "today" && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loading}
                    title={t(locale, "tokens.refresh")}
                    aria-label={t(locale, "tokens.refresh")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-bg-secondary text-text-muted shadow-sm transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                  </button>
                )}
                <button
                  onClick={() => setter(preset.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    active === preset.key
                      ? "bg-bg-secondary text-text-primary border border-border shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {t(locale, `tokens.dateRange.${preset.key}` as never)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 overflow-y-auto">
        <PageBody>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="px-4 py-2 bg-danger-dim border border-danger/30 rounded-md text-sm text-danger">
                {error}
              </div>
            )}

            {loading ? (
              <TokensPageSkeletonForTab tab={activeTab} />
            ) : analytics ? (
              <>
                {/* ── Overview ── */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <AgentQuotaPanel locale={locale} />
                    <TokenStatCards analytics={analytics} cacheEfficiency={cacheEfficiency} locale={locale} />
                    <TopSessionsCard data={analytics.top_sessions ?? []} locale={locale} />
                    <CacheEfficiencyCard data={cacheEfficiency} locale={locale} />
                    {canShowTemporalCharts && (
                      <div className="grid lg:grid-cols-2 gap-4">
                        <TokenTimeSeries data={analyticsDaily?.time_series ?? []} locale={locale} />
                        <TokenCostTimeSeries data={analyticsDaily?.time_series ?? []} locale={locale} />
                      </div>
                    )}
                  </div>
                )}

                {/* ── Daily ── */}
                {activeTab === "daily" && (
                  <div className="space-y-4">
                    {!canShowTemporalCharts && dataResolution.aggregateOnly && (
                      <div className="bg-bg-secondary border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-text-secondary mb-1">
                          {t(locale, "tokens.temporalUnavailable.title")}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {t(locale, "tokens.temporalUnavailable.description", {
                            cachePct: `${(cacheReadRatio(composition) * 100).toFixed(0)}%`,
                          })}
                        </p>
                      </div>
                    )}
                    <DailySummaryCards data={analyticsDaily?.time_series ?? []} locale={locale} />
                    <ContributionGraph
                      data={analyticsDaily?.time_series ?? []}
                      locale={locale}
                      selectedDate={selectedDailyDate}
                      getDayHref={dayDetailHref}
                      onSelectDate={handleDailyDateSelect}
                    />
                    <TimeBucketTable
                      data={analyticsDaily?.time_series ?? []}
                      locale={locale}
                      selectedDate={selectedDailyDate}
                      onSelectDate={handleDailyDateSelect}
                    />
                  </div>
                )}

                {/* ── Models ── */}
                {activeTab === "models" && (
                  <div className="space-y-4">
                    <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
                      <ModelBreakdownTable data={analytics?.model_breakdown ?? []} locale={locale} />
                      <div className="space-y-4">
                        <CostBudgetCard analytics={analytics} locale={locale} />
                        <ModelBreakdownChart data={analytics?.model_breakdown ?? []} locale={locale} />
                      </div>
                    </div>
                  </div>
                )}

              </>
            ) : null}

          </div>
        </PageBody>
      </div>
    </div>
  );
}
