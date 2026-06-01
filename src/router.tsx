import { lazy, Suspense } from "react";
import { createMemoryRouter, Navigate, Outlet } from "react-router";
import PageLoader from "$lib/components/shared/PageLoader";
import Sidebar from "$lib/components/layout/Sidebar";
import UpdateBanner from "$lib/components/layout/UpdateBanner";
import CommandPalette from "$lib/components/shared/CommandPalette";
import OnboardingWelcome from "$lib/components/shared/OnboardingWelcome";
import ShapeGrid from "$lib/components/shared/ShapeGrid/ShapeGrid";

const SkillsPage = lazy(() => import("$lib/components/skills/SkillsPage"));
const ProjectsPage = lazy(() => import("$lib/components/projects/ProjectsPage"));
const SettingsPage = lazy(() => import("$lib/components/settings/SettingsPage"));
const FelinaSettingsPage = lazy(() => import("$lib/components/settings/FelinaSettingsPage"));
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
        <main className="relative flex flex-col flex-1 min-w-0">
          <div className="absolute inset-0 opacity-15 pointer-events-none z-0">
            <ShapeGrid
              speed={0.3}
              squareSize={40}
              direction="diagonal"
              shape="hexagon"
              borderColor="#3a3a3a"
              hoverFillColor="#6366f1"
              hoverTrailAmount={4}
            />
          </div>
          <UpdateBanner />
          <div className="relative z-10 flex-1 overflow-hidden flex flex-col min-h-0">
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
      { path: "projects", element: <LazyPage Component={ProjectsPage} /> },
      { path: "settings", element: <LazyPage Component={SettingsPage} /> },
      { path: "felina-settings", element: <LazyPage Component={FelinaSettingsPage} /> },
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
