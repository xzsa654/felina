import { useState, useEffect } from "react";
import type {
  ModelBreakdown,
  DayHourlyBucket,
  DayProjectBreakdown,
  DaySessionBreakdown,
} from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber, formatCostFull } from "$lib/utils/format";
import { totalTokensForModel } from "../token-insights";
import { api } from "$lib/tauri/commands";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extract a human-readable name from a project path like -Users-foo-Desktop-proj */
function projectName(raw: string): string {
  if (!raw || raw === "(no project)") return t("en", "tokens.dayDetail.noProject" as never);
  // Replace leading dashes used as path separators, take last 1-2 segments
  const parts = raw.replace(/^-+/, "").split("-").filter(Boolean);
  return parts.slice(-2).join("/") || raw;
}

/** Short session ID: first 8 chars */
function shortSession(id: string): string {
  return id.slice(0, 8) + "…";
}

// ── Hourly bar chart ─────────────────────────────────────────────────────────

const BAR_MAX_PX = 40;

function HourlyChart({ data, locale }: { data: DayHourlyBucket[]; locale: Locale }) {
  const map = new Map(data.map((b) => [b.hour, b]));
  const max = Math.max(...data.map((b) => b.tokens), 1);

  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">
        {t(locale, "tokens.dayDetail.hourlyTitle" as never)}
      </p>
      <div className="flex items-end gap-px" style={{ height: `${BAR_MAX_PX}px` }}>
        {Array.from({ length: 24 }, (_, h) => {
          const entry = map.get(h);
          const heightPx = entry && entry.tokens > 0
            ? Math.max(Math.round((entry.tokens / max) * BAR_MAX_PX), 2)
            : 0;
          return (
            <div
              key={h}
              title={entry && entry.tokens > 0
                ? `${h}:00  ${formatNumber(entry.tokens, locale)} tokens  ${entry.messages} msgs`
                : `${h}:00`}
              className={`flex-1 rounded-sm transition-colors ${
                heightPx > 0 ? "bg-emerald-500 hover:bg-emerald-400" : "bg-bg-tertiary/50"
              }`}
              style={{ height: `${heightPx || 2}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h} className="text-[9px] text-text-muted">{String(h).padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  );
}

// ── Project breakdown ─────────────────────────────────────────────────────────

function ProjectBreakdown({ data, locale }: { data: DayProjectBreakdown[]; locale: Locale }) {
  const maxTokens = Math.max(...data.map((p) => p.tokens), 1);
  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">
        {t(locale, "tokens.dayDetail.projectTitle" as never)}
      </p>
      <div className="space-y-1.5">
        {data.slice(0, 6).map((p) => (
          <div key={p.project} className="flex items-center gap-2">
            <div className="w-24 shrink-0 text-[10px] text-text-secondary truncate" title={p.project}>
              {projectName(p.project)}
            </div>
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(p.tokens / maxTokens) * 100}%` }}
              />
            </div>
            <div className="w-14 text-right text-[10px] text-text-muted shrink-0">
              {formatNumber(p.tokens, locale)}
            </div>
            <div className="w-12 text-right text-[10px] text-text-primary shrink-0">
              {formatCostFull(p.cost_usd, locale)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top sessions ──────────────────────────────────────────────────────────────

function TopSessions({ data, locale }: { data: DaySessionBreakdown[]; locale: Locale }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">
        {t(locale, "tokens.dayDetail.sessionsTitle" as never)}
      </p>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-text-muted border-b border-border/30">
            <th className="pb-1 text-left font-medium">{t(locale, "tokens.dayDetail.colSession" as never)}</th>
            <th className="pb-1 text-left font-medium">{t(locale, "tokens.dayDetail.colProject" as never)}</th>
            <th className="pb-1 text-left font-medium">Model</th>
            <th className="pb-1 text-right font-medium">Msgs</th>
            <th className="pb-1 text-right font-medium">Tokens</th>
            <th className="pb-1 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.session_id} className="border-b border-border/20 last:border-0">
              <td className="py-1 font-mono text-text-muted">{shortSession(s.session_id)}</td>
              <td className="py-1 text-text-secondary truncate max-w-[120px]" title={s.project ?? ""}>
                {s.project ? projectName(s.project) : "—"}
              </td>
              <td className="py-1 text-text-secondary truncate max-w-[140px]" title={s.model}>{s.model}</td>
              <td className="py-1 text-right text-text-secondary">{formatNumber(s.messages, locale)}</td>
              <td className="py-1 text-right text-text-primary font-medium">{formatNumber(s.tokens, locale)}</td>
              <td className="py-1 text-right text-text-primary font-medium">{formatCostFull(s.cost_usd, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Model breakdown ───────────────────────────────────────────────────────────

function ModelDetail({ data, locale }: { data: ModelBreakdown[]; locale: Locale }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">
        {t(locale, "tokens.dayDetail.modelTitle" as never)}
      </p>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-text-muted border-b border-border/30">
            <th className="pb-1 text-left font-medium w-5">#</th>
            <th className="pb-1 text-left font-medium">{t(locale, "tokens.topModels.colModel")}</th>
            <th className="pb-1 text-right font-medium">Msgs</th>
            <th className="pb-1 text-right font-medium">Input</th>
            <th className="pb-1 text-right font-medium">Output</th>
            <th className="pb-1 text-right font-medium text-purple-400">Cache R</th>
            <th className="pb-1 text-right font-medium">Total</th>
            <th className="pb-1 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m, i) => (
            <tr key={`${m.model}-${m.agent}`} className="border-b border-border/20 last:border-0">
              <td className="py-1 text-text-muted">{i + 1}</td>
              <td className="py-1 pr-3">
                <div className="font-medium text-text-primary truncate max-w-[200px]" title={m.model}>{m.model}</div>
                <div className="text-text-muted">{m.provider}</div>
              </td>
              <td className="py-1 text-right text-text-secondary">{formatNumber(m.event_count, locale)}</td>
              <td className="py-1 text-right text-text-secondary">{formatNumber(m.input_tokens, locale)}</td>
              <td className="py-1 text-right text-text-secondary">{formatNumber(m.output_tokens, locale)}</td>
              <td className="py-1 text-right text-purple-400">{formatNumber(m.cache_read_tokens, locale)}</td>
              <td className="py-1 text-right text-text-primary font-medium">{formatNumber(totalTokensForModel(m), locale)}</td>
              <td className="py-1 text-right text-text-primary font-medium">{formatCostFull(m.cost_usd, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface PanelData {
  models: ModelBreakdown[];
  hourly: DayHourlyBucket[];
  projects: DayProjectBreakdown[];
  sessions: DaySessionBreakdown[];
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

/** 3-node placeholder rendered immediately on expand (zero layout cost). */
function MiniSkeleton() {
  return (
    <div className="py-2 space-y-2 animate-pulse">
      <div className="h-2 w-3/4 bg-bg-tertiary rounded" />
      <div className="h-2 w-1/2 bg-bg-tertiary rounded" />
      <div className="h-2 w-2/3 bg-bg-tertiary rounded" />
    </div>
  );
}

function Sk({ w, h = "h-2.5", className = "" }: { w: string; h?: string; className?: string }) {
  return <div className={`${h} ${w} bg-bg-tertiary rounded animate-pulse ${className}`} />;
}

// ── Section-specific skeletons (match real component layout exactly) ───────────

/** Mirrors HourlyChart */
function HourlyChartSkeleton() {
  return (
    <div>
      <Sk w="w-24" h="h-2" className="mb-2" />
      <div className="flex items-end gap-px" style={{ height: `${BAR_MAX_PX}px` }}>
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="flex-1 bg-bg-tertiary rounded-sm animate-pulse"
            style={{
              height: `${Math.max(2, Math.round((20 + Math.sin(i * 0.8) * 15 + 15) / 100 * BAR_MAX_PX))}px`,
              animationDelay: `${i * 18}ms`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {[0, 6, 12, 18, 23].map((h) => <Sk key={h} w="w-4" h="h-1.5" />)}
      </div>
    </div>
  );
}

/** Mirrors ProjectBreakdown (6 rows: w-24 label + flex bar + w-14 + w-12) */
function ProjectBreakdownSkeleton() {
  return (
    <div>
      <Sk w="w-16" h="h-2" className="mb-2" />
      <div className="space-y-1.5">
        {[80, 55, 40, 30, 20, 15].map((pct, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-24 shrink-0"><Sk w="w-16" h="h-2" /></div>
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden animate-pulse">
              <div className="h-full bg-bg-secondary rounded-full" style={{ width: `${100 - pct}%` }} />
            </div>
            <div className="w-14 flex justify-end"><Sk w="w-10" h="h-2" /></div>
            <div className="w-12 flex justify-end"><Sk w="w-9" h="h-2" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors ModelDetail table (header + 3 rows × 8 cols) */
function ModelDetailSkeleton() {
  return (
    <div>
      <Sk w="w-16" h="h-2" className="mb-2" />
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-border/30">
            {["w-5","w-28","w-8","w-10","w-10","w-10","w-10","w-10"].map((w, i) => (
              <th key={i} className="pb-1.5"><Sk w={w} h="h-1.5" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(3)].map((_, i) => (
            <tr key={i} className="border-b border-border/20">
              <td className="py-1.5"><Sk w="w-3" h="h-2" /></td>
              <td className="py-1.5 pr-3">
                <Sk w="w-28" h="h-2" className="mb-1" />
                <Sk w="w-16" h="h-1.5" />
              </td>
              {[...Array(6)].map((_, j) => (
                <td key={j} className="py-1.5 text-right">
                  <div className="flex justify-end"><Sk w="w-10" h="h-2" /></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mirrors TopSessions table (header + 5 rows × 6 cols) */
function TopSessionsSkeleton() {
  const colWidths = ["w-14", "w-16", "w-24", "w-8", "w-12", "w-10"];
  return (
    <div>
      <Sk w="w-24" h="h-2" className="mb-2" />
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-border/30">
            {colWidths.map((w, i) => (
              <th key={i} className="pb-1.5"><Sk w={w} h="h-1.5" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i} className="border-b border-border/20">
              {colWidths.map((w, j) => (
                <td key={j} className="py-1">
                  <Sk w={w} h="h-2" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Full skeleton assembled from section skeletons — mirrors the real layout. */
function FullSkeleton() {
  return (
    <div className="space-y-5 pt-1">
      <HourlyChartSkeleton />
      <div className="grid lg:grid-cols-2 gap-5">
        <ProjectBreakdownSkeleton />
        <ModelDetailSkeleton />
      </div>
      <TopSessionsSkeleton />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type Phase = "mini" | "skeleton" | "done";

export default function DayDetailPanel({ date, locale }: { date: string; locale: Locale }) {
  const [phase, setPhase] = useState<Phase>("mini");
  const [panelData, setPanelData] = useState<PanelData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhase("mini");
    setPanelData(null);
    setError(false);

    const GOLDEN_MS = 800; // minimum skeleton display time

    // Frame 1: MiniSkeleton is painted (3 nodes, no layout cost).
    // Frame 2: upgrade to FullSkeleton and start fetch + timer in parallel.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setPhase("skeleton");

      const fetchStart = Date.now();

      Promise.all([
        api.tokenAnalytics.getDayModelBreakdown(date, "auto_dated"),
        api.tokenAnalytics.getDayHourly(date, "auto_dated"),
        api.tokenAnalytics.getDayProjectBreakdown(date, "auto_dated"),
        api.tokenAnalytics.getDayTopSessions(date, 8, "auto_dated"),
      ])
        .then(([models, hourly, projects, sessions]) => {
          if (cancelled) return;
          const elapsed = Date.now() - fetchStart;
          const remaining = Math.max(0, GOLDEN_MS - elapsed);
          setTimeout(() => {
            if (!cancelled) {
              setPanelData({ models, hourly, projects, sessions });
              setPhase("done");
            }
          }, remaining);
        })
        .catch(() => { if (!cancelled) setError(true); });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [date]);

  if (error) {
    return <div className="py-4 text-xs text-red-400">{t(locale, "common.error")}</div>;
  }
  if (phase === "mini") return <MiniSkeleton />;
  if (phase === "skeleton" || !panelData) return <FullSkeleton />;


  return (
    <div className="space-y-5 pt-1">
      {/* Hourly chart — always shown; grey bars when no data */}
      <HourlyChart data={panelData.hourly} locale={locale} />

      {/* 2-col: Projects + Models */}
      <div className="grid lg:grid-cols-2 gap-5">
        {panelData.projects.length > 0 && (
          <ProjectBreakdown data={panelData.projects} locale={locale} />
        )}
        {panelData.models.length > 0 && (
          <ModelDetail data={panelData.models} locale={locale} />
        )}
      </div>

      {/* Top sessions */}
      {panelData.sessions.length > 0 && (
        <TopSessions data={panelData.sessions} locale={locale} />
      )}
    </div>
  );
}
