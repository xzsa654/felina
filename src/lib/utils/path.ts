// Mirror the Rust backend's `known_projects::normalize_path`: convert
// backslashes to forward slashes and strip trailing slashes on every platform,
// but casefold ONLY on Windows, where the filesystem is case-insensitive. On
// macOS/Linux the path is kept case-exact so a case-sensitive volume is not
// mis-deduplicated. Keeping this in lockstep with the backend is what prevents
// "works on Windows, breaks on Mac" path-comparison bugs.
const IS_WINDOWS =
  typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

export function normalizeProjectPath(p: string): string {
  const s = p.replace(/\\/g, "/").replace(/\/+$/, "");
  return IS_WINDOWS ? s.toLowerCase() : s;
}

// A project-scope target's destination counts as "missing" when its path is
// absent from the Known Projects list, OR present but flagged exists:false
// (folder renamed/deleted/unmounted — detected by the backend filesystem stat).
// Both surface as the "project not found" indicator. List membership alone is
// insufficient: an L3 saved entry persists after its folder is removed.
export function isProjectMissing(
  knownProjects: { path: string; exists: boolean }[],
  projectPath: string,
): boolean {
  const want = normalizeProjectPath(projectPath);
  const hit = knownProjects.find((p) => normalizeProjectPath(p.path) === want);
  return !hit || !hit.exists;
}
