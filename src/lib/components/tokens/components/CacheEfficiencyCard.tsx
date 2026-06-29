import type { CacheEfficiency } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumberFull, formatCostFull } from "$lib/utils/format";
import { buildJesseContextDragData, setJesseContextDragData } from "../jesse-context";

export default function CacheEfficiencyCard({
  data,
  locale,
}: {
  data: CacheEfficiency | null;
  locale: Locale;
}) {
  if (!data) {
    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          {t(locale, "tokens.cacheEfficiency.title")}
        </h3>
        <p className="text-xs text-text-muted">{t(locale, "common.noData")}</p>
      </div>
    );
  }

  const ratioPct = (data.cache_hit_ratio * 100).toFixed(1);
  const cacheTotal = data.total_input_tokens + data.cache_read_tokens + data.cache_write_tokens;
  const readShare = cacheTotal > 0 ? (data.cache_read_tokens / cacheTotal) * 100 : 0;
  const title = t(locale, "tokens.cacheEfficiency.title");
  const dragData = buildJesseContextDragData({
    kind: "token-overview",
    title,
    source: "tokens.cacheEfficiency",
    capturedAt: new Date().toISOString(),
    summary: `${title}: cache hit ratio ${ratioPct}%, cache read share ${readShare.toFixed(0)}%, estimated savings ${formatCostFull(data.cache_cost_saved, locale)}.`,
    metrics: {
      cacheHitRatioPct: ratioPct,
      cacheReadSharePct: readShare.toFixed(0),
      totalInputTokens: data.total_input_tokens,
      cacheReadTokens: data.cache_read_tokens,
      cacheWriteTokens: data.cache_write_tokens,
      cacheCostSavedUsd: data.cache_cost_saved,
    },
  });

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3
        className="mb-3 inline-block cursor-grab text-sm font-medium text-text-secondary active:cursor-grabbing"
        draggable
        onDragStart={(event) => setJesseContextDragData(event.dataTransfer, dragData, title)}
        title="Drag to Jesse"
      >
        {title}
      </h3>
      <div className="space-y-3">
        <p className="text-xs text-text-muted">
          {t(locale, "tokens.cacheEfficiency.summary", {
            pct: readShare.toFixed(0),
          })}
        </p>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">
              {t(locale, "tokens.cacheEfficiency.hitRatio")}
            </span>
            <span className="text-text-primary font-medium">{ratioPct}%</span>
          </div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${Math.min(data.cache_hit_ratio * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-text-muted">
              {t(locale, "tokens.cacheEfficiency.cacheReads")}
            </span>
            <p className="text-text-primary font-medium">
              {formatNumberFull(data.cache_read_tokens, locale)}
            </p>
          </div>
          <div>
            <span className="text-text-muted">
              {t(locale, "tokens.cacheEfficiency.cacheWrites")}
            </span>
            <p className="text-text-primary font-medium">
              {formatNumberFull(data.cache_write_tokens, locale)}
            </p>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted">
              {t(locale, "tokens.cacheEfficiency.estimatedSavings")}
            </span>
            <p className="text-success font-medium">
              {formatCostFull(data.cache_cost_saved, locale)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
