import AgentPathsSection from "./AgentPathsSection";
import SavedKnownProjectsSection from "./SavedKnownProjectsSection";
import SkillLibrarySection from "./SkillLibrarySection";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";

export default function FelinaSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">
          {t(locale, "felinaSettings.title")}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {t(locale, "felinaSettings.description")}
        </p>
      </div>

      <div className="space-y-6">
        <AgentPathsSection />
        <SavedKnownProjectsSection />
        <SkillLibrarySection />
      </div>
    </div>
  );
}
