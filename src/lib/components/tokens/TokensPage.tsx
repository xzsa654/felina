import { useState, useEffect, useCallback } from "react";
import { api } from "$lib/tauri/commands";
import type {
  TokenAnalytics,
  CacheEfficiency,
  AgentStatus,
  TimeGranularity,
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
import HourlyHeatmap from "./components/HourlyHeatmap";
import CacheEfficiencyCard from "./components/CacheEfficiencyCard";
import AgentDistribution from "./components/AgentDistribution";
import AgentStatusPanel from "./components/AgentStatusPanel";
import GranularityPicker from "./components/GranularityPicker";
import DateRangeFilter from "./components/DateRangeFilter";
import CostBudgetCard from "./components/CostBudgetCard";

export default function TokensPage() {
  const locale = useLocaleStore((s) => s.locale);
  const [granularity, setGranularity] = useState<TimeGranularity>("daily");
  const [dateRange, setDateRange] = useState<number | null>(7);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [cacheEfficiency, setCacheEfficiency] = useState<CacheEfficiency | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialScanDone, setInitialScanDone] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dateEnd = Math.floor(Date.now() / 1000);
      const dateStart = dateRange
        ? dateEnd - dateRange * 86400
        : undefined;

      const [a, ce, ag] = await Promise.all([
        api.tokenAnalytics.get({
          granularity,
          dateStart,
          dateEnd,
        }),
        api.tokenAnalytics.getCacheEfficiency(dateStart, dateEnd),
        api.tokenAnalytics.getAvailableAgents(),
      ]);

      setAnalytics(a);
      setCacheEfficiency(ce);
      setAgents(ag);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [granularity, dateRange]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await api.tokenAnalytics.refresh();
      await fetchData();
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }

  // On mount: fetch DB data. If empty, auto-refresh once to populate.
  useEffect(() => {
    async function init() {
      await fetchData();
      // Check if DB has no events — if so, trigger initial scan
      const dateEnd = Math.floor(Date.now() / 1000);
      const dateStart = dateRange ? dateEnd - dateRange * 86400 : undefined;
      try {
        const a = await api.tokenAnalytics.get({ granularity: "daily", dateStart, dateEnd });
        if (a.event_count === 0 && !initialScanDone) {
          setInitialScanDone(true);
          setRefreshing(true);
          await api.tokenAnalytics.refresh();
          setRefreshing(false);
          await fetchData();
        }
      } catch {
        // Silent — fetchData already handles errors
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <PageHeader title={t(locale, "tokens.title")} />
        <LanguageSwitcher />
      </div>
      <PageBody>
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GranularityPicker value={granularity} onChange={setGranularity} locale={locale} />
          <DateRangeFilter value={dateRange} onChange={setDateRange} locale={locale} />
        </div>
      </div>

      {loading && !analytics ? (
        <div className="flex items-center justify-center h-64 text-text-muted">
          {t(locale, "tokens.loading")}
        </div>
      ) : (
        <div className="space-y-4">
          <TokenStatCards analytics={analytics} cacheEfficiency={cacheEfficiency} locale={locale} />

          <AgentStatusPanel
            agents={agents}
            loading={refreshing}
            onRefresh={handleRefresh}
            locale={locale}
          />

          <div className="grid grid-cols-2 gap-4">
            <TokenTimeSeries data={analytics?.time_series ?? []} locale={locale} />
            <TokenCostTimeSeries data={analytics?.time_series ?? []} locale={locale} />
          </div>

          <HourlyHeatmap data={analytics?.hourly_heatmap ?? []} locale={locale} />

          <div className="grid grid-cols-2 gap-4">
            <ModelBreakdownChart data={analytics?.model_breakdown ?? []} locale={locale} />
            <div className="space-y-4">
              <CacheEfficiencyCard data={cacheEfficiency} locale={locale} />
              <AgentDistribution data={analytics?.agent_breakdown ?? []} locale={locale} />
              <CostBudgetCard analytics={analytics} locale={locale} />
            </div>
          </div>

          <ModelBreakdownTable data={analytics?.model_breakdown ?? []} locale={locale} />
        </div>
      )}
      </PageBody>
    </div>
  );
}
