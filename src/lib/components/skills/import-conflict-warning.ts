import type { ConflictInfo, ImportCandidate } from "$lib/types";

export interface ImportConflictWarning {
  canonicalPath: string;
  diffSummary: string | null;
  requiresSourceSelection: boolean;
}

export function hasImportConflict(candidate: ImportCandidate): boolean {
  return getCandidateConflict(candidate) !== null;
}

export function getImportConflictWarning(
  candidate: ImportCandidate,
  selectedSourceIndex: number | null,
): ImportConflictWarning | null {
  if (!candidate.deferred) {
    return candidate.conflict
      ? {
          canonicalPath: candidate.conflict.canonicalPath,
          diffSummary: candidate.conflict.diffSummary,
          requiresSourceSelection: false,
        }
      : null;
  }

  const selectedConflict =
    selectedSourceIndex !== null ? candidate.deferred.candidates[selectedSourceIndex]?.conflict : null;
  const fallbackConflict = getCandidateConflict(candidate);

  if (!selectedConflict && !fallbackConflict) {
    return null;
  }

  if (!selectedConflict) {
    return {
      canonicalPath: fallbackConflict!.canonicalPath,
      diffSummary: null,
      requiresSourceSelection: true,
    };
  }

  return {
    canonicalPath: selectedConflict.canonicalPath,
    diffSummary: selectedConflict.diffSummary,
    requiresSourceSelection: false,
  };
}

function getCandidateConflict(candidate: ImportCandidate): ConflictInfo | null {
  return candidate.conflict ?? candidate.deferred?.candidates.find((source) => source.conflict)?.conflict ?? null;
}
