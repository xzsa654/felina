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
import MarkdownPreview from "$lib/components/shared/MarkdownPreview";
import ErrorNotice from "$lib/components/shared/ErrorNotice";
import { api } from "$lib/tauri/commands";
import { t, type Locale } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import type { AgentId, HistorySession, TranscriptEntry } from "$lib/types/token-analytics";
import { formatNumber } from "$lib/utils/format";
import { useHistorySessions, useSessionTranscript } from "./hooks/useHistoryQueries";

// Agent product names (Claude/Codex/Gemini) stay verbatim; only "All" is translated.
const AGENTS: { id: "all" | AgentId; label: string | null }[] = [
  { id: "all", label: null },
  { id: "claude-code", label: "Claude" },
  { id: "codex-cli", label: "Codex" },
  { id: "gemini-cli", label: "Gemini" },
];

const TRANSCRIPT_FILTERS = ["all", "conversation", "usage"] as const;

type TranscriptFilter = (typeof TRANSCRIPT_FILTERS)[number];

function shortSession(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

function formatTimestamp(ts: number | null, locale: Locale): string {
  if (!ts) return t(locale, "history.noDate");
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Token metric tags (input/output/cache/write/reasoning) stay verbatim as telemetry identifiers.
function usageLine(entry: TranscriptEntry, locale: Locale): string | null {
  if (entry.role !== "usage") return null;
  const parts = [
    entry.input_tokens != null ? `input ${formatNumber(entry.input_tokens, locale)}` : null,
    entry.output_tokens != null ? `output ${formatNumber(entry.output_tokens, locale)}` : null,
    entry.cache_read_tokens != null ? `cache ${formatNumber(entry.cache_read_tokens, locale)}` : null,
    entry.cache_write_tokens != null ? `write ${formatNumber(entry.cache_write_tokens, locale)}` : null,
    entry.reasoning_tokens != null ? `reasoning ${formatNumber(entry.reasoning_tokens, locale)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function roleLabel(role: string, locale: Locale): string {
  switch (role) {
    case "user":
      return t(locale, "history.roleUser");
    case "assistant":
      return t(locale, "history.roleAgent");
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
      return "border-info/25 bg-info/5";
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
  locale: Locale,
): boolean {
  if (roleFilter === "conversation" && (entry.role === "usage" || entry.channel === "background"))
    return false;
  if (roleFilter === "usage" && entry.role !== "usage") return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [entry.role, entry.model, entry.content, usageLine(entry, locale)]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

export default function HistoryPage() {
  const locale = useLocaleStore((s) => s.locale);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkAgent = searchParams.get("agent") as AgentId | null;
  const deepLinkSession = searchParams.get("session");

  const [agentFilter, setAgentFilter] = useState<"all" | AgentId>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HistorySession | null>(null);
  const [transcriptFilter, setTranscriptFilter] = useState<TranscriptFilter>("conversation");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const sessionsQuery = useHistorySessions({ agentFilter, query });
  const sessions = sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? [];
  const historyTotal = sessionsQuery.data?.pages.at(-1)?.total ?? 0;
  const loading = sessionsQuery.isPending;
  const listError = sessionsQuery.error ? String(sessionsQuery.error) : null;

  const transcriptQueryResult = useSessionTranscript(selected);
  const transcript = transcriptQueryResult.data ?? null;
  const transcriptLoading = transcriptQueryResult.isLoading;
  const transcriptError = transcriptQueryResult.error
    ? String(transcriptQueryResult.error)
    : revealError;

  const filteredTranscriptEntries = useMemo(
    () =>
      transcript?.entries.filter((entry) =>
        matchesTranscriptEntry(entry, transcriptFilter, transcriptQuery, locale),
      ) ?? [],
    [transcript, transcriptFilter, transcriptQuery, locale],
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

  function selectSession(session: HistorySession) {
    setSelected(session);
    setRevealError(null);
    navigate(`/history?agent=${session.agent}&session=${encodeURIComponent(session.session_id)}`);
  }

  async function revealSelected() {
    if (!selected) return;
    setRevealing(true);
    setRevealError(null);
    try {
      await api.tokenAnalytics.revealSessionTranscript(selected.agent, selected.session_id);
    } catch (error) {
      setRevealError(String(error));
    } finally {
      setRevealing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader title={t(locale, "history.title")} icon={HistoryIcon} />
      <PageBody>
        <div className="flex h-full min-h-0 overflow-hidden">
      <aside className={`w-80 shrink-0 border-r flex flex-col min-h-0 ${glassListSurfaceClass}`}>
        <div className="p-3 border-b border-border space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              placeholder={t(locale, "history.searchSessions")}
            />
          </div>
          <div className="flex items-center gap-1">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setAgentFilter(agent.id);
                  setSelected(null);
                }}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  agentFilter === agent.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-text-muted hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {agent.label ?? t(locale, "history.agentAll")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-3 py-4 text-xs text-text-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t(locale, "history.loadingHistory")}
            </div>
          ) : listError ? (
            <ErrorNotice
              title={t(locale, "history.listLoadFailed")}
              detail={listError}
              className="mx-2 my-2"
            />
          ) : sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <FileText size={24} className="mx-auto mb-2 text-text-muted opacity-50" />
              <p className="text-sm text-text-secondary">{t(locale, "history.noSessions")}</p>
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
                        {formatTimestamp(session.timestamp, locale)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                      <span>{session.agent}</span>
                      {session.model && <span className="truncate">{session.model}</span>}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-text-muted truncate">
                        {session.project ?? t(locale, "history.noProject")}
                      </span>
                      <span className="text-text-secondary shrink-0">
                        {t(locale, "history.tokensMsgs", {
                          tokens: formatNumber(session.tokens, locale),
                          msgs: formatNumber(session.messages, locale),
                        })}
                      </span>
                    </div>
                    {!session.transcript_available && (
                      <p className="mt-1 text-[10px] text-warning">{t(locale, "history.transcriptUnavailable")}</p>
                    )}
                  </button>
                );
              })}
              {sessionsQuery.hasNextPage && (
                <div className="p-3">
                  <button
                    type="button"
                    onClick={() => void sessionsQuery.fetchNextPage()}
                    disabled={sessionsQuery.isFetchingNextPage}
                    className="w-full h-8 inline-flex items-center justify-center gap-2 rounded border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-60"
                  >
                    {sessionsQuery.isFetchingNextPage && <Loader2 size={14} className="animate-spin" />}
                    {t(locale, "history.loadMore", {
                      loaded: String(sessions.length),
                      total: String(historyTotal),
                    })}
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
              <p className="text-sm">{t(locale, "history.selectSession")}</p>
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
                  {[selected.project, selected.model, formatTimestamp(selected.timestamp, locale)]
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
                  {t(locale, "history.reveal")}
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
                    placeholder={t(locale, "history.searchTranscript")}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {TRANSCRIPT_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTranscriptFilter(filter)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        transcriptFilter === filter
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      }`}
                    >
                      {t(locale, `history.filter.${filter}` as never)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {transcriptLoading ? (
              <div className="text-sm text-text-muted flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t(locale, "history.loadingTranscript")}
              </div>
            ) : transcriptError ? (
              <ErrorNotice
                title={t(locale, "history.transcriptLoadFailed")}
                detail={`${transcriptError}\n${selected.agent}/${selected.session_id}`}
              />
            ) : transcript && transcript.entries.length === 0 ? (
              <div className="border border-border rounded-md p-8 text-center text-sm text-text-muted">
                {t(locale, "history.emptyTranscript")}
              </div>
            ) : transcript && filteredTranscriptEntries.length === 0 ? (
              <div className="border border-border rounded-md p-8 text-center text-sm text-text-muted">
                {t(locale, "history.noFilterMatches")}
              </div>
            ) : transcript ? (
              <div className="space-y-3">
                {filteredTranscriptEntries.map((entry, index) => {
                  const usage = usageLine(entry, locale);
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
                              {roleLabel(entry.role, locale)}
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
                        {usage == null && (entry.role === "user" || entry.role === "assistant") ? (
                          <MarkdownPreview
                            markdown={entry.content ?? ""}
                            escapeHtml
                            className="md-compact"
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap break-words text-sm text-text-primary font-sans leading-relaxed">
                            {usage ?? entry.content}
                          </pre>
                        )}
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
                {t(locale, "history.openSource")}
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
