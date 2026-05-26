import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import type { QuotaSnapshot, AnthropicRateLimits, CodexRateLimits, GeminiRateLimits } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { api, type BudgetSettings } from "$lib/tauri/commands";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgoShort(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
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

/** Bar without a label — for weekly (we don't have a hard limit to show %) */


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

function GeminiCard({ limits }: { limits: GeminiRateLimits }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-text-primary">Gemini CLI</p>
      {limits.primary_pct != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-secondary">配額</span>
            <span className="text-xs font-semibold text-text-primary">{limits.primary_pct.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-text-muted">{formatReset(limits.primary_reset)}</p>
          <ProgressBar pct={limits.primary_pct} />
        </div>
      )}
      {!limits.available && <p className="text-[10px] text-text-muted italic">Gemini CLI 未安裝</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ w, h = "h-2.5" }: { w: string; h?: string }) {
  return <div className={`${h} ${w} bg-bg-tertiary rounded animate-pulse`} />;
}

function CardSkeleton() {
  return (
    <div className="space-y-4">
      <Sk w="w-28" h="h-4" />
      <div className="space-y-1.5">
        <div className="flex justify-between"><Sk w="w-28" /><Sk w="w-20" /></div>
        <Sk w="w-24" />
        <div className="h-2 bg-bg-tertiary rounded-full animate-pulse" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between"><Sk w="w-16" /><Sk w="w-24" /></div>
        <Sk w="w-24" />
        <div className="h-2 bg-bg-tertiary rounded-full animate-pulse" />
      </div>
    </div>
  );
}

// ── Module-level cache — survives route changes ───────────────────────────────
let _quotaCache: QuotaSnapshot | null = null;
let _quotaLastUpdated: Date | null = null;
let _quotaNextAllowed: Date | null = null;
let _quotaTtlSeconds: number | null = null;

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AgentQuotaPanel({ locale: _locale }: { locale: Locale }) {
  const [snapshot, setSnapshot] = useState<QuotaSnapshot | null>(_quotaCache);
  const [loading, setLoading] = useState(_quotaCache === null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(_quotaLastUpdated);
  const [nextAllowed, setNextAllowed] = useState<Date | null>(_quotaNextAllowed);
  const [quotaTtlSeconds, setQuotaTtlSeconds] = useState<number>(_quotaTtlSeconds ?? 180);
  const [, tick] = useState(0);

  const doFetch = useCallback(async () => {
    try {
      const data = await api.tokenAnalytics.getAgentQuotaSnapshot();
      // Merge: keep previous non-null values if the new fetch returned empty data
      // (e.g. transient token refresh causing null utilization during 30s auto-refresh).
      setSnapshot((prev) => {
        const base = prev ?? _quotaCache;
        if (!base) { _quotaCache = data; return data; }
        const hasNewClaude = data.anthropic_limits.available &&
          data.anthropic_limits.five_hour.utilization != null;
        const hasNewCodex = data.codex_limits.available &&
          data.codex_limits.primary_pct != null;
        const merged = {
          fetched_at: data.fetched_at,
          expires_at: data.expires_at,
          next_refresh_at: data.next_refresh_at,
          stale: data.stale,
          anthropic_limits: hasNewClaude ? data.anthropic_limits : base.anthropic_limits,
          codex_limits:     hasNewCodex  ? data.codex_limits     : base.codex_limits,
          gemini_limits:    data.gemini_limits.available
                              ? data.gemini_limits
                              : base.gemini_limits,
        };
        _quotaCache = merged;
        return merged;
      });
      const fetchedAt = new Date(data.fetched_at);
      const nextRefreshAt = new Date(data.next_refresh_at);
      _quotaLastUpdated = fetchedAt;
      _quotaNextAllowed = nextRefreshAt;
      setLastUpdated(fetchedAt);
      setNextAllowed(nextRefreshAt);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.budget.get()
      .then((settings) => {
        if (cancelled) return;
        _quotaTtlSeconds = settings.quota_ttl_seconds;
        setQuotaTtlSeconds(settings.quota_ttl_seconds);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const saveQuotaTtl = useCallback(async (seconds: number) => {
    const next = Math.min(60 * 60, Math.max(30, seconds));
    _quotaTtlSeconds = next;
    setQuotaTtlSeconds(next);
    const current: BudgetSettings = await api.budget.get();
    await api.budget.set(
      current.daily_limit,
      current.monthly_limit,
      current.plan_type,
      next,
    );
    await doFetch();
  }, [doFetch]);

  useEffect(() => {
    doFetch();
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => { clearInterval(t); };
  }, [doFetch]);

  useEffect(() => {
    if (!nextAllowed) return;
    const delay = nextAllowed.getTime() - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(doFetch, delay);
    return () => clearTimeout(timer);
  }, [doFetch, nextAllowed]);

  if (loading) {
    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-5 space-y-6">
        <div className="flex justify-between"><Sk w="w-32" h="h-4" /><Sk w="w-20" /></div>
        <div className="grid sm:grid-cols-3 gap-6 divide-x divide-border">
          {[1,2,3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Token 用量</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-text-muted">
            TTL
            <select
              className="h-6 px-1.5 text-[10px] bg-bg-tertiary border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
              value={quotaTtlSeconds}
              onChange={(e) => { void saveQuotaTtl(Number(e.target.value)); }}
              title="Quota refresh TTL. Lower values may hit provider rate limits."
            >
              <option value={60}>1m</option>
              <option value={180}>3m</option>
              <option value={300}>5m</option>
              <option value={900}>15m</option>
            </select>
          </label>
          {lastUpdated && (
            <span className="text-[10px] text-text-muted">
              {snapshot?.stale ? "Cached" : "Last updated"}: {timeAgoShort(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => {
              const now = new Date();
              if (nextAllowed && now < nextAllowed) return;
              doFetch();
            }}
            disabled={!!(nextAllowed && new Date() < nextAllowed)}
            className="p-1 rounded hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title={nextAllowed && new Date() < nextAllowed ? `冷卻中，請稍後再試` : "重新整理"}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <ClaudeCard limits={snapshot.anthropic_limits} />
        <div className="pl-6 border-l border-border"><CodexCard limits={snapshot.codex_limits} /></div>
        <div className="pl-6 border-l border-border"><GeminiCard limits={snapshot.gemini_limits} /></div>
      </div>
    </div>
  );
}
