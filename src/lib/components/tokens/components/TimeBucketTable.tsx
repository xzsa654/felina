import { useEffect, useState, startTransition, useMemo } from "react";
import type { TokenBucket } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";
import { formatNumber, formatCostFull, formatNumberFull } from "$lib/utils/format";
import { totalTokensForBucket } from "../token-insights";
import DayDetailPanel from "./DayDetailPanel";

type SortField = "label" | "event_count" | "total" | "cost_usd";

const PAGE_SIZE = 14;

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(value / total >= 0.1 ? 0 : 1)}%`;
}

const COMPOSITION_PARTS = [
  { key: "input_tokens",       label: "Input",       cls: "bg-blue-500" },
  { key: "output_tokens",      label: "Output",      cls: "bg-green-500" },
  { key: "cache_read_tokens",  label: "Cache Read",  cls: "bg-purple-500" },
  { key: "cache_write_tokens", label: "Cache Write", cls: "bg-amber-500" },
  { key: "reasoning_tokens",   label: "Reasoning",   cls: "bg-cyan-500" },
] as const;

export default function TimeBucketTable({
  data,
  locale,
  selectedDate,
  onSelectDate,
}: {
  data: TokenBucket[];
  locale: Locale;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("label");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const dated = useMemo(
    () => data.filter((b) => /^\d{4}-\d{2}-\d{2}/.test(b.label)),
    [data],
  );

  const sorted = useMemo(() => {
    return [...dated].sort((a, b) => {
      const av = sortField === "total" ? totalTokensForBucket(a) : (a[sortField] as string | number);
      const bv = sortField === "total" ? totalTokensForBucket(b) : (b[sortField] as string | number);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [dated, sortField, sortAsc]);

  const visible = sorted.slice(0, visibleCount);
  const remaining = sorted.length - visibleCount;
  const hasMore = remaining > 0;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((v) => !v);
    else { setSortField(field); setSortAsc(false); }
    setVisibleCount(PAGE_SIZE);
  }

  function toggleExpand(label: string) {
    onSelectDate?.(label);
    // startTransition marks this as non-urgent so React paints the click
    // feedback first, then renders the expanded content in the background.
    startTransition(() => {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.has(label) ? next.delete(label) : next.add(label);
        return next;
      });
    });
  }

  useEffect(() => {
    if (!selectedDate || !dated.some((bucket) => bucket.label === selectedDate)) return;

    const selectedIndex = sorted.findIndex((bucket) => bucket.label === selectedDate);
    if (selectedIndex >= 0 && selectedIndex >= visibleCount) {
      setVisibleCount(Math.ceil((selectedIndex + 1) / PAGE_SIZE) * PAGE_SIZE);
    }

    setExpanded((prev) => {
      if (prev.has(selectedDate)) return prev;
      const next = new Set(prev);
      next.add(selectedDate);
      return next;
    });

    const timer = setTimeout(() => {
      document
        .getElementById(`tokens-day-${selectedDate}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);

    return () => clearTimeout(timer);
  }, [dated, selectedDate, sorted, visibleCount]);

  const arrow = (f: SortField) => sortField === f ? (sortAsc ? " ↑" : " ↓") : "";

  function Th({ field, label, right }: { field: SortField; label: string; right?: boolean }) {
    return (
      <th
        className={`px-3 py-2 text-xs text-text-muted font-medium cursor-pointer hover:text-text-secondary whitespace-nowrap ${right ? "text-right" : "text-left"}`}
        onClick={() => toggleSort(field)}
      >
        {label}{arrow(field)}
      </th>
    );
  }

  if (dated.length === 0) return null;

  const totals = useMemo(() => dated.reduce(
    (acc, b) => ({
      event_count: acc.event_count + b.event_count,
      total: acc.total + totalTokensForBucket(b),
      cost_usd: acc.cost_usd + b.cost_usd,
    }),
    { event_count: 0, total: 0, cost_usd: 0 },
  ), [dated]);

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">
          {t(locale, "tokens.timeBucketTable.title" as never)}
        </h3>
        <span className="text-xs text-text-muted">
          {visible.length} / {sorted.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="border-b border-border">
              <th className="w-7" />
              <Th field="label"       label={t(locale, "tokens.timeBucketTable.colPeriod" as never)} />
              <Th field="event_count" label={t(locale, "tokens.timeBucketTable.colMessages" as never)} right />
              <th className="px-3 py-2 text-xs text-text-muted font-medium text-left min-w-[180px]">
                {t(locale, "tokens.timeBucketTable.colComposition" as never)}
              </th>
              <Th field="total"    label={t(locale, "tokens.timeBucketTable.colTotal" as never)} right />
              <Th field="cost_usd" label={t(locale, "tokens.timeBucketTable.colCost" as never)} right />
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => {
              const total = totalTokensForBucket(b);
              const isOpen = expanded.has(b.label);
              const parts = COMPOSITION_PARTS.filter((p) => b[p.key] > 0);

              return [
                <tr
                  key={b.label}
                  id={`tokens-day-${b.label}`}
                  className="border-b border-border/40 hover:bg-bg-tertiary/40 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(b.label)}
                >
                  <td className="pl-3 pr-1 py-2.5 text-text-muted">
                    <span
                      className="inline-block w-3 text-center transition-transform duration-150"
                      style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                    >
                      ▶
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-text-primary font-mono">{b.label}</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary">{formatNumber(b.event_count, locale)}</td>
                  <td className="px-3 py-2.5">
                    {total > 0 ? (
                      <div>
                        <div className="h-2 w-full rounded-full overflow-hidden bg-bg-tertiary flex">
                          {parts.map((p) => (
                            <div
                              key={p.key}
                              className={p.cls}
                              style={{ width: `${Math.max((b[p.key] / total) * 100, 1)}%` }}
                              title={`${p.label}: ${formatNumberFull(b[p.key], locale)}`}
                            />
                          ))}
                        </div>
                        <div className="mt-0.5 text-[10px] text-text-muted truncate">
                          {parts.slice(0, 3).map((p) => `${p.label} ${pct(b[p.key], total)}`).join(" · ")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-primary font-medium">
                    {formatNumber(total, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-primary font-medium">
                    {formatCostFull(b.cost_usd, locale)}
                  </td>
                </tr>,

                isOpen && (
                  <tr key={`${b.label}-detail`} className="border-b border-border/40 bg-bg-tertiary/20">
                    <td />
                    <td colSpan={5} className="px-4 pt-3 pb-5">
                      {/* Token composition summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-1.5 mb-4">
                        {COMPOSITION_PARTS.map((p) => (
                          <div key={p.key} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${p.cls}`} />
                            <span className="text-text-muted text-xs">{p.label}</span>
                            <span className="text-text-primary text-xs font-medium ml-auto">
                              {formatNumberFull(b[p.key], locale)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border/30 pt-3">
                        <DayDetailPanel date={b.label} locale={locale} />
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-bg-tertiary/50">
              <td />
              <td className="px-3 py-2 text-xs font-medium text-text-secondary">
                {t(locale, "tokens.timeBucketTable.total" as never)}
              </td>
              <td className="px-3 py-2 text-right text-xs font-medium text-text-primary">
                {formatNumber(totals.event_count, locale)}
              </td>
              <td />
              <td className="px-3 py-2 text-right text-xs font-semibold text-text-primary">
                {formatNumber(totals.total, locale)}
              </td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-text-primary">
                {formatCostFull(totals.cost_usd, locale)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {hasMore && (
        <button
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-tertiary rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t(locale, "tokens.timeBucketTable.loadMore" as never, { n: Math.min(remaining, PAGE_SIZE) })}
        </button>
      )}
    </div>
  );
}
