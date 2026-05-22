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

export type SkillScope = "global" | "project";

export interface CanonicalSkill {
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
  /** ISO-8601 timestamp of the last successful push, if any. */
  lastSynced: string | null;
}

/**
 * A single row in the Skills page list. Either a successfully-parsed
 * canonical skill, or a broken-frontmatter placeholder so the list can
 * render the bad skill without crashing.
 *
 * Wire format: serde-tagged with `kind` = `"ok" | "broken"`.
 */
export type SkillListEntry =
  | { kind: "ok"; skill: CanonicalSkill }
  | { kind: "broken"; name: string; path: string; error: string };

export interface SyncResult {
  agent: AgentId;
  scope: SkillScope;
  /** Absolute path the renderer wrote to (or attempted to write to). */
  targetPath: string;
  success: boolean;
  /** Error message when success === false; null otherwise. */
  error: string | null;
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
}

export type ImportResolution =
  | { kind: "keepCanonical" }
  | { kind: "overwriteCanonical" }
  | { kind: "skip" }
  | { kind: "rename"; newName: string };

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
