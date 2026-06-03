import AgentPathsSection from "./AgentPathsSection";
import DataPruningSection from "./DataPruningSection";
import SavedKnownProjectsSection from "./SavedKnownProjectsSection";
import SkillLibrarySection from "./SkillLibrarySection";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import { PageBody, PageHeader } from "$lib/components/shared/PageScaffold";

export default function FelinaSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={t(locale, "felinaSettings.title")}
        subtitle={t(locale, "felinaSettings.description")}
      />
      <PageBody>
        <div className="space-y-6">
          <AgentPathsSection />
          <SavedKnownProjectsSection />
          <DataPruningSection />
          <SkillLibrarySection />
        </div>
      </PageBody>
    </div>
  );
}
