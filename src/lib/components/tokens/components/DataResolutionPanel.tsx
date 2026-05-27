import { BarChart3, Clock, Database } from "lucide-react";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumberFull } from "$lib/utils/format";
import type { DataResolution } from "../token-insights";

export default function DataResolutionPanel({
  resolution,
  eventCount,
  locale,
}: {
  resolution: DataResolution;
  eventCount: number;
  locale: Locale;
}) {
  const isAggregate = resolution.aggregateOnly;
  const statusKey = isAggregate
    ? "tokens.dataResolution.aggregate"
    : resolution.hasHourlyBuckets
      ? "tokens.dataResolution.hourly"
      : resolution.hasDatedBuckets
        ? "tokens.dataResolution.dated"
        : "tokens.dataResolution.empty";

  return (
    <div className="bg-bg-secondary border border-border rounded-lg px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-md bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
            {isAggregate ? (
              <Database size={16} className="text-warning" />
            ) : resolution.hasHourlyBuckets ? (
              <Clock size={16} className="text-success" />
            ) : (
              <BarChart3 size={16} className="text-info" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {t(locale, statusKey as never)}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {isAggregate
                ? t(locale, "tokens.dataResolution.aggregateDescription")
                : t(locale, "tokens.dataResolution.temporalDescription")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="px-2 py-1 rounded bg-bg-tertiary border border-border">
            {t(locale, "tokens.dataResolution.events", {
              n: formatNumberFull(eventCount, locale),
            })}
          </span>
          <span className="px-2 py-1 rounded bg-bg-tertiary border border-border">
            {t(locale, "tokens.dataResolution.buckets", {
              n: formatNumberFull(resolution.bucketCount, locale),
            })}
          </span>
          {resolution.hasDatedBuckets && (
            <span className="px-2 py-1 rounded bg-bg-tertiary border border-border">
              {t(locale, "tokens.dataResolution.datedBuckets", {
                n: formatNumberFull(resolution.datedBucketCount, locale),
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
