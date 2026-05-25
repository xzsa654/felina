import { Download, X } from "lucide-react";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  onImport: () => void;
}

/**
 * Dismissable banner shown on the Skills page when the canonical store is
 * empty AND agent-native dirs contain skills (decision 6).
 *
 * Visibility rules (computed in the parent, not here):
 *   1. detectedImportCount > 0
 *   2. bannerDismissed === false
 *   3. canonical list is empty
 *
 * This component is a pure presenter; dismissal persists via the store.
 */
export default function SkillImportBanner({ onImport }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const detected = useSkillsStore((s) => s.detectedImportCount);
  const dismissBanner = useSkillsStore((s) => s.dismissBanner);

  const label = detected === 1
    ? t(locale, "skills.importBanner.detectedSingle")
    : t(locale, "skills.importBanner.detected", { n: detected });

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 mb-4 flex items-start gap-3">
      <Download size={18} className="text-accent mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <p className="text-xs text-text-secondary mt-0.5">
          {t(locale, "skills.importBanner.description")}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onImport}
          className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover"
        >
          {t(locale, "skills.importBanner.import")}
        </button>
        <button
          type="button"
          onClick={dismissBanner}
          className="p-1 text-text-secondary hover:text-text-primary"
          title={t(locale, "skills.importBanner.dismiss")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
