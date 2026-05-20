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

  skills: {
    list: (scope: string, projectPath?: string) =>
      invoke<SkillInfo[]>("list_skills", { scope, projectPath }),
    write: (scope: string, name: string, content: string, projectPath?: string) =>
      invoke<void>("write_skill", { scope, projectPath, name, content }),
    delete: (scope: string, name: string, projectPath?: string) =>
      invoke<void>("delete_skill", { scope, projectPath, name }),
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
