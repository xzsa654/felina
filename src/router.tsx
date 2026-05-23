import { lazy, Suspense } from "react";
import { createMemoryRouter, Navigate, Outlet } from "react-router";
import PageLoader from "$lib/components/shared/PageLoader";
import Sidebar from "$lib/components/layout/Sidebar";
import Header from "$lib/components/layout/Header";
import UpdateBanner from "$lib/components/layout/UpdateBanner";
import CommandPalette from "$lib/components/shared/CommandPalette";
import OnboardingWelcome from "$lib/components/shared/OnboardingWelcome";

const SkillsPage = lazy(() => import("$lib/components/skills/SkillsPage"));
const SettingsPage = lazy(() => import("$lib/components/settings/SettingsPage"));
const TokensPage = lazy(() => import("$lib/components/tokens/TokensPage"));
const TemplatesPage = lazy(() => import("$lib/components/templates/TemplatesPage"));
const MemoryPage = lazy(() => import("$lib/components/memory/MemoryPage"));
const HistoryPage = lazy(() => import("$lib/components/history/HistoryPage"));

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
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
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
      { index: true, element: <Navigate to="/skills" replace /> },
      { path: "skills", element: <LazyPage Component={SkillsPage} /> },
      { path: "settings", element: <LazyPage Component={SettingsPage} /> },
      { path: "tokens", element: <LazyPage Component={TokensPage} /> },
      { path: "templates", element: <LazyPage Component={TemplatesPage} /> },
      { path: "memory", element: <LazyPage Component={MemoryPage} /> },
      { path: "history", element: <LazyPage Component={HistoryPage} /> },
    ],
  },
];

export const router = createMemoryRouter(routes, {
  initialEntries: ["/skills"],
});
