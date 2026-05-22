/**
 * Skills store — runtime state for the canonical skills page.
 *
 * Source-of-truth split:
 * - Persistent state (canonical content, dirty flag, last_synced timestamp)
 *   lives on disk and is owned by the Rust backend. The store mirrors it
 *   in memory for fast UI reads; calls to `loadEntries()` refresh from disk.
 * - The import banner's dismissed-flag is a pure UI preference and is
 *   persisted to localStorage so users aren't pestered after dismissing.
 *
 * The store doesn't double-track `dirty` separately from the backend
 * value — when a save lands, we re-call `loadEntries()` (or update the
 * entry inline). That keeps a single semantic source.
 */
import { create } from "zustand";
import { api } from "$lib/tauri/commands";
import type { CanonicalSkill, SkillListEntry, SkillScope, SyncResult } from "$lib/types";

const BANNER_DISMISSED_KEY = "felina.skills.importBannerDismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    } else {
      window.localStorage.removeItem(BANNER_DISMISSED_KEY);
    }
  } catch {
    // localStorage may be unavailable (private mode / tauri webview restrictions);
    // dismissal silently becomes session-only.
  }
}

interface SkillsStore {
  // Listing
  scope: SkillScope;
  projectPath: string | null;
  entries: SkillListEntry[];
  loaded: boolean;
  error: string | null;

  // Import banner (per Decision 6: dismissable + persistent)
  bannerDismissed: boolean;
  detectedImportCount: number;

  // Push activity
  pushingNames: Set<string>;
  lastSyncResults: SyncResult[];

  // Actions
  setScope: (scope: SkillScope) => void;
  setProjectPath: (path: string | null) => void;
  loadEntries: () => Promise<void>;
  refreshImportCount: () => Promise<void>;
  dismissBanner: () => void;
  resetBannerDismissed: () => void;
  markEntryDirty: (name: string) => void;
  upsertEntry: (skill: CanonicalSkill) => void;
  removeEntry: (name: string) => void;
  syncOne: (name: string) => Promise<SyncResult[]>;
  syncAll: () => Promise<SyncResult[]>;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  scope: "global",
  projectPath: null,
  entries: [],
  loaded: false,
  error: null,

  bannerDismissed: readDismissed(),
  detectedImportCount: 0,

  pushingNames: new Set(),
  lastSyncResults: [],

  setScope: (scope) => {
    set({ scope, loaded: false });
  },
  setProjectPath: (path) => {
    set({ projectPath: path, loaded: false });
  },

  loadEntries: async () => {
    const { scope, projectPath } = get();
    try {
      const entries = await api.canonicalSkills.list(scope, projectPath ?? undefined);
      set({ entries, loaded: true, error: null });
    } catch (e) {
      set({ entries: [], loaded: true, error: String(e) });
    }
  },

  refreshImportCount: async () => {
    const { scope, projectPath } = get();
    try {
      const r = await api.skillImport.scanQuick(scope, projectPath ?? undefined);
      set({ detectedImportCount: r.total });
    } catch {
      set({ detectedImportCount: 0 });
    }
  },

  dismissBanner: () => {
    writeDismissed(true);
    set({ bannerDismissed: true });
  },
  resetBannerDismissed: () => {
    writeDismissed(false);
    set({ bannerDismissed: false });
  },

  markEntryDirty: (name) => {
    set((s) => ({
      entries: s.entries.map((e) =>
        e.kind === "ok" && e.skill.name === name
          ? { ...e, skill: { ...e.skill, dirty: true } }
          : e,
      ),
    }));
  },

  upsertEntry: (skill) => {
    set((s) => {
      const next = s.entries.filter(
        (e) => !(e.kind === "ok" && e.skill.name === skill.name),
      );
      next.push({ kind: "ok", skill });
      next.sort((a, b) => entryName(a).localeCompare(entryName(b)));
      return { entries: next };
    });
  },

  removeEntry: (name) => {
    set((s) => ({
      entries: s.entries.filter((e) => entryName(e) !== name),
    }));
  },

  syncOne: async (name) => {
    const { scope, projectPath } = get();
    set((s) => {
      const next = new Set(s.pushingNames);
      next.add(name);
      return { pushingNames: next };
    });
    try {
      const results = await api.skillSync.one(scope, name, projectPath ?? undefined);
      const allOk = results.every((r) => r.success);
      set((s) => ({
        entries: allOk
          ? s.entries.map((e) =>
              e.kind === "ok" && e.skill.name === name
                ? {
                    ...e,
                    skill: {
                      ...e.skill,
                      dirty: false,
                      lastSynced: new Date().toISOString(),
                    },
                  }
                : e,
            )
          : s.entries,
        lastSyncResults: results,
      }));
      return results;
    } finally {
      set((s) => {
        const next = new Set(s.pushingNames);
        next.delete(name);
        return { pushingNames: next };
      });
    }
  },

  syncAll: async () => {
    const { scope, projectPath } = get();
    try {
      const results = await api.skillSync.all(scope, projectPath ?? undefined);
      // Reload to pick up sync-meta sidecar changes for every skill.
      await get().loadEntries();
      set({ lastSyncResults: results });
      return results;
    } catch (e) {
      set({ error: String(e) });
      return [];
    }
  },
}));

function entryName(e: SkillListEntry): string {
  return e.kind === "ok" ? e.skill.name : e.name;
}

// ---------------------------------------------------------------------------
// Selectors / derived helpers (for non-component callers).
// ---------------------------------------------------------------------------

export function dirtyCount(): number {
  return useSkillsStore
    .getState()
    .entries.filter((e) => e.kind === "ok" && e.skill.dirty).length;
}

export function dirtyNames(): string[] {
  return useSkillsStore
    .getState()
    .entries.filter((e) => e.kind === "ok" && e.skill.dirty)
    .map((e) => (e as Extract<SkillListEntry, { kind: "ok" }>).skill.name);
}
