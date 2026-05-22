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
  SkillScope,
  SyncResult,
  ImportCandidate,
  ImportSelection,
  AgentPathsConfig,
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

  // Multi-agent canonical skills (multi-agent-skills-foundation).
  // The previous flat `list_skills` / `write_skill` / `delete_skill` shape
  // is gone; SkillsPage now drives canonical CRUD + fan-out + import.
  canonicalSkills: {
    list: (scope: SkillScope, projectPath?: string) =>
      invoke<SkillListEntry[]>("canonical_skills_list", { scope, projectPath }),
    read: (scope: SkillScope, name: string, projectPath?: string) =>
      invoke<CanonicalSkill>("canonical_skills_read", { scope, projectPath, name }),
    write: (
      scope: SkillScope,
      name: string,
      frontmatter: Record<string, unknown>,
      body: string,
      projectPath?: string,
    ) =>
      invoke<void>("canonical_skills_write", {
        scope,
        projectPath,
        name,
        frontmatter,
        body,
      }),
    delete: (scope: SkillScope, name: string, projectPath?: string) =>
      invoke<void>("canonical_skills_delete", { scope, projectPath, name }),
  },

  // Fan-out sync (canonical → agent-native dirs).
  skillSync: {
    one: (scope: SkillScope, name: string, projectPath?: string) =>
      invoke<SyncResult[]>("skill_sync_one", { scope, projectPath, name }),
    all: (scope: SkillScope, projectPath?: string) =>
      invoke<SyncResult[]>("skill_sync_all", { scope, projectPath }),
  },

  // Initial skill import (passive scan + manual wizard).
  skillImport: {
    scanQuick: (scope: SkillScope, projectPath?: string) =>
      invoke<{
        anthropic: number;
        codex: number;
        gemini: number;
        total: number;
      }>("skill_import_scan_quick", { scope, projectPath }),
    scan: (scope: SkillScope, projectPath?: string) =>
      invoke<ImportCandidate[]>("skill_import_scan", { scope, projectPath }),
    apply: (
      scope: SkillScope,
      selections: ImportSelection[],
      projectPath?: string,
    ) =>
      invoke<void>("skill_import_apply", { scope, projectPath, selections }),
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
      sourceOverride?: string;
    }) =>
      invoke<TokenAnalytics>("get_token_analytics", {
        granularity: params.granularity,
        dateStart: params.dateStart ?? null,
        dateEnd: params.dateEnd ?? null,
        filterAgent: params.filterAgent ?? null,
        filterModel: params.filterModel ?? null,
        sourceOverride: params.sourceOverride ?? null,
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
    getDayModelBreakdown: (date: string, sourceOverride?: string) =>
      invoke<ModelBreakdown[]>("get_day_model_breakdown", {
        date,
        sourceOverride: sourceOverride ?? null,
      }),
    getDayHourly: (date: string, sourceOverride?: string) =>
      invoke<import("$lib/types").DayHourlyBucket[]>("get_day_hourly", {
        date,
        sourceOverride: sourceOverride ?? null,
      }),
    getDayProjectBreakdown: (date: string, sourceOverride?: string) =>
      invoke<import("$lib/types").DayProjectBreakdown[]>("get_day_project_breakdown", {
        date,
        sourceOverride: sourceOverride ?? null,
      }),
    getDayTopSessions: (date: string, limit: number, sourceOverride?: string) =>
      invoke<import("$lib/types").DaySessionBreakdown[]>("get_day_top_sessions", {
        date,
        limit,
        sourceOverride: sourceOverride ?? null,
      }),
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
