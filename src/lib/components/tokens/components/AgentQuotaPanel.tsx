import { useState, useEffect, useRef, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { AnthropicRateLimits, CodexRateLimits, QuotaSnapshot } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { TokenUsageSkeleton } from "./TokensPageSkeleton";
import {
  useAgentQuotaSnapshot,
  useFelinaQuotaTtl,
  useSetFelinaQuotaTtl,
} from "../hooks/useTokenQueries";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgoShort(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  return `${s}s ago`;
}

function formatReset(iso: string | null): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "已重置";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h >= 24) {
    const d = new Date(iso);
    return `重置 ${d.toLocaleDateString("zh-TW", { weekday: "short", month: "numeric", day: "numeric" })}`;
  }
  return h > 0 ? `重置 ${h} hr ${m % 60} min 後` : `重置 ${m} min 後`;
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button,input,select,textarea"));
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const c = Math.min(100, Math.max(0, pct));
  const color = c > 85 ? "bg-red-500" : c > 65 ? "bg-amber-400" : "bg-blue-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${c}%` }} />
      </div>
      <span className="text-xs text-text-muted w-16 text-right shrink-0">{c.toFixed(0)}% 已用</span>
    </div>
  );
}

// ── Agent cards ───────────────────────────────────────────────────────────────

function ClaudeCard({ limits }: { limits: AnthropicRateLimits }) {
  const fiveHour = limits.five_hour;
  const sevenDay = limits.seven_day;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-text-primary">Claude Code</p>
      {fiveHour.utilization != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-secondary">5小時窗口</span>
            <span className="text-xs font-semibold text-text-primary">{fiveHour.utilization.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-text-muted">{formatReset(fiveHour.resets_at)}</p>
          <ProgressBar pct={fiveHour.utilization} />
        </div>
      )}
      {sevenDay.utilization != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-secondary">7天配額</span>
            <span className="text-xs font-semibold text-text-primary">{sevenDay.utilization.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-text-muted">{formatReset(sevenDay.resets_at)}</p>
          <ProgressBar pct={sevenDay.utilization} />
        </div>
      )}
      {!limits.available && <p className="text-[10px] text-text-muted italic">無法取得 Claude Code 用量</p>}
      {limits.available && fiveHour.utilization == null && sevenDay.utilization == null && (
        <p className="text-[10px] text-text-muted italic">資料更新中…</p>
      )}
    </div>
  );
}

function CodexCard({ limits }: { limits: CodexRateLimits }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-text-primary">Codex CLI</p>
        {limits.plan_type && (
          <span className="text-[10px] bg-bg-tertiary px-1.5 py-0.5 rounded text-text-muted">{limits.plan_type}</span>
        )}
      </div>
      {limits.primary_pct != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-secondary">5小時窗口</span>
            <span className="text-xs font-semibold text-text-primary">{limits.primary_pct.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-text-muted">{formatReset(limits.primary_reset)}</p>
          <ProgressBar pct={limits.primary_pct} />
        </div>
      )}
      {limits.secondary_pct != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-secondary">7天配額</span>
            <span className="text-xs font-semibold text-text-primary">{limits.secondary_pct.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-text-muted">{formatReset(limits.secondary_reset)}</p>
          <ProgressBar pct={limits.secondary_pct} />
        </div>
      )}
      {!limits.available && <p className="text-[10px] text-text-muted italic">無法取得 Codex CLI 用量</p>}
    </div>
  );
}


// ── QuotaContent ──────────────────────────────────────────────────────────────
// Keyed on ttlSeconds so TanStack Query re-initialises its internal timers
// (staleTime / refetchInterval) when TTL changes, without triggering a fetch
// because refetchOnMount is false and the queryKey is unchanged.

interface QuotaData {
  snapshot: QuotaSnapshot;
  lastUpdated: Date | null;
  isInCooldown: boolean;
  isFetching: boolean;
  refetch: () => void;
}

function QuotaContent({
  ttlSeconds,
  children,
}: {
  ttlSeconds: number;
  children: (data: QuotaData) => ReactNode;
}) {
  const mountedAt = useRef(Date.now());
  const quotaQuery = useAgentQuotaSnapshot(ttlSeconds);

  if (quotaQuery.isPending) {
    return <TokenUsageSkeleton />;
  }

  const snapshot = quotaQuery.data;
  if (!snapshot) return null;

  const effectiveUpdatedAt = Math.max(quotaQuery.dataUpdatedAt, mountedAt.current);
  const lastUpdated = new Date(effectiveUpdatedAt);
  const nextAllowed = new Date(snapshot.next_refresh_at);
  const isInCooldown = new Date() < nextAllowed;

  return <>{children({ snapshot, lastUpdated, isInCooldown, isFetching: quotaQuery.isFetching, refetch: () => quotaQuery.refetch() })}</>;
}

// ── Module-level TTL override ────────────────────────────────────────────────
// Survives route changes so a user's TTL choice isn't lost when navigating.
let _optimisticTtl: number | null = null;

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AgentQuotaPanel({ locale }: { locale: Locale }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const ttlQuery = useFelinaQuotaTtl();
  const persistedTtl = ttlQuery.data;

  // If the TTL query has caught up, release the optimistic override.
  if (_optimisticTtl != null && persistedTtl != null && _optimisticTtl === persistedTtl) {
    _optimisticTtl = null;
  }

  const ttlSeconds = _optimisticTtl ?? persistedTtl ?? 60;
  const saveQuotaTtlMutation = useSetFelinaQuotaTtl();

  return (
    <QuotaContent key={ttlSeconds} ttlSeconds={ttlSeconds}>
      {({ snapshot, lastUpdated, isInCooldown, isFetching, refetch }) => {
        const quotaDragData = buildJesseContextDragData({
          kind: "quota-snapshot",
          title: locale === "zh-TW" ? "Token 用量" : "Token usage",
          source: "tokens.quota",
          capturedAt: new Date().toISOString(),
          summary: `Claude available: ${snapshot.anthropic_limits.available}; Codex available: ${snapshot.codex_limits.available}`,
          metrics: {
            stale: snapshot.stale,
            nextRefreshAt: snapshot.next_refresh_at,
            claudeAvailable: snapshot.anthropic_limits.available,
            claudeFiveHourPct: snapshot.anthropic_limits.five_hour.utilization,
            claudeSevenDayPct: snapshot.anthropic_limits.seven_day.utilization,
            codexAvailable: snapshot.codex_limits.available,
            codexPrimaryPct: snapshot.codex_limits.primary_pct,
            codexSecondaryPct: snapshot.codex_limits.secondary_pct,
            codexPlanType: snapshot.codex_limits.plan_type,
            ttlSeconds,
          },
        });

        return (
        <div className="rounded-lg border border-border bg-bg-secondary p-5">
          <div className="flex items-center justify-between mb-5">
            <h3
              className="inline-block cursor-grab text-sm font-semibold text-text-primary active:cursor-grabbing"
              draggable
              onDragStart={(event) => {
                if (isInteractiveDragTarget(event.target)) {
                  event.preventDefault();
                  return;
                }
                setJesseContextDragData(event.dataTransfer, quotaDragData, "Token 用量");
              }}
              title="Drag to Jesse"
            >
              Token 用量
            </h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-text-muted">
                TTL
                <select
                  className="h-6 px-1.5 text-[10px] bg-bg-tertiary border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
                  value={ttlSeconds}
                  onChange={(e) => {
                    const seconds = Math.min(60 * 60, Math.max(30, Number(e.target.value)));
                    _optimisticTtl = seconds;
                    saveQuotaTtlMutation.mutate(seconds);
                  }}
                  title="Quota refresh TTL. Lower values may hit provider rate limits."
                >
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                  <option value={90}>90s</option>
                  <option value={120}>120s</option>
                  <option value={150}>150s</option>
                </select>
              </label>
              {lastUpdated && (
                <span className="text-[10px] text-text-muted">
                  {snapshot.stale ? "Cached" : "Last updated"}: {timeAgoShort(lastUpdated)}
                </span>
              )}
              <button
                onClick={() => {
                  if (isInCooldown) return;
                  refetch();
                }}
                disabled={isInCooldown}
                className="p-1 rounded hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                title={isInCooldown ? "冷卻中，請稍後再試" : "重新整理"}
              >
                <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <ClaudeCard limits={snapshot.anthropic_limits} />
            <div className="pl-6 border-l border-border"><CodexCard limits={snapshot.codex_limits} /></div>
          </div>
        </div>
        );
      }}
    </QuotaContent>
  );
}
