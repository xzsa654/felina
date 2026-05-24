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
 * After `scope-model-simplification`, canonical lives exclusively in
 * `~/.felina/skills/`; the store no longer tracks a canonical scope.
 * `projectPath` is retained only as a hint for the import scan banner so
 * the Skills page can show "import from current project's agent dirs".
 */
import { create } from "zustand";
import { api } from "$lib/tauri/commands";
import {
  canonicalSkillId,
  skillListEntryCanonicalId,
  type CanonicalSkill,
  type SkillListEntry,
  type SyncResult,
} from "$lib/types";

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
    // localStorage may be unavailable; dismissal silently becomes session-only.
  }
}

interface SkillsStore {
  // Listing
  projectPath: string | null;
  entries: SkillListEntry[];
  loaded: boolean;
  error: string | null;

  // Import banner
  bannerDismissed: boolean;
  detectedImportCount: number;

  // Push activity
  pushingNames: Set<string>;
  lastSyncResults: SyncResult[];

  // Actions
  setProjectPath: (path: string | null) => void;
  loadEntries: () => Promise<void>;
  refreshImportCount: () => Promise<void>;
  dismissBanner: () => void;
  resetBannerDismissed: () => void;
  markEntryDirty: (name: string) => void;
  upsertEntry: (skill: CanonicalSkill) => void;
  removeEntry: (canonicalId: string) => void;
  syncOne: (canonicalId: string) => Promise<SyncResult[]>;
  syncAll: () => Promise<SyncResult[]>;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  projectPath: null,
  entries: [],
  loaded: false,
  error: null,

  bannerDismissed: readDismissed(),
  detectedImportCount: 0,

  pushingNames: new Set(),
  lastSyncResults: [],

  setProjectPath: (path) => {
    set({ projectPath: path, loaded: false });
  },

  loadEntries: async () => {
    try {
      const entries = await api.canonicalSkills.list();
      set({ entries: entries.map(normalizeEntry), loaded: true, error: null });
    } catch (e) {
      set({ entries: [], loaded: true, error: String(e) });
    }
  },

  refreshImportCount: async () => {
    const { projectPath } = get();
    try {
      const r = await api.skillImport.scanQuick(projectPath ?? undefined);
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
      const normalizedSkill = normalizeSkill(skill);
      const canonicalId = canonicalSkillId(normalizedSkill);
      const next = s.entries.filter(
        (e) => !(e.kind === "ok" && skillListEntryCanonicalId(e) === canonicalId),
      );
      next.push({ kind: "ok", canonicalId, skill: normalizedSkill });
      next.sort((a, b) => entryName(a).localeCompare(entryName(b)));
      return { entries: next };
    });
  },

  removeEntry: (canonicalId) => {
    set((s) => ({
      entries: s.entries.filter((e) =>
        skillListEntryCanonicalId(e) !== canonicalId,
      ),
    }));
  },

  syncOne: async (canonicalId) => {
    set((s) => {
      const next = new Set(s.pushingNames);
      next.add(canonicalId);
      return { pushingNames: next };
    });
    try {
      const results = await api.skillSync.one(canonicalId);
      await get().loadEntries();
      set({ lastSyncResults: results, error: null });
      return results;
    } catch (e) {
      // A broken (unparseable) skill is rejected by the backend push guard.
      // Surface the parse error on the page banner instead of letting it
      // propagate as an unhandled rejection.
      set({ error: String(e) });
      return [];
    } finally {
      set((s) => {
        const next = new Set(s.pushingNames);
        next.delete(canonicalId);
        return { pushingNames: next };
      });
    }
  },

  syncAll: async () => {
    try {
      const results = await api.skillSync.all();
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

function normalizeSkill(skill: CanonicalSkill): CanonicalSkill {
  const canonicalId = canonicalSkillId(skill);
  return skill.canonicalId === canonicalId ? skill : { ...skill, canonicalId };
}

function normalizeEntry(entry: SkillListEntry): SkillListEntry {
  const canonicalId = skillListEntryCanonicalId(entry);
  if (entry.kind === "ok") {
    return { ...entry, canonicalId, skill: normalizeSkill(entry.skill) };
  }
  return { ...entry, canonicalId };
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
