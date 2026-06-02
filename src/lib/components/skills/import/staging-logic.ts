import type { ImportCandidate } from "$lib/types";

export type StagingStatus = "ready" | "conflict" | "pending-source";

export interface StagingItem {
  candidate: ImportCandidate;
  status: StagingStatus;
  resolvedName: string;
  resolution: "overwrite" | "rename" | null;
  selectedSourceIndex: number | null;
}

export function deriveStagingStatus(
  skillName: string,
  existingNames: Set<string>,
  isDeferred: boolean,
): StagingStatus {
  if (isDeferred) return "pending-source";
  return existingNames.has(skillName) ? "conflict" : "ready";
}

export function createStagingItem(
  candidate: ImportCandidate,
  existingNames: Set<string>,
): StagingItem {
  const status = deriveStagingStatus(candidate.skillName, existingNames, !!candidate.deferred);
  return {
    candidate,
    status,
    resolvedName: candidate.skillName,
    resolution: null,
    selectedSourceIndex: null,
  };
}

export function selectSource(
  item: StagingItem,
  sourceIndex: number,
  existingNames: Set<string>,
): StagingItem {
  const status = existingNames.has(item.candidate.skillName) ? "conflict" : "ready";
  return { ...item, selectedSourceIndex: sourceIndex, status };
}

export function resolveStagingConflict(
  item: StagingItem,
  resolution: "overwrite" | "rename",
  newName?: string,
): StagingItem {
  if (resolution === "rename" && newName) {
    return { ...item, resolution: "rename", resolvedName: newName, status: "ready" };
  }
  return { ...item, resolution: "overwrite", status: "ready" };
}

export function hasUnresolved(items: StagingItem[]): boolean {
  return items.some((item) =>
    (item.status === "conflict" && item.resolution === null) ||
    item.status === "pending-source",
  );
}
