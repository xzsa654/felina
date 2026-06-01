import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api, type BudgetSettings } from "$lib/tauri/commands";
import type { QuotaSnapshot } from "$lib/types";

// ── Query key factory ──────────────────────────────────────────────────────────

export const tokenKeys = {
  all: ["tokenAnalytics"] as const,
  analytics: (params: {
    granularity: string;
    dateStart?: number;
    dateEnd?: number;
    sourceOverride?: string;
  }) =>
    [
      "tokenAnalytics",
      "analytics",
      params.granularity,
      params.dateStart,
      params.dateEnd,
      params.sourceOverride,
    ] as const,
  quota: ["tokenAnalytics", "quota"] as const,
  budget: ["tokenAnalytics", "budget"] as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateBounds(days: number | null): { dateStart?: number; dateEnd?: number } {
  if (days === null) return {};
  const dateEnd = Math.floor(Date.now() / 1000);
  return { dateStart: dateEnd - days * 86400, dateEnd };
}

function mergeQuotaSnapshot(
  prev: QuotaSnapshot,
  fresh: QuotaSnapshot,
): QuotaSnapshot {
  const hasNewClaude =
    fresh.anthropic_limits.available &&
    fresh.anthropic_limits.five_hour.utilization != null;
  const hasNewCodex =
    fresh.codex_limits.available && fresh.codex_limits.primary_pct != null;

  return {
    fetched_at: fresh.fetched_at,
    expires_at: fresh.expires_at,
    next_refresh_at: fresh.next_refresh_at,
    stale: fresh.stale,
    anthropic_limits: hasNewClaude ? fresh.anthropic_limits : prev.anthropic_limits,
    codex_limits: hasNewCodex ? fresh.codex_limits : prev.codex_limits,
    gemini_limits: fresh.gemini_limits.available ? fresh.gemini_limits : prev.gemini_limits,
  };
}

// ── useTokenAnalytics ─────────────────────────────────────────────────────────

export interface TokenAnalyticsParams {
  granularity: "monthly" | "daily";
  days: number | null;
  sourceOverride?: string;
  isToday?: boolean;
}

export function useTokenAnalytics(params: TokenAnalyticsParams) {
  const bounds = getDateBounds(params.days);

  return useQuery({
    queryKey: tokenKeys.analytics({
      granularity: params.granularity,
      ...bounds,
      sourceOverride: params.sourceOverride,
    }),
    queryFn: () =>
      api.tokenAnalytics.get({
        granularity: params.granularity,
        ...bounds,
        sourceOverride: params.sourceOverride,
      }),
    staleTime: params.isToday ? 0 : undefined,
    refetchInterval: params.isToday ? 60_000 : undefined,
  });
}

// ── useRefreshTokenData ──────────────────────────────────────────────────────

export function useRefreshTokenData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.tokenAnalytics.refresh(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
  });
}

// ── useBudgetSettings / useSetBudgetSettings ─────────────────────────────────

export function useBudgetSettings() {
  return useQuery({
    queryKey: tokenKeys.budget,
    queryFn: () => api.budget.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetBudgetSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      dailyLimit?: number | null;
      monthlyLimit?: number | null;
      planType?: string;
      quotaTtlSeconds?: number;
    }) => {
      const current = await api.budget.get();
      await api.budget.set(
        params.dailyLimit ?? current.daily_limit,
        params.monthlyLimit ?? current.monthly_limit,
        params.planType ?? current.plan_type,
        params.quotaTtlSeconds ?? current.quota_ttl_seconds,
      );
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: tokenKeys.budget });
      const previous = queryClient.getQueryData<BudgetSettings>(tokenKeys.budget);
      if (previous) {
        queryClient.setQueryData<BudgetSettings>(tokenKeys.budget, {
          ...previous,
          quota_ttl_seconds: params.quotaTtlSeconds ?? previous.quota_ttl_seconds,
        });
      }
      return { previous };
    },
    onError: (_err, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tokenKeys.budget, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.budget });
    },
  });
}

// ── useAgentQuotaSnapshot ────────────────────────────────────────────────────

export function useAgentQuotaSnapshot(ttlSeconds: number) {
  const mergedRef = useRef<QuotaSnapshot | null>(null);

  return useQuery({
    queryKey: tokenKeys.quota,
    queryFn: () => api.tokenAnalytics.getAgentQuotaSnapshot(),
    staleTime: ttlSeconds * 1000,
    refetchInterval: (query) => {
      const nextRefresh = query.state.data?.next_refresh_at;
      if (!nextRefresh) return ttlSeconds * 1000;
      const delay = new Date(nextRefresh).getTime() - Date.now();
      return Math.max(30_000, Math.min(delay, ttlSeconds * 1000));
    },
    refetchOnMount: false,
    select: (data: QuotaSnapshot): QuotaSnapshot => {
      const prev = mergedRef.current;
      if (!prev) {
        mergedRef.current = data;
        return data;
      }
      const merged = mergeQuotaSnapshot(prev, data);
      mergedRef.current = merged;
      return merged;
    },
  });
}
