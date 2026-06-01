import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { PageBody, PageHeader } from "$lib/components/shared/PageScaffold";
import { useProjectContextStore } from "$lib/stores/project-context";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { api } from "$lib/tauri/commands";
import type { KnownProject } from "$lib/types";
import { normalizeProjectPath } from "$lib/utils/path";
import ProjectsList from "./ProjectsList";
import ManagedInventory from "./ManagedInventory";
import ResizableHandle from "$lib/components/skills/ResizableHandle";

/**
 * Projects top-level view (scope-model-simplification). A per-project
 * "managed inventory" dashboard: left column lists Known Projects, right
 * column shows each project's skill management state (managed label +
 * per-agent chips). Read-only with respect to canonical masters and target
 * rows — all editing happens on the Skills page.
 */
export default function ProjectsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const cwd = useProjectContextStore((s) => s.selectedProjectPath);
  const [projects, setProjects] = useState<KnownProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await api.knownProjects.list(cwd ?? undefined);
      // Stable alphabetical order by normalized path so the left column does
      // not reshuffle between refreshes (known-projects spec).
      list.sort((a, b) =>
        normalizeProjectPath(a.path).localeCompare(normalizeProjectPath(b.path)),
      );
      setProjects(list);
      // Default selection: the L1 cwd project when present, else first entry.
      setSelectedPath((cur) => {
        if (cur && list.some((p) => p.path === cur)) return cur;
        const cwdHit = list.find((p) => p.sources.includes("cwd"));
        return cwdHit?.path ?? list[0]?.path ?? null;
      });
    } catch {
      setProjects([]);
    } finally {
      setLoaded(true);
    }
  }, [cwd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-stat on window focus / visibility — folder rename/delete happens
  // outside the app and drives the "project not found" indicator.
  useEffect(() => {
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function handleReload() {
    setReloading(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setReloading(false), 250);
    }
  }

  const selectedProject = projects.find((p) => p.path === selectedPath) ?? null;
  const projectsLayout = useDefaultLayout({ id: "felina-projects-layout" });

  return (
    <>
      <PageHeader
        title={t(locale, "projects.title")}
        subtitle={t(locale, "projects.subtitle")}
        icon={FolderOpen}
        actions={
          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={reloading}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-60"
          >
            {reloading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {reloading ? t(locale, "projects.reloading") : t(locale, "projects.reload")}
          </button>
        }
      />
      <PageBody>
        <Group
          orientation="horizontal"
          defaultLayout={projectsLayout.defaultLayout}
          onLayoutChanged={projectsLayout.onLayoutChanged}
          id="felina-projects-layout"
          className="flex-1 min-h-0"
        >
          <Panel
            id="projects-list"
            defaultSize="25%"
            minSize="15%"
            maxSize="50%"
            collapsible
            className="border border-border rounded overflow-y-auto"
          >
            <ProjectsList
              projects={projects}
              loaded={loaded}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              onRemoved={() => void refresh()}
            />
          </Panel>

          <ResizableHandle />

          <Panel id="project-detail" className="border border-border rounded overflow-hidden">
            <ManagedInventory
              project={selectedProject}
              onChanged={() => void refresh()}
            />
          </Panel>
        </Group>
      </PageBody>
    </>
  );
}
