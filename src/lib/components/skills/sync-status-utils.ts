import type { KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import { isProjectMissing } from "$lib/utils/path";

export type SyncStatus = "synced" | "pending" | "missing";

export function targetKey(tgt: SkillTarget): string {
  return tgt.scope === "global"
    ? `${tgt.agent}:global`
    : `${tgt.agent}:project:${tgt.project ?? ""}`;
}

export function classifyTarget(
  tgt: SkillTarget,
  entry: LastSyncEntry | undefined,
  knownProjects: KnownProject[],
): SyncStatus {
  if (tgt.scope === "project" && isProjectMissing(knownProjects, tgt.project ?? "")) {
    return "missing";
  }
  return entry ? "synced" : "pending";
}

export const STATUS_ORDER: SyncStatus[] = ["synced", "pending", "missing"];

export const STATUS_CONFIG: Record<SyncStatus, { icon: string; chipClass: string }> = {
  synced: { icon: "✓", chipClass: "text-success border-success/30 bg-success/5" },
  pending: { icon: "●", chipClass: "text-warning border-warning/30 bg-warning/5" },
  missing: { icon: "!", chipClass: "text-danger border-danger/30 bg-danger/5" },
};
