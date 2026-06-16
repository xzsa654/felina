import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { PageBody, PageHeader } from "$lib/components/shared/PageScaffold";
import ErrorNotice from "$lib/components/shared/ErrorNotice";
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
import TokenImportProgress from "./components/TokenImportProgress";
import LeaderboardPanel from "$lib/components/leaderboard/LeaderboardPanel";
import { Coins, RefreshCw } from "lucide-react";
import {
  cacheReadRatio,
  classifyDataResolution,
  getTokenComposition,
} from "./token-insights";
import {
  useAnalyticsPair,
  useRefreshTokenData,
  useTokenImportStatus,
} from "./hooks/useTokenQueries";

type Tab = "overview" | "daily" | "models" | "leaderboard";
type DatePreset = "all" | "today" | "days7" | "days30" | "days90";

const DATE_PRESETS: { key: DatePreset; days: number | null }[] = [
  { key: "all", days: null },
  { key: "today", days: 1 },
  { key: "days7", days: 7 },
  { key: "days30", days: 30 },
  { key: "days90", days: 90 },
];

const TABS: { key: Tab; i18nKey: string }[] = [
  { key: "overview", i18nKey: "tokens.tabs.overview" },
  { key: "daily", i18nKey: "tokens.tabs.daily" },
  { key: "models", i18nKey: "tokens.tabs.models" },
  { key: "leaderboard", i18nKey: "tokens.tabs.leaderboard" },
];

const DATE_LABEL_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseTab(value: string | null): Tab | null {
  return value === "overview" || value === "daily" || value === "models" || value === "leaderboard"
    ? value
    : null;
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
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dailyPreset, setDailyPreset] = useState<DatePreset>("all");

  // ── Queries ───────────────────────────────────────────────────────────────

  const monthlyDays = DATE_PRESETS.find((p) => p.key === datePreset)!.days;
  const dailyDays = DATE_PRESETS.find((p) => p.key === dailyPreset)!.days;
  const importStatusQuery = useTokenImportStatus();
  const importRefreshStartedRef = useRef(false);
  const needsImport = importStatusQuery.data?.needs_import === true;
  const analyticsEnabled =
    importStatusQuery.isError || importStatusQuery.data?.needs_import === false;

  const analyticsPairQuery = useAnalyticsPair({
    monthlyDays,
    dailyDays,
    monthlySource: datePreset === "all" ? undefined : "auto_dated",
    dailySource: "auto_dated",
    overviewIsToday: datePreset === "today",
    dailyIsToday: dailyPreset === "today",
    enabled: analyticsEnabled,
  });

  const refreshMutation = useRefreshTokenData();

  useEffect(() => {
    if (needsImport && !importRefreshStartedRef.current) {
      importRefreshStartedRef.current = true;
      refreshMutation.mutate();
    }
  }, [needsImport]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-refresh when switching to "today" ────────────────────────────────

  const isToday = datePreset === "today" || dailyPreset === "today";
  const prevTodayRef = useRef(false);

  useEffect(() => {
    if (isToday && !prevTodayRef.current && !needsImport) {
      refreshMutation.mutate();
    }
    prevTodayRef.current = isToday;
  }, [isToday, needsImport]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-sync when entering the Daily tab ─────────────────────────────────

  const prevDailyTabRef = useRef(activeTab === "daily");

  useEffect(() => {
    const isDailyTab = activeTab === "daily";
    if (isDailyTab && !prevDailyTabRef.current && !needsImport) {
      refreshMutation.mutate();
    }
    prevDailyTabRef.current = isDailyTab;
  }, [activeTab, needsImport]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── searchParams sync ─────────────────────────────────────────────────────

  useEffect(() => {
    const nextTab = parseTab(searchParams.get("tab"));
    const nextDate = parseDate(searchParams.get("date"));
    const resolvedTab = nextTab ?? (nextDate ? "daily" : null);
    if (resolvedTab) {
      setActiveTab((current) => (current === resolvedTab ? current : resolvedTab));
    }
    setSelectedDailyDate(nextDate);
  }, [searchParams]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const analytics = analyticsPairQuery.data?.monthly ?? null;
  const analyticsDaily = analyticsPairQuery.data?.daily ?? null;
  const cacheEfficiency = analyticsPairQuery.data?.cache_efficiency ?? null;
  const isImporting = needsImport || (importRefreshStartedRef.current && refreshMutation.isPending);
  const isPending = importStatusQuery.isPending || analyticsPairQuery.isPending;
  const queryError = analyticsPairQuery.error;

  const dataResolution = classifyDataResolution(
    analyticsDaily?.time_series ?? [],
    analyticsDaily?.hourly_heatmap ?? [],
  );
  const composition = getTokenComposition(analytics);
  const canShowTemporalCharts = dataResolution.hasDatedBuckets;

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={t(locale, "tokens.title")}
        icon={Coins}
        bottomSlot={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-bg-secondary/50 text-text-primary shadow-sm"
                      : "text-text-muted hover:bg-bg-secondary/30 hover:text-text-secondary"
                  }`}
                >
                  {t(locale, tab.i18nKey as never)}
                </button>
              ))}
            </div>

            {activeTab !== "leaderboard" && (
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_PRESETS.map((preset) => {
                const isDaily = activeTab === "daily";
                const active = isDaily ? dailyPreset : datePreset;
                const setter = isDaily ? setDailyPreset : setDatePreset;
                return (
                  <div key={preset.key} className="flex items-center gap-1">
                    {preset.key === "all" && (
                      <button
                        type="button"
                        onClick={() => refreshMutation.mutate()}
                        disabled={refreshMutation.isPending}
                        title={t(locale, "tokens.refresh")}
                        aria-label={t(locale, "tokens.refresh")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-bg-secondary text-text-muted shadow-sm transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw size={13} className={refreshMutation.isPending ? "animate-spin" : ""} />
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
            )}
          </div>
        }
      />

      <PageBody>
        <div className="space-y-4">
            {activeTab === "leaderboard" ? (
              <LeaderboardPanel locale={locale} />
            ) : (
            <>
            {queryError && (
              <ErrorNotice title={t(locale, "tokens.queryFailed")} detail={String(queryError)} />
            )}

            {isImporting ? (
              <TokenImportProgress />
            ) : isPending ? (
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
            </>
            )}

        </div>
      </PageBody>
    </div>
  );
}
