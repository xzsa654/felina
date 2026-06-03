import { lazy, Suspense } from "react";
import { createMemoryRouter, Navigate, Outlet } from "react-router";
import PageLoader from "$lib/components/shared/PageLoader";
import Sidebar from "$lib/components/layout/Sidebar";
import UpdateBanner from "$lib/components/layout/UpdateBanner";
import CommandPalette from "$lib/components/shared/CommandPalette";
import OnboardingWelcome from "$lib/components/shared/OnboardingWelcome";
import ShapeGrid from "$lib/components/shared/ShapeGrid/ShapeGrid";
import { useThemeStore } from "$lib/stores/theme";

const SkillsPage = lazy(() => import("$lib/components/skills/SkillsPage"));
const ProjectsPage = lazy(() => import("$lib/components/projects/ProjectsPage"));
const FelinaSettingsPage = lazy(() => import("$lib/components/settings/FelinaSettingsPage"));
const TokensPage = lazy(() => import("$lib/components/tokens/TokensPage"));
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
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const isLight = resolvedTheme === "light";
  return (
    <>
      <CommandPalette />
      <OnboardingWelcome />
      <div className="flex h-screen w-screen">
        <Sidebar />
        <main className="relative flex flex-col flex-1 min-w-0">
          <div className="app-gradient-layer absolute inset-0 pointer-events-none z-0" />
          <div
            className={`absolute inset-0 pointer-events-none z-0 ${isLight ? "opacity-30" : "opacity-15"}`}
          >
            <ShapeGrid
              speed={0.3}
              squareSize={40}
              direction="diagonal"
              shape="hexagon"
              borderColor={isLight ? "#8b5cf6" : "#3a3a3a"}
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
      { path: "felina-settings", element: <LazyPage Component={FelinaSettingsPage} /> },
      { path: "tokens", element: <LazyPage Component={TokensPage} /> },
      { path: "memory", element: <LazyPage Component={MemoryPage} /> },
      { path: "history", element: <LazyPage Component={HistoryPage} /> },
    ],
  },
];

export const router = createMemoryRouter(routes, {
  initialEntries: ["/skills"],
});
