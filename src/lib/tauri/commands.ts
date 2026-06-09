import { invoke } from "@tauri-apps/api/core";
import type {
  StatsCache,
  ProjectInfo,
  MemoryFile,
  InstructionFile,
  SkillInfo,
  RuleFile,
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
  RenameResult,
  SkillFieldDefinition,
  SkillFileNode,
  AgentId,
  SkillScope,
  CanonicalDeletePolicy,
  CanonicalSkillDeleteResult,
  SkillSyncAllCommitRequest,
  SkillSyncAllPreview,
  SkillSyncCommitRequest,
  SkillSyncPreview,
  SkillTargetRemovalResult,
  SkillTargetRepointResult,
  TargetRemovalPolicy,
  DriftStatus,
  PullDiffPreview,
  SiblingResolution,
  ForkAgentContent,
  ForkDiffPreview,
} from "$lib/types";
import type {
  AgentId as TokenAgentId,
  SessionTranscript,
  SessionTranscriptLocation,
  HistorySessionsPage,
} from "$lib/types/token-analytics";

// Retained-for-reference wrappers (instructions / rules / budget / stats):
// backend modules + frontend pages are kept on disk but unregistered from invoke_handler.
// Calling these at runtime will fail until the corresponding command is re-registered.
export const api = {
  stats: {
    get: () => invoke<StatsCache>("get_stats"),
    computeLive: () => invoke<StatsCache>("compute_live_stats"),
  },

  projects: {
    list: () => invoke<ProjectInfo[]>("list_projects"),
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

  // Multi-agent canonical skills. Canonical master files live exclusively
  // under `~/.felina/skills/` after `scope-model-simplification`; these
  // wrappers no longer take a scope/project pair.
  canonicalSkills: {
    list: () => invoke<SkillListEntry[]>("canonical_skills_list"),
    read: (name: string) => invoke<CanonicalSkill>("canonical_skills_read", { name }),
    readRaw: (name: string) => invoke<string>("canonical_skills_read_raw", { name }),
    write: (
      name: string,
      frontmatter: Record<string, unknown>,
      body: string,
      agentFields?: Record<string, unknown>,
    ) =>
      invoke<void>("canonical_skills_write", {
        name,
        frontmatter,
        body,
        agentFields,
      }),
    writeRaw: (name: string, content: string) =>
      invoke<{ normalizedFrom: string | null }>("canonical_skills_write_raw", { name, content }),
    delete: (name: string) => invoke<void>("canonical_skills_delete", { name }),
    deleteWithPolicy: (name: string, policy: CanonicalDeletePolicy) =>
      invoke<CanonicalSkillDeleteResult>("canonical_skills_delete_with_policy", { name, policy }),
    rename: (oldName: string, newName: string) =>
      invoke<RenameResult>("canonical_skill_rename", { oldName, newName }),
    getDirectoryTree: (canonicalId: string) =>
      invoke<SkillFileNode[]>("get_skill_directory_tree", { canonicalId }),
  },

  // Fan-out sync (canonical → agent-native dirs). Push destinations come
  // from each skill's `SkillTarget` list — no caller-supplied scope needed.
  skillSync: {
    one: (name: string) => invoke<SyncResult[]>("skill_sync_one", { name }),
    all: () => invoke<SyncResult[]>("skill_sync_all"),
    preview: (name: string) => invoke<SkillSyncPreview>("skill_sync_preview", { name }),
    previewAll: () => invoke<SkillSyncAllPreview>("skill_sync_all_preview"),
    commit: (request: SkillSyncCommitRequest) =>
      invoke<SyncResult[]>("skill_sync_commit", { request }),
    commitAll: (request: SkillSyncAllCommitRequest) =>
      invoke<SyncResult[]>("skill_sync_all_commit", { request }),
    resolveTargetDir: (
      skillName: string,
      agent: AgentId,
      scope: SkillScope,
      project: string | null,
    ) =>
      invoke<{ path: string; exists: boolean }>("skill_target_dir_resolve", {
        skillName,
        agent,
        scope,
        project,
      }),
  },

  driftScan: {
    scan: () =>
      invoke<Record<string, Record<string, DriftStatus>>>("skill_drift_scan"),
  },

  skillPull: {
    fromTarget: (canonicalId: string, targetKey: string, siblingResolutions?: SiblingResolution[]) =>
      invoke<void>("skill_pull_from_target", { canonicalId, targetKey, siblingResolutions: siblingResolutions ?? null }),
    preview: (canonicalId: string, targetKey: string) =>
      invoke<PullDiffPreview>("skill_pull_preview", { canonicalId, targetKey }),
  },

  skillFork: {
    readAgentContent: (canonicalId: string, targetKey: string) =>
      invoke<ForkAgentContent>("skill_fork_read_agent_content", { canonicalId, targetKey }),
    diffPreview: (canonicalId: string, targetKey: string) =>
      invoke<ForkDiffPreview>("skill_fork_diff_preview", { canonicalId, targetKey }),
  },

  // Skill field catalog.
  skillFields: {
    list: () => invoke<SkillFieldDefinition[]>("list_skill_field_catalog"),
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
    scanZip: (zipPath: string) =>
      invoke<ImportCandidate[]>("skill_import_scan_zip", { zipPath }),
    apply: (selections: ImportSelection[], projectPath?: string) =>
      invoke<void>("skill_import_apply", { projectPath, selections }),
  },

  // Project-local skill ops: rename / delete the project-side copy of a
  // same-name skill without touching canonical or sync-meta.
  projectLocalSkills: {
    rename: (
      projectPath: string,
      agent: AgentId,
      oldName: string,
      newName: string,
    ) =>
      invoke<void>("project_local_skill_rename", {
        projectPath,
        agent,
        oldName,
        newName,
      }),
    delete: (projectPath: string, agent: AgentId, skillName: string) =>
      invoke<void>("project_local_skill_delete", {
        projectPath,
        agent,
        skillName,
      }),
  },

  // Known Projects.
  knownProjects: {
    list: (currentProject?: string) =>
      invoke<KnownProject[]>("known_projects_list", { currentProject }),
    savedList: () =>
      invoke<KnownProject[]>("known_projects_saved_list"),
    add: (path: string) =>
      invoke<void>("known_projects_add", { path }),
    remove: (path: string) =>
      invoke<void>("known_projects_remove", { path }),
  },


  // Per-skill target editor. Canonical lives in the single global dir;
  // `SkillTarget.scope` decides each push destination.
  skillTargets: {
    set: (skillName: string, targets: SkillTarget[]) =>
      invoke<void>("skill_targets_set", { skillName, targets }),
    remove: (skillName: string, target: SkillTarget, policy: TargetRemovalPolicy) =>
      invoke<SkillTargetRemovalResult>("skill_target_remove_with_policy", {
        skillName,
        target,
        policy,
      }),
    repoint: (skillName: string, target: SkillTarget, newProject: string) =>
      invoke<SkillTargetRepointResult>("skill_target_repoint", {
        skillName,
        target,
        newProject,
      }),
    readContent: (skillName: string, targetKey: string) =>
      invoke<string>("skill_target_read_content", { skillName, targetKey }),
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
    set: (
      dailyLimit: number | null,
      monthlyLimit: number | null,
      planType?: string,
      quotaTtlSeconds?: number,
    ) =>
      invoke<void>("set_budget", { dailyLimit, monthlyLimit, planType, quotaTtlSeconds }),
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
    getCacheEfficiency: (dateStart?: number, dateEnd?: number, sourceOverride?: string) =>
      invoke<CacheEfficiency>("get_cache_efficiency", {
        dateStart: dateStart ?? null,
        dateEnd: dateEnd ?? null,
        sourceOverride: sourceOverride ?? null,
      }),
    getAvailableAgents: () =>
      invoke<AgentStatus[]>("get_available_agents"),
    getAnalyticsPair: (params: {
      dateStart?: number;
      dateEnd?: number;
      monthlySource?: string;
      dailySource?: string;
    }) =>
      invoke<{ monthly: TokenAnalytics; daily: TokenAnalytics }>("get_token_analytics_pair", {
        dateStart: params.dateStart ?? null,
        dateEnd: params.dateEnd ?? null,
        monthlySource: params.monthlySource ?? null,
        dailySource: params.dailySource ?? null,
      }),
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
    listHistorySessions: (params?: {
      limit?: number;
      offset?: number;
      agentFilter?: "all" | TokenAgentId;
      query?: string;
    }) =>
      invoke<HistorySessionsPage>("list_history_sessions", {
        limit: params?.limit ?? null,
        offset: params?.offset ?? null,
        agentFilter: params?.agentFilter ?? null,
        query: params?.query ?? null,
      }),
    readSessionTranscript: (agent: TokenAgentId, sessionId: string) =>
      invoke<SessionTranscript>("read_session_transcript", {
        agent,
        sessionId,
      }),
    resolveSessionTranscript: (agent: TokenAgentId, sessionId: string) =>
      invoke<SessionTranscriptLocation>("resolve_session_transcript", {
        agent,
        sessionId,
      }),
    revealSessionTranscript: (agent: TokenAgentId, sessionId: string) =>
      invoke<SessionTranscriptLocation>("reveal_session_transcript", {
        agent,
        sessionId,
      }),
    refresh: () => invoke<RefreshResult>("refresh_token_data"),
    pruneTokenEvents: (retentionDays: number) =>
      invoke<number>("prune_token_events", {
        retentionDays,
      }),
    deleteAllTokenEvents: () => invoke<number>("delete_all_token_events"),
    getAgentQuotaSnapshot: () =>
      invoke<import("$lib/types").QuotaSnapshot>("get_agent_quota_snapshot"),
  },

  skillLibrary: {
    export: (outputPath: string) =>
      invoke<void>("skill_library_export", { outputPath }),
    reset: () => invoke<SkillLibraryResetResult>("skill_library_reset"),
  },

  market: {
    installSkill: (name: string) =>
      invoke<string>("install_market_skill", { name }),
    publishSkill: (name: string) =>
      invoke<void>("publish_canonical_skill", { name }),
    deleteSkill: (name: string) =>
      invoke<void>("delete_market_skill", { name }),
    getSkillDirectoryHash: (name: string) =>
      invoke<string | null>("get_skill_directory_hash", { name }),
    uninstallSkill: (name: string) =>
      invoke<void>("uninstall_skill", { name }),
    getServerUrl: () => invoke<string>("get_market_server_url"),
    setServerUrl: (url: string) =>
      invoke<void>("set_market_server_url", { url }),
    register: (email: string, password: string) =>
      invoke<{ accessToken: string; refreshToken: string; email: string }>("register_hub_account", { email, password }),
    login: (email: string, password: string, rememberMe: boolean) =>
      invoke<{ accessToken: string; refreshToken: string; email: string }>("login_hub_account", { email, password, rememberMe }),
    getAuthStatus: () =>
      invoke<{ email: string } | null>("get_hub_auth_status"),
    logout: () => invoke<void>("logout_hub_account"),
    getAccessToken: () => invoke<string | null>("read_hub_access_token"),
  },
} as const;

export interface SkillLibraryResetResult {
  deleted: number;
}

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
  quota_ttl_seconds: number;
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
