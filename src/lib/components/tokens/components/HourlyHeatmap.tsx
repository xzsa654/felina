import { useMemo } from "react";
import type { HourlyHeatmapEntry } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";

function quantileColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-bg-tertiary";
  const ratio = value / max;
  if (ratio > 0.8) return "bg-green-600";
  if (ratio > 0.6) return "bg-green-500";
  if (ratio > 0.4) return "bg-green-400";
  if (ratio > 0.2) return "bg-green-300";
  return "bg-green-200";
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// English short day names used as keys for map lookup (backend data uses these)
const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Translation key for each day in order
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function HourlyHeatmap({
  data,
  locale,
}: {
  data: HourlyHeatmapEntry[];
  locale: Locale;
}) {
  const { grid, maxTokens } = useMemo(() => {
    // Build a map of day-hour -> entry
    const map = new Map<string, HourlyHeatmapEntry>();
    let max = 0;
    for (const entry of data) {
      const key = `${entry.day}-${entry.hour}`;
      map.set(key, entry);
      if (entry.total_tokens > max) max = entry.total_tokens;
    }
    return { grid: map, maxTokens: max };
  }, [data]);

  // Display labels are translated; lookup uses English short names
  const displayDays = DAY_KEYS.map(
    (dk) => t(locale, `tokens.hourlyHeatmap.days.${dk}` as never),
  );

  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          {t(locale, "tokens.hourlyHeatmap.title")}
        </h3>
        <div className="flex items-center justify-center h-32 text-text-muted text-sm text-center">
          {t(locale, "tokens.hourlyHeatmap.aggregateOnly")}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        {t(locale, "tokens.hourlyHeatmap.title")}
      </h3>
      <div className="flex gap-1">
        {/* Hour labels */}
        <div className="flex flex-col gap-1 pr-2">
          <div className="h-5" />
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-5 text-[10px] text-text-muted flex items-center justify-end"
            >
              {h.toString().padStart(2, "0")}
            </div>
          ))}
        </div>
        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7 gap-1">
          {displayDays.map((day, di) => (
            <div key={day} className="flex flex-col gap-1">
              <div className="h-5 text-[10px] text-text-muted text-center">
                {day}
              </div>
              {HOURS.map((h) => {
                const key = `${DAY_NAMES_EN[di]}-${h}`;
                const entry = grid.get(key);
                const tokens = entry?.total_tokens ?? 0;
                const tooltipTokens = t(locale, "tokens.hourlyHeatmap.tooltipTokens", {
                  n: (entry?.total_tokens ?? 0).toLocaleString(),
                });
                return (
                  <div
                    key={h}
                    className={`h-5 rounded-sm ${quantileColor(tokens, maxTokens)}`}
                    title={
                      entry
                        ? `${entry.day} ${h}:00 — ${tooltipTokens}, $${entry.cost_usd.toFixed(2)}`
                        : ""
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end mt-2 gap-1">
        <span className="text-[10px] text-text-muted">{t(locale, "common.less")}</span>
        {[0.2, 0.4, 0.6, 0.8].map((r) => (
          <div
            key={r}
            className={`w-3 h-3 rounded-sm ${quantileColor(maxTokens * r, maxTokens)}`}
          />
        ))}
        <span className="text-[10px] text-text-muted">{t(locale, "common.more")}</span>
      </div>
    </div>
  );
}
