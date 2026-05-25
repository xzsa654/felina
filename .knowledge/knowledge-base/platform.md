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

---

## Windows: Claude Code OAuth credentials stored in ~/.claude/.credentials.json
**ID:** kb-platform-windows-claude-credentials
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** tokens-cross-platform-fix session — network response showed "Claude Code credentials not found in Keychain"
**Context:** `ccusage.rs` used macOS `security find-generic-password` to read OAuth token; always fails on Windows.
**Applies when:** Reading Claude Code OAuth credentials cross-platform, or adding any feature that depends on the user's Anthropic auth token.
**Lesson:**
- macOS: credentials in Keychain under service "Claude Code-credentials", retrievable via `security find-generic-password -s "Claude Code-credentials" -w`. Returns a JSON blob.
- Windows/Linux: same JSON stored as a plain file at `~/.claude/.credentials.json`.
- JSON structure is identical on both platforms: `{"claudeAiOauth":{"accessToken":"...","refreshToken":"...","expiresAt":...,...}}`.
- Pattern: try Keychain on macOS (`cfg!(target_os = "macos")`), fall back to file read. Use the same deserialization struct for both.
**Keywords:** windows, credentials, oauth, keychain, claude code, cross-platform, .credentials.json
**Related:** kb-platform-tokscale-parser-fallback

---

## Token refresh requires parser fallback when tokscale CLI is absent
**ID:** kb-platform-tokscale-parser-fallback
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** tokens-cross-platform-fix session — History page empty despite valid .jsonl transcripts
**Context:** `TokenAggregator.refresh()` calls `refresh_with_options(false)`, which refuses to fall back to the built-in parser when tokscale fails. Result: 0 events ingested, empty DB.
**Applies when:** Calling refresh_token_data or any code path that populates the token DB for History/Analytics pages.
**Lesson:**
- `refresh()` = tokscale only, no fallback. `refresh_with_options(true)` = tokscale first, then Felina parser fallback.
- The Felina parser (`run_parser_scan`) scans `~/.claude/projects/**/*.jsonl` and `~/.codex/sessions/` directly — no external CLI needed.
- For UI-facing refresh (History page, manual refresh button), always use `refresh_with_options(true)` so users without tokscale still get data.
- `refresh_parser_fallback()` is the explicit diagnostic-only entry point; it bypasses tokscale entirely.
**Keywords:** tokscale, token refresh, parser fallback, history page, felina parser, scan, jsonl, empty db
**Related:** kb-platform-windows-claude-credentials
