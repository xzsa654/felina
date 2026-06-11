import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "$lib/tauri/commands";
import type { AgentId, HistorySession } from "$lib/types/token-analytics";

export const PAGE_SIZE = 50;

/** Next pageParam (offset) for the sessions infinite query; undefined when fully loaded. */
export function nextHistoryPageOffset(loadedCount: number, total: number): number | undefined {
  return loadedCount < total ? loadedCount : undefined;
}

// ── Query key factory ──────────────────────────────────────────────────────────

export const historyKeys = {
  all: ["history"] as const,
  sessions: (params: { agentFilter: "all" | AgentId; query: string }) =>
    ["history", "sessions", params.agentFilter, params.query] as const,
  transcript: (agent: AgentId, sessionId: string) =>
    ["history", "transcript", agent, sessionId] as const,
};

// ── useHistorySessions ─────────────────────────────────────────────────────────

export function useHistorySessions(params: { agentFilter: "all" | AgentId; query: string }) {
  return useInfiniteQuery({
    queryKey: historyKeys.sessions(params),
    queryFn: async ({ pageParam }) => {
      if (pageParam === 0) {
        // Refresh-on-mount: freshness precondition for the first page; failure is non-blocking.
        await api.tokenAnalytics.refresh().catch(() => {});
      }
      return api.tokenAnalytics.listHistorySessions({
        limit: PAGE_SIZE,
        offset: pageParam,
        agentFilter: params.agentFilter,
        query: params.query,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      nextHistoryPageOffset(
        allPages.reduce((count, page) => count + page.sessions.length, 0),
        lastPage.total,
      ),
  });
}

// ── useSessionTranscript ───────────────────────────────────────────────────────

export function useSessionTranscript(selected: HistorySession | null) {
  return useQuery({
    queryKey: selected
      ? historyKeys.transcript(selected.agent, selected.session_id)
      : ["history", "transcript", "none"],
    queryFn: () => api.tokenAnalytics.readSessionTranscript(selected!.agent, selected!.session_id),
    enabled: selected != null,
  });
}
