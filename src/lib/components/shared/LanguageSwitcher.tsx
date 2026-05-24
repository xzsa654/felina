import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh-TW", label: "繁體中文" },
];

export default function LanguageSwitcher() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div
      className="flex items-center gap-0.5 bg-bg-tertiary rounded-md p-0.5"
      role="radiogroup"
      aria-label={t(locale, "common.language") as string}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            locale === opt.value
              ? "bg-bg-secondary text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
          role="radio"
          aria-checked={locale === opt.value}
          aria-label={opt.label}
          onClick={() => setLocale(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
