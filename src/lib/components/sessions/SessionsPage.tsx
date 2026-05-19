import { useEffect, useState } from "react";
import { Download, History, RefreshCw, Search } from "lucide-react";
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
import { api, type SessionEvent, type SessionSummary } from "$lib/tauri/commands";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.sessions.list(100, 0);
      setSessions(result.sessions);
      setTotal(result.total);
      setSelected(result.sessions[0] ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setEvents([]);
      return;
    }
    setDetailLoading(true);
    api.sessions
      .load(selected.path, 200, 0)
      .then((result) => setEvents(result.events))
      .catch((e) => setError(String(e)))
      .finally(() => setDetailLoading(false));
  }, [selected]);

  const filtered = sessions.filter((session) => {
    const haystack = `${session.project_path} ${session.first_message ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  async function exportMarkdown() {
    if (!selected) return;
    try {
      await api.sessions.exportMarkdown(selected.path);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Sessions"
        subtitle="Browse Claude Code session history"
        icon={History}
        actions={
          <>
            <ProjectPicker />
            <ActionButton onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </ActionButton>
            <ActionButton onClick={exportMarkdown} disabled={!selected}>
              <Download size={14} />
              Export
            </ActionButton>
          </>
        }
      />
      <PageBody>
        {error && <ErrorBanner error={error} />}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Sessions" value={total} />
          <StatCard label="Loaded" value={sessions.length} />
          <StatCard label="Selected Events" value={events.length} />
        </div>
        {loading ? (
          <LoadingLine />
        ) : (
          <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4 h-[calc(100vh-250px)] min-h-[520px]">
            <aside className="bg-bg-secondary border border-border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border relative">
                <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  className="w-full pl-8 pr-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search loaded sessions..."
                />
              </div>
              <div className="overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No sessions found" />
                  </div>
                ) : (
                  filtered.map((session) => (
                    <button
                      key={session.path}
                      className={`w-full px-3 py-3 text-left border-b border-border last:border-b-0 hover:bg-bg-hover ${
                        selected?.path === session.path ? "bg-accent/10" : ""
                      }`}
                      onClick={() => setSelected(session)}
                    >
                      <p className="text-sm text-text-primary truncate">
                        {session.first_message ?? session.id}
                      </p>
                      <p className="text-xs text-text-muted truncate">{session.project_path}</p>
                      <p className="text-[11px] text-text-muted mt-1">
                        {session.entry_count} entries · {formatDate(session.last_timestamp)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </aside>
            <section className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
              {detailLoading ? (
                <div className="p-4">
                  <LoadingLine label="Loading session..." />
                </div>
              ) : !selected ? (
                <div className="p-4">
                  <EmptyState title="Select a session" />
                </div>
              ) : (
                <div className="h-full overflow-y-auto divide-y divide-border">
                  {events.map((event, index) => (
                    <div key={`${event.timestamp}:${index}`} className="p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="px-2 py-0.5 rounded bg-bg-tertiary text-xs text-text-secondary">
                          {event.type}
                        </span>
                        <span className="text-xs text-text-muted">{formatDate(event.timestamp)}</span>
                      </div>
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(event.content, null, 2)}
                      </pre>
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
