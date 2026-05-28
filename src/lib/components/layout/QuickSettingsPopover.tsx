import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Check, Monitor, Moon, Settings, Sun } from "lucide-react";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import { useThemeStore, type ThemePreference } from "$lib/stores/theme";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelKey: "quickSettings.themeDark" | "quickSettings.themeLight" | "quickSettings.themeSystem";
}> = [
  { value: "dark", icon: Moon, labelKey: "quickSettings.themeDark" },
  { value: "light", icon: Sun, labelKey: "quickSettings.themeLight" },
  { value: "system", icon: Monitor, labelKey: "quickSettings.themeSystem" },
];

const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh-TW", label: "繁體中文" },
];

export default function QuickSettingsPopover({ open, onClose, anchorRef }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-12 left-2 z-30 w-56 rounded-lg border border-border bg-bg-secondary shadow-2xl"
    >
      <div className="p-3 space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t(locale, "quickSettings.theme")}
          </div>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t(locale, "quickSettings.theme")}>
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs transition-colors ${
                    selected
                      ? "border-accent bg-accent-dim text-accent"
                      : "border-border bg-bg-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon size={16} />
                  <span>{t(locale, option.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t(locale, "quickSettings.language")}
          </div>
          <div className="space-y-1" role="radiogroup" aria-label={t(locale, "quickSettings.language")}>
            {LOCALE_OPTIONS.map((option) => {
              const selected = locale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                    selected
                      ? "bg-accent-dim text-accent"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                  onClick={() => setLocale(option.value)}
                >
                  <span>{option.label}</span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-2">
        <Link
          to="/felina-settings"
          onClick={onClose}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Settings size={15} />
          <span>{t(locale, "quickSettings.allSettings")}</span>
        </Link>
      </div>
    </div>
  );
}
