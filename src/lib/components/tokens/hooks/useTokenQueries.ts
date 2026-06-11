import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { api } from "$lib/tauri/commands";
import type { QuotaSnapshot, ScanProgress } from "$lib/types";

// ── Query key factory ──────────────────────────────────────────────────────────

export const tokenKeys = {
  all: ["tokenAnalytics"] as const,
  analytics: (params: {
    granularity: string;
    days: number | null;
    sourceOverride?: string;
  }) =>
    [
      "tokenAnalytics",
      "analytics",
      params.granularity,
      params.days,
      params.sourceOverride,
    ] as const,
  analyticsPair: (params: {
    monthlyDays: number | null;
    dailyDays: number | null;
    monthlySource?: string;
    dailySource?: string;
  }) =>
    [
      "tokenAnalytics",
      "analyticsPair",
      params.monthlyDays,
      params.dailyDays,
      params.monthlySource,
      params.dailySource,
    ] as const,
  quota: ["tokenAnalytics", "quota"] as const,
  quotaTtl: ["felinaSettings", "quotaTtl"] as const,
  importStatus: ["tokenAnalytics", "importStatus"] as const,
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
  enabled?: boolean;
}

export function useTokenAnalytics(params: TokenAnalyticsParams) {
  return useQuery({
    queryKey: tokenKeys.analytics({
      granularity: params.granularity,
      days: params.days,
      sourceOverride: params.sourceOverride,
    }),
    queryFn: () =>
      api.tokenAnalytics.get({
        granularity: params.granularity,
        ...getDateBounds(params.days),
        sourceOverride: params.sourceOverride,
      }),
    staleTime: params.isToday ? 0 : undefined,
    refetchInterval: params.isToday ? 60_000 : undefined,
    enabled: params.enabled ?? true,
  });
}

// ── useAnalyticsPair ─────────────────────────────────────────────────────────

export interface AnalyticsPairParams {
  monthlyDays: number | null;
  dailyDays: number | null;
  monthlySource?: string;
  dailySource?: string;
  overviewIsToday?: boolean;
  dailyIsToday?: boolean;
  enabled?: boolean;
}

export function useAnalyticsPair(params: AnalyticsPairParams) {
  const isToday = params.overviewIsToday === true || params.dailyIsToday === true;

  return useQuery({
    queryKey: tokenKeys.analyticsPair({
      monthlyDays: params.monthlyDays,
      dailyDays: params.dailyDays,
      monthlySource: params.monthlySource,
      dailySource: params.dailySource,
    }),
    queryFn: () => {
      const monthlyBounds = getDateBounds(params.monthlyDays);
      const dailyBounds = getDateBounds(params.dailyDays);
      return api.tokenAnalytics.getAnalyticsPair({
        monthlyDateStart: monthlyBounds.dateStart,
        monthlyDateEnd: monthlyBounds.dateEnd,
        dailyDateStart: dailyBounds.dateStart,
        dailyDateEnd: dailyBounds.dateEnd,
        monthlySource: params.monthlySource,
        dailySource: params.dailySource,
      });
    },
    staleTime: isToday ? 0 : undefined,
    refetchInterval: isToday ? 60_000 : undefined,
    enabled: params.enabled ?? true,
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

// ── useTokenImportStatus / useScanProgress ──────────────────────────────────

export function useTokenImportStatus() {
  return useQuery({
    queryKey: tokenKeys.importStatus,
    queryFn: () => api.tokenAnalytics.importStatus(),
    retry: false,
  });
}

export function useScanProgress() {
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    listen<ScanProgress>("token-scan-progress", (event) => {
      setProgress(event.payload);
    }).then((cleanup) => {
      if (active) {
        unlisten = cleanup;
      } else {
        cleanup();
      }
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return progress;
}

// ── useFelinaQuotaTtl / useSetFelinaQuotaTtl ─────────────────────────────────

export function useFelinaQuotaTtl() {
  return useQuery({
    queryKey: tokenKeys.quotaTtl,
    queryFn: () => api.felinaSettings.getQuotaTtl(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetFelinaQuotaTtl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seconds: number) => api.felinaSettings.setQuotaTtl(seconds),
    onMutate: async (seconds) => {
      await queryClient.cancelQueries({ queryKey: tokenKeys.quotaTtl });
      const previous = queryClient.getQueryData<number>(tokenKeys.quotaTtl);
      queryClient.setQueryData<number>(tokenKeys.quotaTtl, seconds);
      return { previous };
    },
    onError: (_err, _seconds, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(tokenKeys.quotaTtl, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.quotaTtl });
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
