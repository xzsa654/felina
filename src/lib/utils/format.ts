import type { Locale } from "$lib/i18n";

const LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
  "zh-TW": "zh-TW",
};

function toBCP47(locale: Locale): string {
  return LOCALE_MAP[locale] || "en-US";
}

/**
 * Compact number with K/M suffix.
 * Locale-aware number part, suffix is always Latin K/M.
 */
export function formatNumber(n: number, locale: Locale = "en"): string {
  if (n >= 1_000_000) {
    const num = (n / 1_000_000).toFixed(1);
    const formatted = Number(num).toLocaleString(toBCP47(locale), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${formatted}M`;
  }
  if (n >= 1_000) {
    const num = (n / 1_000).toFixed(1);
    const formatted = Number(num).toLocaleString(toBCP47(locale), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${formatted}K`;
  }
  return n.toLocaleString(toBCP47(locale), {
    maximumFractionDigits: 0,
  });
}

/**
 * Full locale-aware number formatting (no compact suffix).
 */
export function formatNumberFull(n: number, locale: Locale = "en"): string {
  return n.toLocaleString(toBCP47(locale), {
    maximumFractionDigits: 0,
  });
}

/**
 * USD cost with compact formatting, locale-aware grouping.
 * Currency symbol always USD ($).
 */
export function formatCost(n: number, locale: Locale = "en"): string {
  const fmt = toBCP47(locale);
  if (n >= 10_000) {
    const num = (n / 1_000).toFixed(1);
    const formatted = Number(num).toLocaleString(fmt, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `$${formatted}K`;
  }
  if (n >= 1_000)
    return `$${n.toLocaleString(fmt, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

/**
 * Full USD cost formatting (no compact suffix), locale-aware grouping.
 */
export function formatCostFull(n: number, locale: Locale = "en"): string {
  return `$${n.toLocaleString(toBCP47(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format context window size: 1_000_000 → "1M", 200_000 → "200K", 128_000 → "128K".
 */
export function formatCtx(tokens: number | null | undefined): string {
  if (!tokens) return "";
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M ctx`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K ctx`;
  return `${tokens} ctx`;
}

/**
 * Locale-aware date formatting.
 */
export function formatDate(
  dateStr: string,
  locale: Locale = "en",
): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(toBCP47(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Locale-aware relative time.
 */
export function timeAgo(
  dateStr: string,
  locale: Locale = "en",
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return locale === "zh-TW" ? "今天" : "today";
  if (days === 1) return locale === "zh-TW" ? "昨天" : "yesterday";
  if (days < 7) return locale === "zh-TW" ? `${days} 天前` : `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return locale === "zh-TW" ? `${weeks} 週前` : `${weeks}w ago`;
  }
  const months = Math.floor(days / 30);
  return locale === "zh-TW" ? `${months} 個月前` : `${months}mo ago`;
}
