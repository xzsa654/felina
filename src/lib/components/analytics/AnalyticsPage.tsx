import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Coins, RefreshCw } from "lucide-react";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
  StatCard,
} from "$lib/components/shared/PageScaffold";
import { api, type CostSummary } from "$lib/tauri/commands";
import { formatCost, formatNumber } from "$lib/utils/format";

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD?: number;
}

interface FullStats {
  modelUsage?: Record<string, ModelUsage>;
  hourCounts?: Record<string, number>;
  totalSessions: number;
  totalMessages: number;
  dailyActivity?: { date: string; messageCount: number; sessionCount: number; toolCallCount: number }[];
}

function tokenTotal(usage: ModelUsage) {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  );
}

function compact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<FullStats | null>(null);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, nextCost] = await Promise.all([
        api.stats.get(),
        api.budget.getCostSummary(),
      ]);
      setStats(nextStats as FullStats);
      setCost(nextCost);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const modelRows = useMemo(() => {
    const usage = stats?.modelUsage ?? {};
    return Object.entries(usage)
      .map(([model, data]) => ({
        model,
        ...data,
        total: tokenTotal(data),
      }))
      .sort((a, b) => b.total - a.total);
  }, [stats]);

  const totalTokens = modelRows.reduce((sum, row) => sum + row.total, 0);
  const maxTokens = Math.max(...modelRows.map((row) => row.total), 1);
  const daily = stats?.dailyActivity?.slice(-30) ?? [];
  const maxDaily = Math.max(...daily.map((d) => d.messageCount), 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Analytics"
        subtitle="Usage, cost, and activity trends"
        icon={BarChart3}
        actions={
          <ActionButton onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </ActionButton>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {loading ? (
          <LoadingLine label="Loading analytics..." />
        ) : !stats ? (
          <EmptyState title="No analytics data available" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="This Month" value={formatCost(cost?.this_month ?? 0)} />
              <StatCard label="Total Tokens" value={compact(totalTokens)} />
              <StatCard label="Sessions" value={formatNumber(stats.totalSessions)} />
              <StatCard label="Messages" value={formatNumber(stats.totalMessages)} />
            </div>

            <section className="bg-bg-secondary border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Coins size={14} className="text-text-muted" />
                <h2 className="text-sm font-medium text-text-secondary">Model Usage</h2>
              </div>
              {modelRows.length === 0 ? (
                <EmptyState title="No model usage recorded" />
              ) : (
                <div className="space-y-4">
                  {modelRows.map((row) => (
                    <div key={row.model}>
                      <div className="flex justify-between gap-3 mb-1">
                        <span className="text-sm font-mono text-text-primary truncate">
                          {row.model}
                        </span>
                        <span className="text-sm text-text-secondary">{compact(row.total)}</span>
                      </div>
                      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.max((row.total / maxTokens) * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-bg-secondary border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-text-muted" />
                <h2 className="text-sm font-medium text-text-secondary">Daily Messages</h2>
              </div>
              {daily.length === 0 ? (
                <EmptyState title="No daily activity recorded" />
              ) : (
                <div className="flex items-end gap-1 h-44">
                  {daily.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.messageCount} messages`}
                      className="flex-1 min-w-0 bg-info/60 rounded-t-sm"
                      style={{
                        height: `${Math.max((day.messageCount / maxDaily) * 100, 3)}%`,
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageBody>
    </div>
  );
}
