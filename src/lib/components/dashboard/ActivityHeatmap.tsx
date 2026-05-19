import { useState } from "react";
import type { DailyActivity } from "$lib/types";
import { formatNumber } from "$lib/utils/format";

interface Props {
  dailyActivity: DailyActivity[];
}

interface DayCell {
  date: string;
  count: number;
  dayOfWeek: number;
  empty: boolean;
}

interface Tooltip {
  x: number;
  y: number;
  date: string;
  count: number;
  sessions: number;
  tools: number;
}

function getColor(count: number, empty: boolean): string {
  if (empty) return "bg-transparent";
  if (count === 0) return "bg-bg-tertiary";
  if (count < 100) return "bg-accent/20";
  if (count < 500) return "bg-accent/40";
  if (count < 1000) return "bg-accent/60";
  if (count < 3000) return "bg-accent/80";
  return "bg-accent";
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityHeatmap({ dailyActivity }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const activityMap = new Map<string, DailyActivity>();
  for (const d of dailyActivity) {
    activityMap.set(d.date, d);
  }

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 52 * 7 - start.getDay());

  const weeks: DayCell[][] = [];
  let currentWeek: DayCell[] = [];

  for (let i = 0; i <= 52 * 7 + today.getDay(); i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 0 && currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: "", count: 0, dayOfWeek: currentWeek.length, empty: true });
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }

    const activity = activityMap.get(dateStr);
    currentWeek.push({
      date: dateStr,
      count: activity?.messageCount ?? 0,
      dayOfWeek,
      empty: false,
    });
  }

  while (currentWeek.length < 7) {
    currentWeek.push({ date: "", count: 0, dayOfWeek: currentWeek.length, empty: true });
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  function showTooltip(e: React.MouseEvent, day: DayCell) {
    if (day.empty) return;
    const activity = activityMap.get(day.date);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      date: day.date,
      count: day.count,
      sessions: activity?.sessionCount ?? 0,
      tools: activity?.toolCallCount ?? 0,
    });
  }

  return (
    <>
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Activity</h3>

        <div className="flex gap-0">
          <div className="flex flex-col gap-[2px] mr-1.5 shrink-0" style={{ width: 28 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-[14px] text-[10px] text-text-muted leading-[14px]">
                {i % 2 === 1 ? label : ""}
              </div>
            ))}
          </div>

          <div className="flex gap-[2px] flex-1 min-w-0">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px] flex-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`h-[14px] rounded-sm ${getColor(day.count, day.empty)} ${day.empty ? "" : "cursor-pointer hover:ring-1 hover:ring-accent/50"}`}
                    role={day.empty ? undefined : "button"}
                    tabIndex={day.empty ? undefined : -1}
                    onMouseEnter={(e) => !day.empty && showTooltip(e, day)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-text-muted">
          <span>Less</span>
          <div className="flex gap-1">
            {["bg-bg-tertiary", "bg-accent/20", "bg-accent/40", "bg-accent/60", "bg-accent"].map((c) => (
              <div key={c} className={`w-[11px] h-[11px] rounded-sm ${c}`} />
            ))}
          </div>
          <span>More</span>
          <span className="ml-auto">
            {dailyActivity.filter((d) => d.messageCount > 0).length} days tracked
          </span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-bg-primary border border-border rounded-lg shadow-xl text-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-text-primary font-medium">
            {new Date(tooltip.date).toLocaleDateString("en", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-text-secondary">
            {formatNumber(tooltip.count)} messages · {tooltip.sessions} sessions ·{" "}
            {formatNumber(tooltip.tools)} tools
          </p>
        </div>
      )}
    </>
  );
}
