import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { JesseContextPayload, TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber, formatCostFull } from "$lib/utils/format";
import { totalTokensForBucket } from "../token-insights";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

// ── Color levels ─────────────────────────────────────────────────────────────
// 5 levels (0=empty, 1–4 = activity intensity)
function cellLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (max === 0 || value === 0) return 0;
  const r = value / max;
  if (r > 0.75) return 4;
  if (r > 0.40) return 3;
  if (r > 0.15) return 2;
  return 1;
}

const LEVEL_BG = [
  "bg-bg-tertiary",           // 0 – no activity
  "bg-emerald-900",           // 1 – low
  "bg-emerald-700",           // 2 – medium-low
  "bg-emerald-500",           // 3 – medium-high
  "bg-emerald-400",           // 4 – high
];

// ── Date helpers ──────────────────────────────────────────────────────────────
function dayOfWeekMon(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TODAY_KEY = toDateKey(new Date());

// ── i18n ──────────────────────────────────────────────────────────────────────
const MONTH_SHORT: Record<string, string[]> = {
  en:    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  "zh-TW": ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
};

const DAY_LABELS: Record<string, [string, string, string]> = {
  en:      ["Mon", "Wed", "Fri"],
  "zh-TW": ["一",  "三",  "五"],
};

const DAY_LABEL_ROWS = [0, 2, 4]; // which row indices get a label (Mon/Wed/Fri)

// ── Types ─────────────────────────────────────────────────────────────────────
interface DayCell {
  key:     string;
  tokens:  number;
  cost:    number;
  inRange: boolean;
}

interface ContributionGraphStats {
  activeDays: number;
  totalDays: number;
  inactiveDays: number;
  totalTokens: number;
  totalCost: number;
  firstDate: string;
  lastDate: string;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
interface TooltipInfo {
  key:    string;
  tokens: number;
  cost:   number;
  x:      number; // window-level px
  y:      number; // window-level px
}

function utcDayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function calendarDaysInclusive(firstDate: string, lastDate: string): number {
  return Math.max(0, Math.floor(utcDayNumber(lastDate) - utcDayNumber(firstDate)) + 1);
}

export function buildContributionGraphStats(data: TokenBucket[]): ContributionGraphStats | null {
  const dated = data
    .filter((b) => /^\d{4}-\d{2}-\d{2}/.test(b.label))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (dated.length === 0) return null;

  let activeDays = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const b of dated) {
    const total = totalTokensForBucket(b);
    if (total > 0) activeDays++;
    totalTokens += total;
    totalCost += b.cost_usd;
  }

  const firstDate = dated[0].label;
  const lastDate = dated[dated.length - 1].label;
  const totalDays = calendarDaysInclusive(firstDate, lastDate);

  return {
    activeDays,
    totalDays,
    inactiveDays: Math.max(0, totalDays - activeDays),
    totalTokens,
    totalCost,
    firstDate,
    lastDate,
  };
}

export function buildContributionGraphJesseContext({
  data,
  locale,
  title,
}: {
  data: TokenBucket[];
  locale: Locale;
  title: string;
}): JesseContextPayload | null {
  const stats = buildContributionGraphStats(data);
  if (!stats) return null;
  const howToRead =
    "Each square is one calendar day. Darker green means more token activity. A blank or darkest background square means no recorded activity for that day.";

  return {
    kind: "token-overview",
    title,
    source: "tokens.daily.contributionGraph",
    capturedAt: new Date().toISOString(),
    summary: `${title}: ${stats.activeDays} active days across ${stats.totalDays} calendar days from ${stats.firstDate} to ${stats.lastDate}; ${stats.inactiveDays} days have no recorded activity, with ${formatNumber(stats.totalTokens, locale)} total tokens. How to read: ${howToRead}`,
    metrics: {
      chartType: "calendar activity heatmap",
      howToRead,
      activeDays: stats.activeDays,
      totalDays: stats.totalDays,
      inactiveDays: stats.inactiveDays,
      firstDate: stats.firstDate,
      lastDate: stats.lastDate,
      totalTokens: stats.totalTokens,
      costUsd: stats.totalCost,
      caveat:
        "totalDays is the calendar span between the first and last dated bucket, not merely the number of returned buckets.",
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ContributionGraph({
  data,
  locale,
  selectedDate,
  getDayHref,
  onSelectDate,
  transparent = false,
  transparentTone = "dark",
  surfaceClassName,
  levels,
}: {
  data: TokenBucket[];
  locale: Locale;
  selectedDate?: string | null;
  getDayHref?: (date: string) => string;
  onSelectDate?: (date: string) => void;
  transparent?: boolean;
  transparentTone?: "light" | "dark";
  surfaceClassName?: string;
  levels?: readonly string[];
}) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  // Cell intensity palette (0=empty … 4=high). Caller can override to match a theme.
  const LEVELS = levels ?? LEVEL_BG;
  // Transparent variant sits over a Prism backdrop. "dark" tone = light text on
  // dark glass; "light" tone = dark text on a bright frosted card (for rank #1).
  // surfaceClassName lets the caller match the surrounding cards exactly.
  const onLight = transparent && transparentTone === "light";
  const surface =
    surfaceClassName ??
    (!transparent
      ? "bg-bg-secondary border border-border"
      : onLight
        ? "bg-white/70 border border-black/10 backdrop-blur-md"
        : "bg-white/5 border border-white/10 backdrop-blur-md");
  const titleC = !transparent ? "text-text-secondary" : onLight ? "text-neutral-700" : "text-white/80";
  const mutedC = !transparent ? "text-text-muted" : onLight ? "text-neutral-500" : "text-white/60";

  const { weeks, maxTokens, monthLabels, stats } = useMemo(() => {
    const dated = data.filter((b) => /^\d{4}-\d{2}-\d{2}/.test(b.label));
    if (dated.length === 0)
      return { weeks: [], maxTokens: 0, monthLabels: [], stats: null };

    const tokenMap = new Map<string, { tokens: number; cost: number }>();
    let max = 0;

    for (const b of dated) {
      const total = totalTokensForBucket(b);
      tokenMap.set(b.label, { tokens: total, cost: b.cost_usd });
      if (total > max) max = total;
    }

    const sorted = [...dated].sort((a, b) => a.label.localeCompare(b.label));
    const firstDate = new Date(sorted[0].label + "T00:00:00");
    const lastDate  = new Date(sorted[sorted.length - 1].label + "T00:00:00");

    const startDate = addDays(firstDate, -dayOfWeekMon(firstDate));
    const endDate   = addDays(lastDate, 6 - dayOfWeekMon(lastDate));

    const allDays: DayCell[] = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const key   = toDateKey(cur);
      const entry = tokenMap.get(key);
      allDays.push({
        key,
        tokens:  entry?.tokens ?? 0,
        cost:    entry?.cost   ?? 0,
        inRange: cur >= firstDate && cur <= lastDate,
      });
      cur = addDays(cur, 1);
    }

    // Group into weeks
    const weeksArr: DayCell[][] = [];
    for (let i = 0; i < allDays.length; i += 7)
      weeksArr.push(allDays.slice(i, i + 7));

    // Month labels (show on first week of each month)
    const months = MONTH_SHORT[locale] ?? MONTH_SHORT.en;
    const monthLabelList: { weekIdx: number; label: string }[] = [];
    let prevMonth = -1;
    for (let wi = 0; wi < weeksArr.length; wi++) {
      const mon = weeksArr[wi][0];
      const d   = new Date(mon.key + "T00:00:00");
      if (d.getMonth() !== prevMonth) {
        monthLabelList.push({ weekIdx: wi, label: months[d.getMonth()] });
        prevMonth = d.getMonth();
      }
    }

    return {
      weeks: weeksArr,
      maxTokens: max,
      monthLabels: monthLabelList,
      stats: buildContributionGraphStats(data),
    };
  }, [data, locale]);

  const dayLabels = DAY_LABELS[locale] ?? DAY_LABELS.en;
  const title = t(locale, "tokens.daily.contributionTitle" as never);
  const canDrag = !transparent && Boolean(stats);
  const dragData = stats
    ? buildJesseContextDragData(buildContributionGraphJesseContext({ data, locale, title })!)
    : null;


  if (weeks.length === 0) {
    return (
      <div className={`${surface} rounded-lg p-5`}>
        <h3 className={`text-sm font-medium mb-3 ${titleC}`}>
          {t(locale, "tokens.daily.contributionTitle" as never)}
        </h3>
        <div className={`flex items-center justify-center h-24 text-sm ${mutedC}`}>
          {t(locale, "tokens.daily.noData" as never)}
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`${surface} rounded-lg p-5 select-none`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3
            className={`${canDrag ? "inline-block cursor-grab active:cursor-grabbing" : ""} text-sm font-medium ${titleC}`}
            draggable={canDrag}
            onDragStart={(event) => {
              if (!dragData) return;
              setJesseContextDragData(event.dataTransfer, dragData, title);
            }}
            title={canDrag ? "Drag to Jesse" : undefined}
          >
            {title}
          </h3>
          {stats && (
            <p className={`text-xs mt-0.5 ${mutedC}`}>
              {stats.activeDays} {t(locale, "tokens.daily.activeDays" as never)}
            </p>
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[10px] mr-0.5 ${mutedC}`}>{t(locale, "common.less")}</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div
              key={level}
              className={`w-3 h-3 rounded-sm ${LEVELS[level]}`}
            />
          ))}
          <span className={`text-[10px] ml-0.5 ${mutedC}`}>{t(locale, "common.more")}</span>
        </div>
      </div>

      {/* Graph */}
      <div className="relative overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Day-of-week labels column */}
          <div className="flex flex-col gap-1 pt-5 pr-2 flex-shrink-0">
            {Array.from({ length: 7 }, (_, i) => {
              const labelIdx = DAY_LABEL_ROWS.indexOf(i);
              return (
                <div key={i} className="w-4 h-4 flex items-center justify-end">
                  {labelIdx >= 0 && (
                    <span className={`text-[10px] leading-none ${mutedC}`}>
                      {dayLabels[labelIdx]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Weeks */}
          <div>
            {/* Month labels */}
            <div className="flex gap-1 h-5 mb-0.5">
              {weeks.map((_, wi) => {
                const label = monthLabels.find((m) => m.weekIdx === wi);
                return (
                  <div key={wi} className="w-4 relative">
                    {label && (
                      <span className={`absolute left-0 top-0 text-[10px] leading-none whitespace-nowrap font-medium ${mutedC}`}>
                        {label.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cell grid */}
            <div className="flex gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((cell) => {
                    if (!cell.inRange) {
                      return <div key={cell.key} className="w-4 h-4" />;
                    }
                    const level  = cellLevel(cell.tokens, maxTokens);
                    const isToday = cell.key === TODAY_KEY;
                    const isSelected = cell.key === selectedDate;
                    return (
                      <a
                        key={cell.key}
                        href={getDayHref?.(cell.key) ?? `?tab=daily&date=${cell.key}`}
                        className={[
                          "block w-4 h-4 rounded cursor-pointer transition-all duration-75",
                          LEVELS[level],
                          "hover:opacity-90 hover:scale-110 focus:outline-none focus:ring-1 focus:ring-accent",
                          isToday ? "ring-1 ring-white/50 ring-offset-1 ring-offset-bg-secondary" : "",
                          isSelected ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-secondary" : "",
                        ].join(" ")}
                        aria-label={`${cell.key}: ${formatNumber(cell.tokens, locale)} tokens`}
                        onClick={(event) => {
                          if (!onSelectDate) return;
                          event.preventDefault();
                          onSelectDate(cell.key);
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            key:    cell.key,
                            tokens: cell.tokens,
                            cost:   cell.cost,
                            x:      rect.left + rect.width / 2,
                            y:      rect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Tooltip — rendered into document.body via portal so z-index is unrestricted */}
      {tooltip && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className="bg-bg-primary border border-border rounded-lg shadow-xl px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium text-text-primary mb-0.5">{tooltip.key}</div>
            {tooltip.tokens > 0 ? (
              <>
                <div className="text-text-secondary">
                  {formatNumber(tooltip.tokens, locale)} tokens
                </div>
                <div className="text-text-muted">{formatCostFull(tooltip.cost, locale)}</div>
              </>
            ) : (
              <div className="text-text-muted">{t(locale, "tokens.daily.noActivity" as never)}</div>
            )}
          </div>
          <div className="flex justify-center -mt-px">
            <div className="w-2 h-2 bg-bg-primary border-r border-b border-border rotate-45" />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
