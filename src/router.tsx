import { lazy, Suspense } from "react";
import { createMemoryRouter, Navigate, Outlet } from "react-router";
import PageLoader from "$lib/components/shared/PageLoader";
import Sidebar from "$lib/components/layout/Sidebar";
import Header from "$lib/components/layout/Header";
import UpdateBanner from "$lib/components/layout/UpdateBanner";
import CommandPalette from "$lib/components/shared/CommandPalette";
import OnboardingWelcome from "$lib/components/shared/OnboardingWelcome";

const DashboardPage = lazy(() => import("$lib/components/dashboard/DashboardPage"));
const SettingsPage = lazy(() => import("$lib/components/settings/SettingsPage"));
const HooksPage = lazy(() => import("$lib/components/hooks/HooksPage"));
const InstructionsPage = lazy(() => import("$lib/components/instructions/InstructionsPage"));
const MemoryPage = lazy(() => import("$lib/components/memory/MemoryPage"));
const McpPage = lazy(() => import("$lib/components/mcp/McpPage"));
const SkillsPage = lazy(() => import("$lib/components/skills/SkillsPage"));
const RulesPage = lazy(() => import("$lib/components/rules/RulesPage"));
const PluginsPage = lazy(() => import("$lib/components/plugins/PluginsPage"));
const GitPage = lazy(() => import("$lib/components/git/GitPage"));
const TerminalPage = lazy(() => import("$lib/components/terminal/TerminalPage"));
const AnalyticsPage = lazy(() => import("$lib/components/analytics/AnalyticsPage"));
const TokensPage = lazy(() => import("$lib/components/tokens/TokensPage"));
const TemplatesPage = lazy(() => import("$lib/components/templates/TemplatesPage"));
const SessionsPage = lazy(() => import("$lib/components/sessions/SessionsPage"));
const PipelinesPage = lazy(() => import("$lib/components/pipelines/PipelinesPage"));
const TokenSavingsPage = lazy(() => import("$lib/components/token-savings/TokenSavingsPage"));
const ContextEnginePage = lazy(() => import("$lib/components/context-engine/ContextEnginePage"));
const KeybindingsPage = lazy(() => import("$lib/components/keybindings/KeybindingsPage"));

function LazyPage({ Component }: { Component: React.ComponentType }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

function AppLayout() {
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
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}

const routes = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <LazyPage Component={DashboardPage} /> },
      { path: "settings", element: <LazyPage Component={SettingsPage} /> },
      { path: "hooks", element: <LazyPage Component={HooksPage} /> },
      { path: "instructions", element: <LazyPage Component={InstructionsPage} /> },
      { path: "memory", element: <LazyPage Component={MemoryPage} /> },
      { path: "mcp", element: <LazyPage Component={McpPage} /> },
      { path: "skills", element: <LazyPage Component={SkillsPage} /> },
      { path: "rules", element: <LazyPage Component={RulesPage} /> },
      { path: "plugins", element: <LazyPage Component={PluginsPage} /> },
      { path: "git", element: <LazyPage Component={GitPage} /> },
      { path: "terminal", element: <LazyPage Component={TerminalPage} /> },
      { path: "analytics", element: <LazyPage Component={AnalyticsPage} /> },
      { path: "tokens", element: <LazyPage Component={TokensPage} /> },
      { path: "templates", element: <LazyPage Component={TemplatesPage} /> },
      { path: "sessions", element: <LazyPage Component={SessionsPage} /> },
      { path: "pipelines", element: <LazyPage Component={PipelinesPage} /> },
      { path: "token-savings", element: <LazyPage Component={TokenSavingsPage} /> },
      { path: "context-engine", element: <LazyPage Component={ContextEnginePage} /> },
      { path: "keybindings", element: <LazyPage Component={KeybindingsPage} /> },
    ],
  },
];

export const router = createMemoryRouter(routes, {
  initialEntries: ["/dashboard"],
});
