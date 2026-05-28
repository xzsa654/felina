/**
 * Canonical types for the multi-agent skills foundation.
 *
 * Naming: TypeScript surface is camelCase; the Rust backend serializes its
 * snake_case fields via serde rename_all. See design.md "Implementation
 * Contract" for the wire types.
 *
 * `SkillInfo` is kept as a deprecation alias while SkillsPage / commands.ts
 * are still pre-canonical (cleaned up in tasks 5.3 + 6.6).
 */

/** @deprecated Pre-canonical shape. Removed once tasks 5.3 / 6.6 land. */
export interface SkillInfo {
  name: string;
  path: string;
  scope: string;
  content: string;
}

export type AgentId = "anthropic" | "codex" | "gemini";

/**
 * Push-destination discriminator for a {@link SkillTarget}.
 *
 * Only valid as `SkillTarget.scope`. Canonical master files live exclusively
 * under `~/.felina/skills/` after `scope-model-simplification`; `"project"`
 * here means "push destination is a particular project's agent directory",
 * not a canonical-storage location.
 */
export type SkillScope = "global" | "project";

export interface CanonicalSkill {
  /** Stable canonical directory identity used for app actions. */
  canonicalId: string;
  /** Skill name. Required canonical field. Filesystem directory segment. */
  name: string;
  /** One-line description. Required canonical field. */
  description: string;
  /** Subset of supported agent ids; controls fan-out targets. */
  agents: AgentId[];
  /**
   * All optional frontmatter fields preserved verbatim (YAML passthrough).
   * Per-agent renderers filter / rename out of this when emitting.
   */
  frontmatterExtras: Record<string, unknown>;
  /** Markdown body, raw passthrough — never reparsed. */
  body: string;
  /** True when canonical content has changed since the last successful push. */
  dirty: boolean;
  /** ISO-8601 timestamp of the last successful push, if any (display only;
   *  derived from sync-meta v1 legacy field or the newest `lastSync[*].at`). */
  lastSynced: string | null;
  /** Per-skill target list (sync-meta v2). Empty for new skills before
   *  the first push or for v1 sidecars that haven't been upgraded yet. */
  targets: SkillTarget[];
  /** Per-target push provenance (sync-meta v2). Keyed by stable per-target id. */
  lastSync: Record<string, LastSyncEntry>;
  /** Agent-scoped optional fields (`x_felina_agent_fields` in YAML). */
  agentFields: Record<string, unknown>;
}

/**
 * A single row in the Skills page list. Either a successfully-parsed
 * canonical skill, or a broken-frontmatter placeholder so the list can
 * render the bad skill without crashing.
 *
 * Wire format: serde-tagged with `kind` = `"ok" | "broken"`.
 */
export type SkillListEntry =
  | { kind: "ok"; canonicalId: string; skill: CanonicalSkill }
  | { kind: "broken"; canonicalId: string; name: string; path: string; error: string };

export function canonicalSkillId(skill: CanonicalSkill): string {
  return skill.canonicalId || skill.name;
}

export function skillListEntryCanonicalId(entry: SkillListEntry): string {
  return entry.canonicalId || (entry.kind === "ok" ? canonicalSkillId(entry.skill) : entry.name);
}

export interface SyncResult {
  agent: AgentId;
  scope: SkillScope;
  /** Absolute path the renderer wrote to (or attempted to write to). */
  targetPath: string;
  success: boolean;
  /** Error message when success === false; null otherwise. */
  error: string | null;
  /** ISO-8601 UTC timestamp of the push attempt (success or failure). */
  at: string;
}

export type SkillSyncPreviewOperation =
  | "create"
  | "overwrite"
  | "noOp"
  | "skipped"
  | "blockedDrift"
  | "overwriteUnknown";

export type SkillSyncDriftResolution = "override" | "detach" | "cancel";

export interface SkillSyncPreviewItem {
  skillName: string;
  targetKey: string;
  agent: AgentId;
  scope: SkillScope;
  project?: string | null;
  targetDir: string;
  skillDir: string;
  skillMdPath: string;
  operation: SkillSyncPreviewOperation;
  currentHash?: string | null;
  renderedHash?: string | null;
  lastSyncHash?: string | null;
  error?: string | null;
}

export interface SkillSyncPreviewSummary {
  create: number;
  overwrite: number;
  noOp: number;
  skipped: number;
  blockedDrift: number;
  overwriteUnknown: number;
}

export interface SkillSyncPreview {
  skillName: string;
  items: SkillSyncPreviewItem[];
  summary: SkillSyncPreviewSummary;
}

export interface SkillSyncAllPreview {
  skills: SkillSyncPreview[];
  summary: SkillSyncPreviewSummary;
}

export interface SkillSyncResolution {
  targetKey: string;
  resolution: SkillSyncDriftResolution;
}

export interface SkillSyncCommitRequest {
  skillName: string;
  resolutions: SkillSyncResolution[];
}

export interface SkillSyncAllCommitRequest {
  resolutionsBySkill: Record<string, SkillSyncResolution[]>;
}

export type CanonicalDeletePolicy = "cascade" | "detach" | "cancel";

export interface DeletePathResult {
  path: string;
  success: boolean;
  error?: string | null;
}

export interface CanonicalSkillDeleteResult {
  policy: CanonicalDeletePolicy;
  canonicalPath: string;
  canonicalDeleted: boolean;
  targetResults: DeletePathResult[];
}

export type TargetRemovalPolicy = "removeTargetOnly" | "removeTargetAndDeleteFile" | "cancel";

export interface SkillTargetRemovalResult {
  policy: TargetRemovalPolicy;
  targetKey: string;
  targetRemoved: boolean;
  deleteResult?: DeletePathResult | null;
}

export interface SkillTargetRepointResult {
  oldTargetKey: string;
  newTargetKey: string;
  target: SkillTarget;
  dirty: boolean;
}

export interface ConflictInfo {
  /** Canonical SKILL.md that already exists. */
  canonicalPath: string;
  /** Short preview of the canonical body for diff display. */
  canonicalBodyPreview: string;
  /** Human-readable diff summary (line counts, hash mismatch, etc.). */
  diffSummary: string;
}

export interface DeferredMultiSource {
  /** Distinct agents whose folders contained this skill name. */
  agents: AgentId[];
  /** Full per-source candidates for this grouped skill name. */
  candidates: ImportCandidate[];
  /** Human-readable note for the wizard row. */
  reason: string;
}

export interface ImportCandidate {
  /** Absolute path to the agent-native SKILL.md we'd import from. */
  sourcePath: string;
  sourceAgent: AgentId;
  /** Proposed canonical skill name (derived from source dir name). */
  skillName: string;
  /** Short preview of source body for the wizard. */
  bodyPreview: string;
  /** Populated iff skillName collides with an existing canonical skill. */
  conflict: ConflictInfo | null;
  /**
   * Set when the same skill name was found in 2+ agent folders. Such skills
   * are not importable in this version (greyed out in the wizard); the
   * upcoming target-control change handles multi-source resolution.
   */
  deferred: DeferredMultiSource | null;
  /**
   * Set when the source file has malformed frontmatter. Blocked candidates
   * cannot be imported — the wizard shows the error and disables selection.
   */
  validationError?: string | null;
}

export type ImportResolution =
  | { kind: "overwriteCanonical" }
  | { kind: "skip" }
  | { kind: "rename"; newName: string }
  | { kind: "selectSource"; sourceIndex: number; newName?: string };

export interface ImportSelection {
  candidate: ImportCandidate;
  resolution: ImportResolution;
}

export interface AgentPathPair {
  /** Absolute or `~`-anchored path for the global agent skills dir. */
  global: string;
  /** Project-root-relative path (e.g. ".claude/skills"). */
  projectRelative: string;
}

export interface AgentPathsConfig {
  anthropic: AgentPathPair;
  codex: AgentPathPair;
  gemini: AgentPathPair;
}

export type TargetMode = "tracked" | "detached" | "forked";

export interface SkillTarget {
  agent: AgentId;
  scope: SkillScope;
  /** Required when scope === "project"; absolute project root path. */
  project?: string;
  enabled: boolean;
  mode: TargetMode;
}

export interface LastSyncEntry {
  /** SHA-256 hex of the rendered SKILL.md content at last successful push. */
  pushedHash: string;
  /** Reserved for Phase 2 fork resolution; unset in this capability. */
  baseSnapshot?: string;
  /** ISO-8601 timestamp of the last successful push for this target. */
  at: string;
}

export interface SyncMetaV2 {
  version: 2;
  targets: SkillTarget[];
  /** Keyed by stable per-target identifier (see Rust target_key helper). */
  lastSync: Record<string, LastSyncEntry>;
  dirty: boolean;
}

export type ProjectSource = "cwd" | "detected" | "saved";

export interface KnownProject {
  path: string;
  /** Whether the project directory currently exists on disk (filesystem stat
   *  performed by `known_projects_list`). Drives the "project not found"
   *  degradation indicator — list membership alone can't detect an L3 saved
   *  entry whose folder was renamed/deleted. */
  exists: boolean;
  sources: ProjectSource[];
}

export interface OrphanFile {
  path: string;
  agent: AgentId;
  scope: SkillScope;
  /** Originating project path when `scope === "project"`; absent for global. */
  project?: string;
}

// ── Skill field catalog ──────────────────────────────────────────

export type OutputLocation = "skillFrontmatter" | "codexOpenaiYaml";
export type ValueKind = "string" | "boolean" | "enum" | "stringList" | "object" | "objectArray";
export type FieldAgent = "anthropic" | "codex" | "gemini" | "standard";

export interface SkillFieldDefinition {
  agent: FieldAgent;
  canonicalPath: string;
  outputLocation: OutputLocation;
  outputKey: string;
  valueKind: ValueKind;
  enumValues?: string[];
  sourceUrl: string;
  verifiedDate: string;
  labelKey: string;
  helpKey: string;
}
