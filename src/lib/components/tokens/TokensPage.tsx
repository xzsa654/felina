import { useState, useEffect, useCallback } from "react";
import { api } from "$lib/tauri/commands";
import type {
  TokenAnalytics,
  CacheEfficiency,
  AgentStatus,
  RefreshResult,
} from "$lib/types";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { PageHeader, PageBody } from "$lib/components/shared/PageScaffold";
import LanguageSwitcher from "./components/LanguageSwitcher";
import TokenStatCards from "./components/TokenStatCards";
import TokenTimeSeries from "./components/TokenTimeSeries";
import TokenCostTimeSeries from "./components/TokenCostTimeSeries";
import ModelBreakdownChart from "./components/ModelBreakdownChart";
import ModelBreakdownTable from "./components/ModelBreakdownTable";
import CacheEfficiencyCard from "./components/CacheEfficiencyCard";
import AgentDistribution from "./components/AgentDistribution";
import AgentStatusPanel from "./components/AgentStatusPanel";
import CostBudgetCard from "./components/CostBudgetCard";
import DataResolutionPanel from "./components/DataResolutionPanel";
import TopModelsInsightTable from "./components/TopModelsInsightTable";
import TimeBucketTable from "./components/TimeBucketTable";
import DailySummaryCards from "./components/DailySummaryCards";
import ContributionGraph from "./components/ContributionGraph";
import {
  cacheReadRatio,
  classifyDataResolution,
  getTokenComposition,
} from "./token-insights";

type Tab = "overview" | "daily" | "models" | "agents";
type DatePreset = "all" | "days7" | "days30" | "days90";

const DATE_PRESETS: { key: DatePreset; days: number | null }[] = [
  { key: "all", days: null },
  { key: "days7", days: 7 },
  { key: "days30", days: 30 },
  { key: "days90", days: 90 },
];

const TABS: { key: Tab; i18nKey: string }[] = [
  { key: "overview", i18nKey: "tokens.tabs.overview" },
  { key: "daily", i18nKey: "tokens.tabs.daily" },
  { key: "models", i18nKey: "tokens.tabs.models" },
  { key: "agents", i18nKey: "tokens.tabs.agents" },
];

export default function TokensPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [analyticsDaily, setAnalyticsDaily] = useState<TokenAnalytics | null>(null);
  const [cacheEfficiency, setCacheEfficiency] = useState<CacheEfficiency | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialScanDone, setInitialScanDone] = useState(false);

  function getDateBounds(days: number | null): { dateStart?: number; dateEnd?: number } {
    if (!days) return {};
    const dateEnd = Math.floor(Date.now() / 1000);
    return { dateStart: dateEnd - days * 86400, dateEnd };
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const bounds = getDateBounds(DATE_PRESETS.find((p) => p.key === datePreset)?.days ?? null);

      const [a, ad, ce, ag] = await Promise.all([
        api.tokenAnalytics.get({ granularity: "monthly", ...bounds }),
        api.tokenAnalytics.get({ granularity: "daily", ...bounds, sourceOverride: "auto_dated" }),
        api.tokenAnalytics.getCacheEfficiency(bounds.dateStart, bounds.dateEnd),
        api.tokenAnalytics.getAvailableAgents(),
      ]);

      setAnalytics(a);
      setAnalyticsDaily(ad);
      setCacheEfficiency(ce);
      setAgents(ag);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [datePreset]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      const result = await api.tokenAnalytics.refresh();
      setLastRefreshResult(result);
      await fetchData();
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    async function init() {
      try {
        const a = await api.tokenAnalytics.get({ granularity: "daily" });
        if (a.event_count === 0 && !initialScanDone) {
          setInitialScanDone(true);
          setRefreshing(true);
          await api.tokenAnalytics.refresh();
          setRefreshing(false);
          await fetchData();
        }
      } catch {
        // silent
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dataResolution = classifyDataResolution(
    analyticsDaily?.time_series ?? [],
    analyticsDaily?.hourly_heatmap ?? [],
  );
  const composition = getTokenComposition(analytics);
  const canShowTemporalCharts = dataResolution.hasDatedBuckets;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-0 flex-shrink-0">
        <PageHeader title={t(locale, "tokens.title")} />
        <LanguageSwitcher />
      </div>

      {/* Tab bar + date presets */}
      <div className="flex items-center justify-between px-6 mt-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setDatePreset(preset.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                datePreset === preset.key
                  ? "bg-bg-secondary text-text-primary border border-border shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t(locale, `tokens.dateRange.${preset.key}` as never)}
            </button>
          ))}
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 overflow-y-auto">
        <PageBody>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
                {error}
              </div>
            )}

            {loading && !analytics ? (
              <div className="flex items-center justify-center h-64 text-text-muted">
                {t(locale, "tokens.loading")}
              </div>
            ) : (
              <>
                {/* ── Overview ── */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <TokenStatCards analytics={analytics} cacheEfficiency={cacheEfficiency} locale={locale} />
                    <DataResolutionPanel
                      resolution={dataResolution}
                      eventCount={analytics?.event_count ?? 0}
                      locale={locale}
                    />
                    <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] gap-4">
                      <TopModelsInsightTable data={analytics?.model_breakdown ?? []} locale={locale} />
                      <div className="space-y-4">
                        <CacheEfficiencyCard data={cacheEfficiency} locale={locale} />
                        <AgentDistribution data={analytics?.agent_breakdown ?? []} locale={locale} />
                      </div>
                    </div>
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
                    <ContributionGraph data={analyticsDaily?.time_series ?? []} locale={locale} />
                    <TimeBucketTable data={analyticsDaily?.time_series ?? []} locale={locale} />
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

                {/* ── Agents ── */}
                {activeTab === "agents" && (
                  <AgentStatusPanel
                    agents={agents}
                    loading={refreshing}
                    onRefresh={handleRefresh}
                    lastResult={lastRefreshResult}
                    locale={locale}
                  />
                )}
              </>
            )}
          </div>
        </PageBody>
      </div>
    </div>
  );
}
