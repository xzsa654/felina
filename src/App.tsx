import { useNavigationStore } from "$lib/stores/navigation";
import Sidebar from "$lib/components/layout/Sidebar";
import Header from "$lib/components/layout/Header";
import UpdateBanner from "$lib/components/layout/UpdateBanner";
import CommandPalette from "$lib/components/shared/CommandPalette";
import OnboardingWelcome from "$lib/components/shared/OnboardingWelcome";
import DashboardPage from "$lib/components/dashboard/DashboardPage";
import SettingsPage from "$lib/components/settings/SettingsPage";
import HooksPage from "$lib/components/hooks/HooksPage";
import InstructionsPage from "$lib/components/instructions/InstructionsPage";
import MemoryPage from "$lib/components/memory/MemoryPage";
import McpPage from "$lib/components/mcp/McpPage";
import SkillsPage from "$lib/components/skills/SkillsPage";
import RulesPage from "$lib/components/rules/RulesPage";
import PluginsPage from "$lib/components/plugins/PluginsPage";
import GitPage from "$lib/components/git/GitPage";
import PipelinesPage from "$lib/components/pipelines/PipelinesPage";
import SessionsPage from "$lib/components/sessions/SessionsPage";
import TemplatesPage from "$lib/components/templates/TemplatesPage";
import TerminalPage from "$lib/components/terminal/TerminalPage";
import AnalyticsPage from "$lib/components/analytics/AnalyticsPage";
import TokenSavingsPage from "$lib/components/token-savings/TokenSavingsPage";
import ContextEnginePage from "$lib/components/context-engine/ContextEnginePage";
import KeybindingsPage from "$lib/components/keybindings/KeybindingsPage";

const PAGE_MAP: Record<string, React.ComponentType> = {
  dashboard: DashboardPage,
  settings: SettingsPage,
  hooks: HooksPage,
  instructions: InstructionsPage,
  memory: MemoryPage,
  mcp: McpPage,
  skills: SkillsPage,
  rules: RulesPage,
  plugins: PluginsPage,
  git: GitPage,
  pipelines: PipelinesPage,
  sessions: SessionsPage,
  templates: TemplatesPage,
  terminal: TerminalPage,
  analytics: AnalyticsPage,
  "token-savings": TokenSavingsPage,
  "context-engine": ContextEnginePage,
  keybindings: KeybindingsPage,
};

export default function App() {
  const currentPage = useNavigationStore((s) => s.currentPage);
  const PageComponent = PAGE_MAP[currentPage];

  return (
    <>
      <CommandPalette />
      <OnboardingWelcome />

      <div className="flex h-screen w-screen">
        <Sidebar />

        <main className="flex flex-col flex-1 min-w-0">
          <UpdateBanner />
          <Header />

          <div className="flex-1 overflow-hidden">
            {PageComponent ? <PageComponent /> : null}
          </div>
        </main>
      </div>
    </>
  );
}
