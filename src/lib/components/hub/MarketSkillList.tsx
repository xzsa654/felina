import { CheckCircle, Download } from "lucide-react";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import {
  glassListRowClass,
  glassListSelectedRowClass,
  glassListSurfaceClass,
} from "$lib/components/shared/PageScaffold";

export interface MarketSkillListEntry {
  name: string;
  version: string | null;
  author: string | null;
  upToDate: boolean;
}

export default function MarketSkillList({
  entries,
  selectedName,
  onSelect,
  locale,
}: {
  entries: MarketSkillListEntry[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  locale: Locale;
}) {
  return (
    <div className={`rounded-xl p-1 ${glassListSurfaceClass}`}>
      {entries.map((entry) => {
        const selected = entry.name === selectedName;
        return (
          <button
            key={entry.name}
            type="button"
            onClick={() => onSelect(entry.name)}
            className={`w-full min-h-12 rounded-lg px-3 py-2 text-left transition-colors ${
              selected ? glassListSelectedRowClass : glassListRowClass
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-text-primary">
                  {entry.name}
                </span>
                {entry.version && (
                  <span className="block text-xs text-text-muted">
                    v{entry.version}
                  </span>
                )}
              </div>
              {entry.upToDate ? (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <CheckCircle size={12} />
                  {t(locale, "hub.list.installed")}
                </span>
              ) : (
                <Download size={13} className="text-text-muted shrink-0" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
