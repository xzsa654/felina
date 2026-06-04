import type { KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import { isProjectMissing } from "$lib/utils/path";

export type SyncStatus = "synced" | "pending" | "missing";

export function targetKey(tgt: SkillTarget): string {
  return tgt.scope === "global"
    ? `${tgt.agent}:global`
    : `${tgt.agent}:project:${tgt.project ?? ""}`;
}

/**
 * Single source of truth for "is this target switched off". A target is
 * disabled either via the `enabled` flag or the legacy `detached` mode; both
 * mean "skipped by push, kept in the list for visibility / re-enable".
 *
 * This is an axis ORTHOGONAL to sync freshness (see {@link classifyTarget}):
 * a disabled target may still have been synced before. Keep the two separate —
 * do not fold disabled into {@link SyncStatus}.
 */
export function isTargetDisabled(tgt: SkillTarget): boolean {
  return !tgt.enabled || tgt.mode === "detached";
}

export function isCascadeEligible(tgt: SkillTarget): boolean {
  return tgt.enabled && (tgt.mode === "auto" || tgt.mode === "manual" || tgt.mode === "tracked");
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
