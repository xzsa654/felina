import { useEffect, useState } from "react";
import { Gauge, RefreshCw, Save, Search, ToggleLeft, ToggleRight } from "lucide-react";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
  StatCard,
} from "$lib/components/shared/PageScaffold";
import { api } from "$lib/tauri/commands";
import { useProjectContextStore } from "$lib/stores/project-context";
import type { DiscoverResult, FilterRules, OptimizerStatus, SavingsData } from "$lib/types";

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function TokenSavingsPage() {
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const [status, setStatus] = useState<OptimizerStatus | null>(null);
  const [savings, setSavings] = useState<SavingsData | null>(null);
  const [discover, setDiscover] = useState<DiscoverResult | null>(null);
  const [filters, setFilters] = useState<FilterRules | null>(null);
  const [filterDraft, setFilterDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextSavings, nextFilters] = await Promise.all([
        api.tokenSavings.status(),
        api.tokenSavings.savings("daily", projectPath ?? undefined),
        api.tokenSavings.getFilters(),
      ]);
      setStatus(nextStatus);
      setSavings(nextSavings);
      setFilters(nextFilters);
      setFilterDraft(nextFilters.rawContent);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
  }, [projectPath]);

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      if (status?.enabled) await api.tokenSavings.disable();
      else await api.tokenSavings.enable();
      await load();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  async function runDiscover() {
    setBusy("discover");
    setError(null);
    try {
      setDiscover(await api.tokenSavings.discover(projectPath ?? undefined));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveFilters() {
    setBusy("filters");
    setError(null);
    try {
      await api.tokenSavings.saveFilters(filterDraft);
      await load();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Token Savings"
        subtitle="Optimizer status, savings reports, and filter rules"
        icon={Gauge}
        actions={
          <>
            <ProjectPicker />
            <ActionButton onClick={runDiscover} disabled={!!busy}>
              <Search size={14} />
              Discover
            </ActionButton>
            <ActionButton onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </ActionButton>
            <ActionButton onClick={toggle} disabled={!!busy || loading} variant="primary">
              {status?.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {status?.enabled ? "Enabled" : "Enable"}
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        {loading ? (
          <LoadingLine />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Commands" value={savings?.summary.totalCommands ?? 0} />
              <StatCard label="Saved Tokens" value={compact(savings?.summary.totalSaved ?? 0)} />
              <StatCard label="Avg Savings" value={`${(savings?.summary.avgSavingsPct ?? 0).toFixed(1)}%`} />
              <StatCard label="Filters" value={filters?.filterCount ?? 0} sub={`${filters?.builtinCount ?? 0} builtin`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <section className="bg-bg-secondary border border-border rounded-lg p-4">
                <h2 className="text-sm font-medium text-text-secondary mb-3">Top Commands</h2>
                {!savings || savings.topCommands.length === 0 ? (
                  <EmptyState title="No command savings yet" />
                ) : (
                  <div className="space-y-3">
                    {savings.topCommands.slice(0, 12).map((item) => (
                      <div key={item.command}>
                        <div className="flex justify-between gap-3 text-sm mb-1">
                          <span className="font-mono text-text-primary truncate">{item.command}</span>
                          <span className="text-text-secondary">{compact(item.totalSaved)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${Math.min(item.avgSavingsPct, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="bg-bg-secondary border border-border rounded-lg p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-text-secondary">Filter Rules</h2>
                  <ActionButton onClick={saveFilters} disabled={!!busy}>
                    <Save size={14} />
                    Save
                  </ActionButton>
                </div>
                <textarea
                  className="flex-1 min-h-[320px] resize-none bg-bg-primary border border-border rounded-lg p-3 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
                  value={filterDraft}
                  onChange={(e) => setFilterDraft(e.target.value)}
                />
              </section>
            </div>

            {discover && (
              <section className="bg-bg-secondary border border-border rounded-lg p-4">
                <h2 className="text-sm font-medium text-text-secondary mb-3">Discovery</h2>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <StatCard label="Sessions Scanned" value={discover.sessionsScanned} />
                  <StatCard label="Commands" value={discover.totalCommands} />
                  <StatCard label="Potential Savings" value={compact(discover.totalPotentialSavings)} />
                </div>
                <div className="divide-y divide-border">
                  {discover.opportunities.slice(0, 20).map((item) => (
                    <div key={item.command} className="py-2 flex justify-between gap-3">
                      <span className="text-sm font-mono text-text-primary truncate">{item.command}</span>
                      <span className="text-sm text-text-secondary">{compact(item.estimatedSavingsTokens)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
