import en from "./locales/en";
import zhTW from "./locales/zh-TW";
import type { TranslationDict } from "./locales/en";

export type { TranslationDict } from "./locales/en";

export type Locale = "en" | "zh-TW";

const dictionaries: Record<Locale, TranslationDict> = {
  en,
  "zh-TW": zhTW,
};

/**
 * All valid translation keys, derived from the English dictionary shape.
 * Supports dot-notation for deeply nested keys (e.g. "tokens.statCards.totalTokens").
 * Only yields paths to string leaves — intermediate objects are skipped.
 */
type NestedPaths<T, P extends string = never> = {
  [K in keyof T & string]: T[K] extends string
    ? [P] extends [never] ? K : `${P & string}.${K}`
    : NestedPaths<T[K], [P] extends [never] ? K : `${P & string}.${K}`>;
}[keyof T & string];

export type TranslationKey = NestedPaths<TranslationDict>;

/**
 * Resolve a dot-notation key to a nested dictionary value.
 */
function resolvePath(
  obj: TranslationDict,
  path: string,
): string | Record<string, unknown> {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[part];
  }
  return current as string | Record<string, unknown>;
}

/**
 * Get a translated string for the given locale and key.
 * Falls back to English if the key is missing in the target locale.
 * Interpolates `{param}` placeholders using the optional `params` object.
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale];
  // Try target locale first, fall back to English
  let value: unknown = resolvePath(dict, key);
  if (typeof value !== "string") {
    value = resolvePath(en, key);
  }
  if (typeof value !== "string") return key;

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, k: string) =>
      k in params ? String(params[k]) : `{${k}}`,
    );
  }
  return value;
}

/**
 * Shorthand: get a translated string using the active locale.
 * Intended for use inside React components that read the locale from the Zustand store.
 */
export function getDict(locale: Locale): TranslationDict {
  return dictionaries[locale];
}
