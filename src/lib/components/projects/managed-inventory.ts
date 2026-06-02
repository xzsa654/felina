import type {
  AgentId,
  ImportCandidate,
  SkillListEntry,
  SkillScope,
  SkillTarget,
  TargetMode,
} from "$lib/types";
import { skillListEntryCanonicalId } from "$lib/types";
import { normalizeProjectPath } from "$lib/utils/path";

export type InventoryRelationship =
  | "managedProject"
  | "canonicalGlobalOnly"
  | "canonicalExistsUnlinked"
  | "localOnly";

export interface InventorySourceAttribution {
  agent: AgentId;
  sourceIndex: number;
  candidate: ImportCandidate;
}

export interface InventorySourceGroup {
  sourcePath: string;
  agents: AgentId[];
  attributions: InventorySourceAttribution[];
  primaryCandidate: ImportCandidate;
}

export interface InventoryTargetSummary {
  agent: AgentId;
  scope: SkillScope;
  project?: string;
  enabled: boolean;
  mode: TargetMode;
}

export type ResolutionOption = "link" | "overwrite" | "rename" | "discard";

export interface InventoryRow {
  skillName: string;
  managed: boolean;
  relationship: InventoryRelationship;
  canonicalExists: boolean;
  canonicalId: string | null;
  canonicalEntry: SkillListEntry | null;
  detectedSources: InventorySourceGroup[];
  felinaTargets: InventoryTargetSummary[];
  agentsPresent: Set<AgentId>;
  candidate: ImportCandidate | null;
  deferred: boolean;
}

function isTargetAvailable(tgt: SkillTarget): boolean {
  return tgt.enabled && tgt.mode !== "detached" && tgt.mode !== "forked";
}

function isSelectedProjectTarget(tgt: SkillTarget, selectedProject: string): boolean {
  return (
    tgt.scope === "project" &&
    normalizeProjectPath(tgt.project ?? "") === selectedProject
  );
}

function isRelevantTarget(tgt: SkillTarget, selectedProject: string): boolean {
  if (!isTargetAvailable(tgt)) return false;
  return tgt.scope === "global" || isSelectedProjectTarget(tgt, selectedProject);
}

function targetSummary(tgt: SkillTarget): InventoryTargetSummary {
  return {
    agent: tgt.agent,
    scope: tgt.scope,
    project: tgt.project,
    enabled: tgt.enabled,
    mode: tgt.mode,
  };
}

function sourceEntries(candidate: ImportCandidate): InventorySourceAttribution[] {
  if (!candidate.deferred) {
    return [{ agent: candidate.sourceAgent, sourceIndex: 0, candidate }];
  }
  return candidate.deferred.candidates.map((source, sourceIndex) => ({
    agent: source.sourceAgent,
    sourceIndex,
    candidate: source,
  }));
}

export function groupSourcesByPath(candidate: ImportCandidate | null): InventorySourceGroup[] {
  if (!candidate) return [];

  const groups = new Map<string, InventorySourceGroup>();
  for (const attribution of sourceEntries(candidate)) {
    const source = attribution.candidate;
    const key = normalizeProjectPath(source.sourcePath);
    const existing = groups.get(key);
    if (existing) {
      existing.attributions.push(attribution);
      if (!existing.agents.includes(attribution.agent)) {
        existing.agents.push(attribution.agent);
      }
      continue;
    }
    groups.set(key, {
      sourcePath: source.sourcePath.replace(/\\/g, "/"),
      agents: [attribution.agent],
      attributions: [attribution],
      primaryCandidate: source,
    });
  }

  return [...groups.values()];
}

function relationshipFor(
  canonicalExists: boolean,
  managed: boolean,
  felinaTargets: InventoryTargetSummary[],
): InventoryRelationship {
  if (!canonicalExists) return "localOnly";
  if (managed) return "managedProject";
  if (felinaTargets.some((tgt) => tgt.scope === "global")) {
    return "canonicalGlobalOnly";
  }
  return "canonicalExistsUnlinked";
}

function actionRank(row: InventoryRow): number {
  if (row.relationship === "managedProject") return 0;
  if (
    row.relationship === "canonicalGlobalOnly" ||
    row.relationship === "canonicalExistsUnlinked"
  ) {
    return 1;
  }
  if (!row.deferred) return 2;
  return 3;
}

export function compareRows(a: InventoryRow, b: InventoryRow): number {
  const actA = actionRank(a);
  const actB = actionRank(b);
  if (actA !== actB) return actA - actB;
  return a.skillName.localeCompare(b.skillName);
}

/**
 * Resolution options for the "處理同名 dialog", derived from the row's
 * relationship. `canonicalGlobalOnly` rows have a safe global fallback so
 * Discard is offered; `canonicalExistsUnlinked` rows have no fallback, so
 * Discard is omitted to avoid a destructive footgun. Other relationships
 * (managed / localOnly) have no same-name resolution path.
 */
export function resolutionOptionsFor(row: InventoryRow): ResolutionOption[] {
  switch (row.relationship) {
    case "canonicalGlobalOnly":
      return ["link", "overwrite", "rename", "discard"];
    case "canonicalExistsUnlinked":
      return ["link", "overwrite", "rename"];
    default:
      return [];
  }
}

export function buildInventoryRows(
  projectPath: string,
  scan: ImportCandidate[],
  canonical: SkillListEntry[],
): InventoryRow[] {
  const selectedProject = normalizeProjectPath(projectPath);

  const canonicalById = new Map<string, SkillListEntry>();
  const canonicalByName = new Map<string, SkillListEntry>();
  for (const entry of canonical) {
    const id = skillListEntryCanonicalId(entry);
    canonicalById.set(id, entry);
    canonicalByName.set(entry.kind === "ok" ? entry.skill.name : entry.name, entry);
  }

  const managedIds = new Set<string>();
  const relevantTargetsById = new Map<string, InventoryTargetSummary[]>();
  for (const entry of canonical) {
    if (entry.kind !== "ok") continue;
    const id = skillListEntryCanonicalId(entry);
    const relevantTargets: InventoryTargetSummary[] = [];

    for (const target of entry.skill.targets) {
      if (isSelectedProjectTarget(target, selectedProject) && isTargetAvailable(target)) {
        managedIds.add(id);
      }
      if (isRelevantTarget(target, selectedProject)) {
        relevantTargets.push(targetSummary(target));
      }
    }

    relevantTargetsById.set(id, relevantTargets);
  }

  const candidatesByName = new Map<string, ImportCandidate>();
  for (const candidate of scan) {
    candidatesByName.set(candidate.skillName, candidate);
  }

  const rowMap = new Map<string, InventoryRow>();
  for (const skillName of candidatesByName.keys()) {
    const candidate = candidatesByName.get(skillName) ?? null;
    const matchedEntry = canonicalById.get(skillName) ?? canonicalByName.get(skillName) ?? null;
    const canonicalId = matchedEntry ? skillListEntryCanonicalId(matchedEntry) : null;
    const detectedSources = groupSourcesByPath(candidate);
    const felinaTargets = canonicalId ? (relevantTargetsById.get(canonicalId) ?? []) : [];
    const managed = canonicalId !== null && managedIds.has(canonicalId);
    const detectedAgents = new Set<AgentId>();

    for (const source of detectedSources) {
      for (const agent of source.agents) detectedAgents.add(agent);
    }

    rowMap.set(skillName, {
      skillName,
      managed,
      relationship: relationshipFor(canonicalId !== null, managed, felinaTargets),
      canonicalExists: canonicalId !== null,
      canonicalId,
      canonicalEntry: matchedEntry,
      detectedSources,
      felinaTargets,
      agentsPresent: detectedAgents,
      candidate,
      deferred: candidate?.deferred != null,
    });
  }

  for (const canonicalId of managedIds) {
    const entry = canonicalById.get(canonicalId);
    if (!entry || entry.kind !== "ok") continue;
    const skillName = entry.skill.name;
    if (rowMap.has(skillName)) continue;

    const felinaTargets = relevantTargetsById.get(canonicalId) ?? [];
    const targetAgents = new Set<AgentId>();
    for (const target of felinaTargets) targetAgents.add(target.agent);

    rowMap.set(skillName, {
      skillName,
      managed: true,
      relationship: "managedProject",
      canonicalExists: true,
      canonicalId,
      canonicalEntry: entry,
      detectedSources: [],
      felinaTargets,
      agentsPresent: targetAgents,
      candidate: null,
      deferred: false,
    });
  }

  const rows = [...rowMap.values()];
  rows.sort(compareRows);
  return rows;
}
