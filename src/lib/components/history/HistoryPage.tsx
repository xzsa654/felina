import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ExternalLink, FileText, FolderOpen, History as HistoryIcon, Loader2, Search } from "lucide-react";
import {
  PageBody,
  PageHeader,
  glassListRowClass,
  glassListSelectedRowClass,
  glassListSurfaceClass,
} from "$lib/components/shared/PageScaffold";
import { api } from "$lib/tauri/commands";
import type { AgentId, HistorySession, SessionTranscript, TranscriptEntry } from "$lib/types/token-analytics";
import { formatNumber } from "$lib/utils/format";

const AGENTS: { id: "all" | AgentId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "claude-code", label: "Claude" },
  { id: "codex-cli", label: "Codex" },
  { id: "gemini-cli", label: "Gemini" },
];

const PAGE_SIZE = 50;

const TRANSCRIPT_FILTERS = [
  { id: "all", label: "All" },
  { id: "conversation", label: "Conversation" },
  { id: "usage", label: "Usage" },
] as const;

type TranscriptFilter = (typeof TRANSCRIPT_FILTERS)[number]["id"];

function shortSession(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "No date";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function usageLine(entry: TranscriptEntry): string | null {
  if (entry.role !== "usage") return null;
  const parts = [
    entry.input_tokens != null ? `input ${formatNumber(entry.input_tokens)}` : null,
    entry.output_tokens != null ? `output ${formatNumber(entry.output_tokens)}` : null,
    entry.cache_read_tokens != null ? `cache ${formatNumber(entry.cache_read_tokens)}` : null,
    entry.cache_write_tokens != null ? `write ${formatNumber(entry.cache_write_tokens)}` : null,
    entry.reasoning_tokens != null ? `reasoning ${formatNumber(entry.reasoning_tokens)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function roleLabel(role: string): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Agent";
    default:
      return role;
  }
}

function entryShellClass(role: string): string {
  switch (role) {
    case "user":
      return "ml-auto max-w-[78%]";
    case "assistant":
      return "mr-auto max-w-[82%]";
    default:
      return "mx-auto max-w-[92%]";
  }
}

function entryBubbleClass(role: string): string {
  switch (role) {
    case "user":
      return "border-accent/40 bg-accent/10";
    case "assistant":
      return "border-success/30 bg-success/5";
    case "usage":
      return "border-purple-500/25 bg-purple-500/5";
    case "tool":
      return "border-warning/25 bg-warning/5";
    case "system":
      return "border-border bg-bg-secondary";
    default:
      return "border-border bg-bg-secondary";
  }
}

function rolePillClass(role: string): string {
  switch (role) {
    case "user":
      return "bg-accent/15 text-accent border-accent/30";
    case "assistant":
      return "bg-success-dim text-success border-success/30";
    default:
      return "bg-bg-tertiary text-text-muted border-border";
  }
}

function matchesTranscriptEntry(
  entry: TranscriptEntry,
  roleFilter: TranscriptFilter,
  query: string,
): boolean {
  if (roleFilter === "conversation" && entry.role === "usage") return false;
  if (roleFilter === "usage" && entry.role !== "usage") return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [entry.role, entry.model, entry.content, usageLine(entry)]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkAgent = searchParams.get("agent") as AgentId | null;
  const deepLinkSession = searchParams.get("session");

  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<"all" | AgentId>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HistorySession | null>(null);
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [transcriptFilter, setTranscriptFilter] = useState<TranscriptFilter>("conversation");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError(null);
    setHistoryOffset(0);
    setHistoryTotal(0);
    setSessions([]);
    setSelected(null);
    api.tokenAnalytics
      .refresh()
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        return api.tokenAnalytics.listHistorySessions({
          limit: PAGE_SIZE,
          offset: 0,
          agentFilter,
          query,
        });
      })
      .then((page) => {
        if (cancelled || !page) return;
        setSessions(page.sessions);
        setHistoryTotal(page.total);
        setHistoryOffset(page.sessions.length);
      })
      .catch((error) => {
        if (!cancelled) setListError(String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentFilter, query]);

  const hasMoreSessions = historyOffset < historyTotal;

  const filteredTranscriptEntries = useMemo(
    () =>
      transcript?.entries.filter((entry) =>
        matchesTranscriptEntry(entry, transcriptFilter, transcriptQuery),
      ) ?? [],
    [transcript, transcriptFilter, transcriptQuery],
  );

  useEffect(() => {
    if (!sessions.length || selected) return;
    const fromLink =
      deepLinkAgent && deepLinkSession
        ? sessions.find(
            (session) =>
              session.agent === deepLinkAgent && session.session_id === deepLinkSession,
          )
        : null;
    setSelected(fromLink ?? sessions[0] ?? null);
  }, [deepLinkAgent, deepLinkSession, selected, sessions]);

  useEffect(() => {
    if (!selected) {
      setTranscript(null);
      setTranscriptError(null);
      return;
    }

    let cancelled = false;
    setTranscript(null);
    setTranscriptError(null);
    setTranscriptLoading(true);
    api.tokenAnalytics
      .readSessionTranscript(selected.agent, selected.session_id)
      .then((result) => {
        if (!cancelled) setTranscript(result);
      })
      .catch((error) => {
        if (!cancelled) setTranscriptError(String(error));
      })
      .finally(() => {
        if (!cancelled) setTranscriptLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function selectSession(session: HistorySession) {
    setSelected(session);
    navigate(`/history?agent=${session.agent}&session=${encodeURIComponent(session.session_id)}`);
  }

  async function revealSelected() {
    if (!selected) return;
    setRevealing(true);
    setTranscriptError(null);
    try {
      await api.tokenAnalytics.revealSessionTranscript(selected.agent, selected.session_id);
    } catch (error) {
      setTranscriptError(String(error));
    } finally {
      setRevealing(false);
    }
  }

  async function loadMoreSessions() {
    if (loadingMore || !hasMoreSessions) return;
    setLoadingMore(true);
    setListError(null);
    try {
      const page = await api.tokenAnalytics.listHistorySessions({
        limit: PAGE_SIZE,
        offset: historyOffset,
        agentFilter,
        query,
      });
      setSessions((current) => [...current, ...page.sessions]);
      setHistoryTotal(page.total);
      setHistoryOffset((current) => current + page.sessions.length);
    } catch (error) {
      setListError(String(error));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader title="History" icon={HistoryIcon} />
      <PageBody>
        <div className="flex h-full min-h-0 overflow-hidden">
      <aside className={`w-80 shrink-0 border-r flex flex-col min-h-0 ${glassListSurfaceClass}`}>
        <div className="p-3 border-b border-white/5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              placeholder="Search session, project, model"
            />
          </div>
          <div className="flex items-center gap-1">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setAgentFilter(agent.id)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  agentFilter === agent.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-white/10 bg-white/[0.02] text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
                }`}
              >
                {agent.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-3 py-4 text-xs text-text-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Loading history
            </div>
          ) : listError ? (
            <div className="px-3 py-4 text-xs text-danger">{listError}</div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <FileText size={24} className="mx-auto mb-2 text-text-muted opacity-50" />
              <p className="text-sm text-text-secondary">No sessions found</p>
            </div>
          ) : (
            <>
              {sessions.map((session) => {
                const active =
                  selected?.agent === session.agent &&
                  selected?.session_id === session.session_id;
                return (
                  <button
                    key={`${session.agent}:${session.session_id}`}
                    type="button"
                    onClick={() => selectSession(session)}
                    className={`mx-2 mb-1 w-[calc(100%-1rem)] rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? glassListSelectedRowClass
                        : glassListRowClass
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-text-primary truncate">
                        {shortSession(session.session_id)}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {formatTimestamp(session.timestamp)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                      <span>{session.agent}</span>
                      {session.model && <span className="truncate">{session.model}</span>}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-text-muted truncate">
                        {session.project ?? "No project"}
                      </span>
                      <span className="text-text-secondary shrink-0">
                        {formatNumber(session.tokens)} tokens · {formatNumber(session.messages)} msgs
                      </span>
                    </div>
                    {!session.transcript_available && (
                      <p className="mt-1 text-[10px] text-warning">Transcript unavailable</p>
                    )}
                  </button>
                );
              })}
              {hasMoreSessions && (
                <div className="p-3">
                  <button
                    type="button"
                    onClick={() => void loadMoreSessions()}
                    disabled={loadingMore}
                    className="w-full h-8 inline-flex items-center justify-center gap-2 rounded border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 size={14} className="animate-spin" />}
                    Load more ({sessions.length}/{historyTotal})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a session</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-5xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-text-primary font-mono truncate">
                    {selected.session_id}
                  </h3>
                  <span className="px-2 py-0.5 rounded border border-border text-[10px] text-text-muted">
                    {selected.agent}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {[selected.project, selected.model, formatTimestamp(selected.timestamp)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {(transcript?.source_path || selected.source_path) && (
                  <p className="mt-2 text-[10px] text-text-muted font-mono truncate">
                    {transcript?.source_path ?? selected.source_path}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={revealSelected}
                  disabled={revealing}
                  className="h-8 px-3 inline-flex items-center gap-2 rounded border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-60"
                >
                  {revealing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FolderOpen size={14} />
                  )}
                  Reveal
                </button>
              </div>
            </div>

            {transcript && transcript.entries.length > 0 && (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative sm:w-72">
                  <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
                  <input
                    value={transcriptQuery}
                    onChange={(event) => setTranscriptQuery(event.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    placeholder="Search transcript content"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {TRANSCRIPT_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setTranscriptFilter(filter.id)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        transcriptFilter === filter.id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {transcriptLoading ? (
              <div className="text-sm text-text-muted flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Loading transcript
              </div>
            ) : transcriptError ? (
              <div className="border border-warning/30 bg-warning-dim text-warning rounded-md p-4 text-sm">
                <p className="font-medium">Transcript unavailable</p>
                <p className="text-xs mt-1">{transcriptError}</p>
                <p className="text-xs mt-2 font-mono">
                  {selected.agent}/{selected.session_id}
                </p>
              </div>
            ) : transcript && transcript.entries.length === 0 ? (
              <div className="border border-border rounded-md p-8 text-center text-sm text-text-muted">
                Transcript has no displayable entries
              </div>
            ) : transcript && filteredTranscriptEntries.length === 0 ? (
              <div className="border border-border rounded-md p-8 text-center text-sm text-text-muted">
                No transcript entries match the current filters
              </div>
            ) : transcript ? (
              <div className="space-y-3">
                {filteredTranscriptEntries.map((entry, index) => {
                  const usage = usageLine(entry);
                  return (
                    <div
                      key={`${entry.timestamp ?? "entry"}-${index}`}
                      className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <article
                        className={`border rounded-md p-3 ${entryShellClass(entry.role)} ${entryBubbleClass(entry.role)}`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-medium ${rolePillClass(entry.role)}`}>
                              {roleLabel(entry.role)}
                            </span>
                            {entry.model && (
                              <span className="text-[10px] text-text-muted">{entry.model}</span>
                            )}
                          </div>
                          {entry.timestamp && (
                            <span className="text-[10px] text-text-muted">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-sm text-text-primary font-sans leading-relaxed">
                          {usage ?? entry.content}
                        </pre>
                      </article>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {transcript?.source_path && (
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  void revealSelected();
                }}
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover"
              >
                <ExternalLink size={12} />
                Open source location
              </a>
            )}
          </div>
        )}
      </main>
      </div>
      </PageBody>
    </div>
  );
}
