import { invoke } from "@tauri-apps/api/core";
import type {
  Settings,
  SettingsScope,
  StatsCache,
  ProjectInfo,
  MemoryFile,
  InstructionFile,
  SkillInfo,
  RuleFile,
  HookEventConfig,
  TokenAnalytics,
  ModelBreakdown,
  CacheEfficiency,
  AgentStatus,
  RefreshResult,
  CanonicalSkill,
  SkillListEntry,
  SyncResult,
  ImportCandidate,
  ImportSelection,
  AgentPathsConfig,
  KnownProject,
  SkillTarget,
  OrphanFile,
  MigrationCandidate,
  MigrationAction,
  MigrationResult,
} from "$lib/types";

// Retained-for-reference wrappers (hooks / instructions / mcp / rules / budget / stats):
// backend modules + frontend pages are kept on disk but unregistered from invoke_handler.
// Calling these at runtime will fail until the corresponding command is re-registered.
export const api = {
  settings: {
    read: (scope: SettingsScope, projectPath?: string) =>
      invoke<Settings>("read_settings", { scope, projectPath }),
    write: (scope: SettingsScope, settings: Settings, projectPath?: string) =>
      invoke<void>("write_settings", { scope, projectPath, settings }),
  },

  stats: {
    get: () => invoke<StatsCache>("get_stats"),
    computeLive: () => invoke<StatsCache>("compute_live_stats"),
  },

  projects: {
    list: () => invoke<ProjectInfo[]>("list_projects"),
  },

  hooks: {
    get: (scope: SettingsScope, projectPath?: string) =>
      invoke<Record<string, HookEventConfig[]>>("get_hooks", { scope, projectPath }),
    set: (scope: SettingsScope, hooks: Record<string, HookEventConfig[]>, projectPath?: string) =>
      invoke<void>("set_hooks", { scope, projectPath, hooks }),
  },

  memory: {
    listFiles: (projectHash: string) =>
      invoke<MemoryFile[]>("list_memory_files", { projectHash }),
    readFile: (projectHash: string, filename: string) =>
      invoke<MemoryFile>("read_memory_file", { projectHash, filename }),
    writeFile: (
      projectHash: string,
      filename: string,
      name: string | null,
      description: string | null,
      memoryType: string | null,
      content: string,
    ) =>
      invoke<void>("write_memory_file", {
        projectHash,
        filename,
        name,
        description,
        memoryType,
        content,
      }),
    deleteFile: (projectHash: string, filename: string) =>
      invoke<void>("delete_memory_file", { projectHash, filename }),
  },

  instructions: {
    read: (scope: string, projectPath?: string) =>
      invoke<InstructionFile>("read_instructions", { scope, projectPath }),
    write: (scope: string, content: string, projectPath?: string) =>
      invoke<void>("write_instructions", { scope, projectPath, content }),
    readReference: (basePath: string, reference: string) =>
      invoke<string>("read_referenced_file", { basePath, reference }),
  },

  mcp: {
    list: (scope: SettingsScope, projectPath?: string) =>
      invoke<Record<string, unknown>>("list_mcp_servers", { scope, projectPath }),
    upsert: (scope: SettingsScope, name: string, config: unknown, projectPath?: string) =>
      invoke<void>("upsert_mcp_server", { scope, projectPath, name, config }),
    delete: (scope: SettingsScope, name: string, projectPath?: string) =>
      invoke<void>("delete_mcp_server", { scope, projectPath, name }),
    getCloudMcps: () => invoke<string[]>("get_cloud_mcps"),
  },

  // Multi-agent canonical skills. Canonical master files live exclusively
  // under `~/.felina/skills/` after `scope-model-simplification`; these
  // wrappers no longer take a scope/project pair.
  canonicalSkills: {
    list: () => invoke<SkillListEntry[]>("canonical_skills_list"),
    read: (name: string) => invoke<CanonicalSkill>("canonical_skills_read", { name }),
    write: (
      name: string,
      frontmatter: Record<string, unknown>,
      body: string,
    ) =>
      invoke<void>("canonical_skills_write", {
        name,
        frontmatter,
        body,
      }),
    delete: (name: string) => invoke<void>("canonical_skills_delete", { name }),
  },

  // Fan-out sync (canonical → agent-native dirs). Push destinations come
  // from each skill's `SkillTarget` list — no caller-supplied scope needed.
  skillSync: {
    one: (name: string) => invoke<SyncResult[]>("skill_sync_one", { name }),
    all: () => invoke<SyncResult[]>("skill_sync_all"),
  },

  // Initial skill import (passive scan + manual wizard).
  // `projectPath`: `undefined` scans global agent dirs; a path scans that
  // project's agent dirs. Imports always write to global canonical and add
  // a `SkillTarget` pointing back at the source (`scope=project` when a
  // project path was supplied).
  skillImport: {
    scanQuick: (projectPath?: string) =>
      invoke<{
        anthropic: number;
        codex: number;
        gemini: number;
        total: number;
      }>("skill_import_scan_quick", { projectPath }),
    scan: (projectPath?: string) =>
      invoke<ImportCandidate[]>("skill_import_scan", { projectPath }),
    apply: (selections: ImportSelection[], projectPath?: string) =>
      invoke<void>("skill_import_apply", { projectPath, selections }),
  },

  // Known Projects.
  knownProjects: {
    list: (currentProject?: string) =>
      invoke<KnownProject[]>("known_projects_list", { currentProject }),
    add: (path: string) =>
      invoke<void>("known_projects_add", { path }),
    remove: (path: string) =>
      invoke<void>("known_projects_remove", { path }),
  },

  // Project→global canonical migration (scope-model-simplification).
  // Non-destructive one-shot: scan lists legacy <project>/.felina/skills/*,
  // apply copies the chosen ones to global + adds a project target. Legacy
  // dirs are never deleted.
  migration: {
    scan: () =>
      invoke<MigrationCandidate[]>("migrate_project_canonicals_scan"),
    apply: (items: MigrationAction[]) =>
      invoke<MigrationResult[]>("migrate_project_canonicals_apply", { items }),
  },

  // Per-skill target editor. Canonical lives in the single global dir;
  // `SkillTarget.scope` decides each push destination.
  skillTargets: {
    set: (skillName: string, targets: SkillTarget[]) =>
      invoke<void>("skill_targets_set", { skillName, targets }),
  },

  // Orphan prune. Project paths to scan are derived from the skill's own
  // targets, so callers only supply the skill name.
  skillPrune: {
    scan: (skillName: string) =>
      invoke<OrphanFile[]>("skill_prune_orphans_scan", { skillName }),
    apply: (skillName: string, orphans: OrphanFile[]) =>
      invoke<void>("skill_prune_orphans_apply", { skillName, orphans }),
  },

  // Settings → Agent Paths.
  agentPaths: {
    get: () => invoke<AgentPathsConfig>("agent_paths_get"),
    set: (config: AgentPathsConfig) =>
      invoke<void>("agent_paths_set", { config }),
  },

  agents: {
    list: (scope: string, projectPath?: string) =>
      invoke<SkillInfo[]>("list_agents", { scope, projectPath }),
    write: (scope: string, name: string, content: string, projectPath?: string) =>
      invoke<void>("write_agent", { scope, projectPath, name, content }),
    delete: (scope: string, name: string, projectPath?: string) =>
      invoke<void>("delete_agent", { scope, projectPath, name }),
  },

  rules: {
    list: (scope: string, projectPath?: string) =>
      invoke<RuleFile[]>("list_rules", { scope, projectPath }),
    write: (
      scope: string,
      filename: string,
      pathsFilter: string[],
      content: string,
      projectPath?: string,
    ) =>
      invoke<void>("write_rule", { scope, projectPath, filename, pathsFilter, content }),
    delete: (scope: string, filename: string, projectPath?: string) =>
      invoke<void>("delete_rule", { scope, projectPath, filename }),
  },

  maintenance: {
    getDiskUsage: () => invoke<DiskUsageReport>("get_disk_usage"),
    cleanup: (name: string) => invoke<number>("cleanup_directory", { name }),
  },

  budget: {
    get: () => invoke<BudgetSettings>("get_budget"),
    set: (dailyLimit: number | null, monthlyLimit: number | null, planType?: string) =>
      invoke<void>("set_budget", { dailyLimit, monthlyLimit, planType }),
    getCostSummary: () => invoke<CostSummary>("get_cost_summary"),
  },

  tokenAnalytics: {
    get: (params: {
      granularity: string;
      dateStart?: number;
      dateEnd?: number;
      filterAgent?: string;
      filterModel?: string;
    }) =>
      invoke<TokenAnalytics>("get_token_analytics", {
        granularity: params.granularity,
        dateStart: params.dateStart ?? null,
        dateEnd: params.dateEnd ?? null,
        filterAgent: params.filterAgent ?? null,
        filterModel: params.filterModel ?? null,
      }),
    getModelBreakdown: (dateStart?: number, dateEnd?: number) =>
      invoke<ModelBreakdown[]>("get_model_breakdown", {
        dateStart: dateStart ?? null,
        dateEnd: dateEnd ?? null,
      }),
    getCacheEfficiency: (dateStart?: number, dateEnd?: number) =>
      invoke<CacheEfficiency>("get_cache_efficiency", {
        dateStart: dateStart ?? null,
        dateEnd: dateEnd ?? null,
      }),
    getAvailableAgents: () =>
      invoke<AgentStatus[]>("get_available_agents"),
    refresh: () => invoke<RefreshResult>("refresh_token_data"),
  },
} as const;

export interface DiskUsageReport {
  total_bytes: number;
  total_display: string;
  entries: DiskUsageEntry[];
}

export interface DiskUsageEntry {
  name: string;
  path: string;
  size_bytes: number;
  size_display: string;
  description: string;
  safe_to_delete: boolean;
}

export interface BudgetSettings {
  daily_limit: number | null;
  monthly_limit: number | null;
  plan_type: string;
}

export interface CostSummary {
  today: number;
  this_month: number;
  last_7_days: number[];
  daily_limit: number | null;
  monthly_limit: number | null;
  daily_exceeded: boolean;
  monthly_exceeded: boolean;
  monthly_projection: number;
  per_project_month: ProjectCost[];
  plan_type: string;
}

export interface ProjectCost {
  project: string;
  cost: number;
  messages: number;
}
