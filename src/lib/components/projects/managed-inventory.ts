import type {
  AgentId,
  ImportCandidate,
  SkillListEntry,
  SkillTarget,
} from "$lib/types";
import { skillListEntryCanonicalId } from "$lib/types";
import { normalizeProjectPath } from "$lib/utils/path";

export interface InventoryRow {
  skillName: string;
  managed: boolean;
  canonicalExists: boolean;
  canonicalId: string | null;
  agentsPresent: Set<AgentId>;
  candidate: ImportCandidate | null;
  deferred: boolean;
}

function candidateAgents(c: ImportCandidate): AgentId[] {
  return c.deferred ? c.deferred.agents : [c.sourceAgent];
}

function isTargetAvailable(tgt: SkillTarget): boolean {
  return tgt.enabled && (tgt.mode === "manual" || tgt.mode === "auto");
}

function actionRank(r: InventoryRow): number {
  if (r.managed) return 0;
  if (r.canonicalExists) return 1;
  if (!r.deferred) return 2;
  return 3;
}

export function compareRows(a: InventoryRow, b: InventoryRow): number {
  const statusA = a.managed ? 0 : 1;
  const statusB = b.managed ? 0 : 1;
  if (statusA !== statusB) return statusA - statusB;
  const actA = actionRank(a);
  const actB = actionRank(b);
  if (actA !== actB) return actA - actB;
  return a.skillName.localeCompare(b.skillName);
}

export function buildInventoryRows(
  projectPath: string,
  scan: ImportCandidate[],
  canonical: SkillListEntry[],
): InventoryRow[] {
  const want = normalizeProjectPath(projectPath);

  // Index canonical entries by directory identity (canonicalId).
  const canonicalById = new Map<string, SkillListEntry>();
  for (const e of canonical) {
    const id = skillListEntryCanonicalId(e);
    canonicalById.set(id, e);
  }

  // Managed names: canonical with a project target pointing at selected project.
  // Also build a map from canonicalId → set of available agent ids from targets.
  const managedIds = new Set<string>();
  const canonicalAgentsById = new Map<string, Set<AgentId>>();

  for (const e of canonical) {
    if (e.kind !== "ok") continue;
    const id = skillListEntryCanonicalId(e);
    const agentSet = new Set<AgentId>();
    for (const tgt of e.skill.targets) {
      if (!isTargetAvailable(tgt)) continue;
      if (
        tgt.scope === "project" &&
        normalizeProjectPath(tgt.project ?? "") === want
      ) {
        managedIds.add(id);
      }
      agentSet.add(tgt.agent);
    }
    canonicalAgentsById.set(id, agentSet);
  }

  // Per-scan: project-local presence + candidate.
  const localPresence = new Map<string, Set<AgentId>>();
  const candMap = new Map<string, ImportCandidate>();
  for (const c of scan) {
    candMap.set(c.skillName, c);
    const set = localPresence.get(c.skillName) ?? new Set<AgentId>();
    for (const a of candidateAgents(c)) set.add(a);
    localPresence.set(c.skillName, set);
  }

  // Union of scan names ∪ managed canonical names (by skill name).
  // For each name, find same-named canonical by matching canonicalId to skillName.
  const rowMap = new Map<string, InventoryRow>();

  // Add scan-sourced rows.
  for (const skillName of localPresence.keys()) {
    const cand = candMap.get(skillName) ?? null;
    const matchedEntry = canonicalById.get(skillName);
    const matchedId = matchedEntry
      ? skillListEntryCanonicalId(matchedEntry)
      : null;
    const agents = new Set(localPresence.get(skillName)!);

    // Merge canonical target agents for same-named canonical.
    if (matchedId) {
      const canonAgents = canonicalAgentsById.get(matchedId);
      if (canonAgents) {
        for (const a of canonAgents) agents.add(a);
      }
    }

    rowMap.set(skillName, {
      skillName,
      managed: matchedId !== null && managedIds.has(matchedId),
      canonicalExists: matchedId !== null,
      canonicalId: matchedId,
      agentsPresent: agents,
      candidate: cand,
      deferred: cand?.deferred != null,
    });
  }

  // Add managed-only rows (canonical targets this project but no local scan match).
  for (const id of managedIds) {
    const entry = canonicalById.get(id);
    if (!entry || entry.kind !== "ok") continue;
    const skillName = entry.skill.name;
    if (rowMap.has(skillName)) continue;

    const agents = new Set<AgentId>();
    const canonAgents = canonicalAgentsById.get(id);
    if (canonAgents) {
      for (const a of canonAgents) agents.add(a);
    }

    rowMap.set(skillName, {
      skillName,
      managed: true,
      canonicalExists: true,
      canonicalId: id,
      agentsPresent: agents,
      candidate: null,
      deferred: false,
    });
  }

  const rows = [...rowMap.values()];
  rows.sort(compareRows);
  return rows;
}
