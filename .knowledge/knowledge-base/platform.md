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

## Windows: Rust Command::new 無法執行 npm .cmd shim
**ID:** kb-platform-windows-cmd-shim
**Date:** 2026-05-28
**Updated:** 2026-05-28
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-28 Session 1 — tokscale ingestion 在 Windows 上全部失敗的根因調查
**Context:** `npm install -g tokscale` 在 Windows 產生 `tokscale.cmd`（batch wrapper），Rust `Command::new("tokscale")` 底層用 `CreateProcess` 只認 `.exe`，回傳 `NotFound`。macOS 不受影響（npm 產生 symlink + shebang，`execvp` 可直接執行）。
**Applies when:** 在 Rust（或任何用 CreateProcess 的語言）中呼叫 npm 全域安裝的 CLI 工具時。
**Lesson:**
- Windows 上 `CreateProcess` 無法執行 `.cmd` / `.bat` 檔案，只認 `.exe`。
- 解法一：用 `cmd /c <binary>` 包裝，讓 `cmd.exe` 來執行 `.cmd` shim。
- 解法二：用環境變數（如 `PATH`）指定絕對路徑，直接指向 `.exe` 或 `.cmd`。
- `npx` 也是 `.cmd` shim，同樣受影響——fallback 到 npx 也會失敗。
- GUI app（Tauri）的 PATH 可能和使用者的 shell 環境不同，進一步加劇找不到 binary 的問題。
**Keywords:** windows, createprocess, cmd shim, npm global, rust command, tokscale, npx, tauri, gui path
**Related:** kb-platform-windows-claude-credentials
**Supersedes:** kb-platform-tokscale-parser-fallback
