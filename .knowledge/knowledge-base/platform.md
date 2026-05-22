# Platform

Windows / git / toolchain platform-specific gotchas for Felina.

---

## Windows: git checkout leaves files falsely "modified" (CRLF stat cache), can abort merge
**ID:** kb-git-windows-crlf-stat-false-modified
**Date:** 2026-05-22
**Updated:** 2026-05-22
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-05-22 — `git merge --no-ff spx/... into dev` aborted on a clean tree
**Context:** Right after `git checkout dev`, a merge aborted with "Your local changes to src-tauri/Cargo.toml would be overwritten by merge" even though nothing was intentionally edited.
**Applies when:** On Windows, immediately after a branch checkout / switch, when git reports tracked files (often `*.toml`, `*.lock`, `*.rs`) as modified or blocks a merge/rebase/checkout — but `git diff` shows no real content change.
**Lesson:**
- Cause: with `core.autocrlf` line-ending normalization, `git checkout` can leave the index stat cache stale, so files appear modified without any content diff. This can abort a follow-up `git merge` ("local changes would be overwritten").
- Fix: run `git status` (or `git diff`) once — it refreshes the index stat cache and the phantom modification disappears. Then retry the merge; it succeeds.
- Diagnostic: confirm it's phantom by checking `git diff <file>` and `git diff --stat` are EMPTY while `git status` initially flagged it. Empty diff + flagged = stat-cache phantom, not a real change.
- Do NOT `git checkout -- <file>` / stash / reset to "fix" it — that risks discarding real work. The refresh-via-`git status` approach is non-destructive.
- The repeated "LF will be replaced by CRLF the next time Git touches it" warnings on `git add` are the same normalization at work; benign.
**Keywords:** git, windows, crlf, autocrlf, checkout, merge aborted, local changes would be overwritten, stat cache, phantom modified, line endings
**Related:** kb-react-pagebody-layout
