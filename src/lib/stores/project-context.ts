import { create } from "zustand";
import { api } from "$lib/tauri/commands";
import type { ProjectInfo } from "$lib/types";

interface ProjectContextStore {
  selectedProjectPath: string | null;
  projects: ProjectInfo[];
  loaded: boolean;
  selectProject: (path: string) => void;
  clearProject: () => void;
  loadProjects: () => Promise<void>;
}

export const useProjectContextStore = create<ProjectContextStore>((set) => ({
  selectedProjectPath: null,
  projects: [],
  loaded: false,

  selectProject: (path) => set({ selectedProjectPath: path }),
  clearProject: () => set({ selectedProjectPath: null }),

  loadProjects: async () => {
    try {
      const projects = await api.projects.list();
      set({ projects, loaded: true });
    } catch (e) {
      console.error("Failed to load projects:", e);
      set({ projects: [], loaded: true });
    }
  },
}));

// Convenience shorthands for non-component callers
export function getSelectedProjectPath(): string | null {
  return useProjectContextStore.getState().selectedProjectPath;
}

export function getSelectedProjectName(): string {
  const path = useProjectContextStore.getState().selectedProjectPath;
  if (!path) return "";
  return path.split("/").pop() ?? path;
}

export function getProjects(): ProjectInfo[] {
  return useProjectContextStore.getState().projects;
}

export function isLoaded(): boolean {
  return useProjectContextStore.getState().loaded;
}

export function selectProject(path: string) {
  useProjectContextStore.getState().selectProject(path);
}

export function clearProject() {
  useProjectContextStore.getState().clearProject();
}

export async function loadProjects() {
  return useProjectContextStore.getState().loadProjects();
}
