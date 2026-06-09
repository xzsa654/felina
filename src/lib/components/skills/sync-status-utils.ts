import type { ForkStatus, KnownProject, SkillTarget } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import { isProjectMissing } from "$lib/utils/path";

export type SyncStatus =
  | "synced"
  | "pending"
  | "missing"
  | "forked-clean"
  | "forked-edited"
  | "forked-ahead"
  | "forked-diverged";

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

const FORK_STATUS_MAP: Record<ForkStatus, SyncStatus> = {
  clean: "forked-clean",
  edited: "forked-edited",
  canonicalAhead: "forked-ahead",
  diverged: "forked-diverged",
};

export function classifyTarget(
  tgt: SkillTarget,
  entry: LastSyncEntry | undefined,
  knownProjects: KnownProject[],
  forkStatus?: ForkStatus,
): SyncStatus {
  if (tgt.mode === "forked") {
    return forkStatus ? FORK_STATUS_MAP[forkStatus] : "forked-clean";
  }
  if (tgt.scope === "project" && isProjectMissing(knownProjects, tgt.project ?? "")) {
    return "missing";
  }
  return entry ? "synced" : "pending";
}

export const STATUS_ORDER: SyncStatus[] = [
  "synced",
  "pending",
  "missing",
  "forked-clean",
  "forked-edited",
  "forked-ahead",
  "forked-diverged",
];

export const STATUS_CONFIG: Record<SyncStatus, { icon: string; chipClass: string }> = {
  synced: { icon: "✓", chipClass: "text-success border-success/30 bg-success/5" },
  pending: { icon: "●", chipClass: "text-warning border-warning/30 bg-warning/5" },
  missing: { icon: "!", chipClass: "text-danger border-danger/30 bg-danger/5" },
  "forked-clean": { icon: "⑂", chipClass: "text-info border-info/30 bg-info/5" },
  "forked-edited": { icon: "⑂Δ", chipClass: "text-info border-info/30 bg-info/5" },
  "forked-ahead": { icon: "⑂⚠", chipClass: "text-warning border-warning/30 bg-warning/5" },
  "forked-diverged": { icon: "⑂⚠", chipClass: "text-warning border-warning/40 bg-warning/10" },
};
