import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "$lib/tauri/commands";
import type { LeaderboardSort } from "$lib/types";

// ── Query key factory ──────────────────────────────────────────────────────────

export const leaderboardKeys = {
  all: ["leaderboard"] as const,
  list: (sort: LeaderboardSort, days: number | null) =>
    ["leaderboard", "list", sort, days] as const,
  graph: (handle: string) => ["leaderboard", "graph", handle] as const,
  models: (handle: string) => ["leaderboard", "models", handle] as const,
};

export function useLeaderboard(sort: LeaderboardSort, days: number | null) {
  return useQuery({
    queryKey: leaderboardKeys.list(sort, days),
    queryFn: () => api.leaderboard.list(sort, days),
    // Keep the previous ranking visible while switching sort/range so the
    // layout doesn't collapse and re-expand (no flicker/jump).
    placeholderData: keepPreviousData,
  });
}

export function useLeaderboardGraph(handle: string | null) {
  return useQuery({
    queryKey: leaderboardKeys.graph(handle ?? ""),
    queryFn: () => api.leaderboard.graph(handle as string),
    enabled: handle != null && handle.length > 0,
  });
}

export function useLeaderboardModels(handle: string | null) {
  return useQuery({
    queryKey: leaderboardKeys.models(handle ?? ""),
    queryFn: () => api.leaderboard.models(handle as string),
    enabled: handle != null && handle.length > 0,
  });
}

export function useSubmitLeaderboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) => api.leaderboard.submit(handle),
    onSettled: () => queryClient.invalidateQueries({ queryKey: leaderboardKeys.all }),
  });
}

export function useRemoveLeaderboardEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.leaderboard.remove(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: leaderboardKeys.all }),
  });
}
