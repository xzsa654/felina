import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Database,
  Network,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingLine,
  PageBody,
  PageHeader,
  StatCard,
} from "$lib/components/shared/PageScaffold";
import { api, type ContextEngineStatus, type RecentToolResult } from "$lib/tauri/commands";

function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function formatTime(ts: number) {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ContextEnginePage() {
  const [status, setStatus] = useState<ContextEngineStatus | null>(null);
  const [recent, setRecent] = useState<RecentToolResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextRecent] = await Promise.all([
        api.contextEngine.status(),
        api.contextEngine.recentToolResults(undefined, 50),
      ]);
      setStatus(nextStatus);
      setRecent(nextRecent);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const totalRows = (status?.toolResults ?? 0) + (status?.turns ?? 0);
    const embeddedRows = (status?.embeddedToolResults ?? 0) + (status?.embeddedTurns ?? 0);
    return {
      totalRows,
      embeddedRows,
      coverage: totalRows > 0 ? Math.round((embeddedRows / totalRows) * 100) : 0,
      remaining: Math.max(0, totalRows - embeddedRows),
    };
  }, [status]);

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      if (status?.enabled) await api.contextEngine.disable();
      else await api.contextEngine.enable();
      await load();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  async function reindex() {
    setBusy("reindex");
    setError(null);
    try {
      let guard = 0;
      while (guard++ < 200) {
        const report = await api.contextEngine.reindex(64);
        if (report.remaining <= 0 || report.processed === 0) break;
      }
      await load();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  async function purgeLegacy() {
    setBusy("purge");
    setError(null);
    try {
      await api.contextEngine.purgeLegacy();
      await load();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  function copyRef(id: string) {
    void navigator.clipboard.writeText(`glyphic-ctx expand ${id}`);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Context Engine"
        subtitle="Structured retrieval and tool-output virtualization"
        icon={Network}
        actions={
          <>
            <ActionButton onClick={purgeLegacy} disabled={!!busy || loading} title="Remove legacy rows">
              <Trash2 size={14} />
              Clean
            </ActionButton>
            <ActionButton onClick={reindex} disabled={!!busy || loading || totals.remaining === 0}>
              <Sparkles size={14} />
              Reindex
            </ActionButton>
            <ActionButton onClick={load} disabled={!!busy || loading}>
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
        ) : !status ? (
          <EmptyState title="Context engine status unavailable" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Rows" value={totals.totalRows.toLocaleString()} />
              <StatCard label="Embedded" value={`${totals.coverage}%`} sub={`${totals.embeddedRows.toLocaleString()} rows`} />
              <StatCard label="Stored" value={formatBytes(status.bytesStored)} />
              <StatCard label="Sidecar" value={status.sidecarInstalled ? "Installed" : "Missing"} sub={status.sidecarVersion ?? undefined} />
            </div>

            <section className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <Database size={14} className="text-text-muted" />
                <h2 className="text-sm font-medium text-text-secondary">Recent Tool Results</h2>
              </div>
              {recent.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No recent results" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recent.map((item) => (
                    <div key={item.id} className="p-4 flex gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded bg-bg-tertiary text-[11px] text-text-secondary">
                            {item.tool}
                          </span>
                          <span className="text-xs text-text-muted">{formatTime(item.ts)}</span>
                          <span className="text-xs text-text-muted">{formatBytes(item.sizeBytes)}</span>
                        </div>
                        <p className="text-sm text-text-primary line-clamp-2">{item.summary}</p>
                        <p className="text-xs text-text-muted font-mono truncate mt-1">{item.project}</p>
                      </div>
                      <button
                        type="button"
                        className="p-2 text-text-muted hover:text-text-primary"
                        onClick={() => copyRef(item.id)}
                        aria-label="Copy reference"
                      >
                        {copiedId === item.id ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
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
