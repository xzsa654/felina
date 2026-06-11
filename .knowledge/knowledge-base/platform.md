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
**Updated:** 2026-06-10
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-28 Session 1 根因調查；2026-06-10 `tokscale-windows-cmd-resolution-fix` 修復落地（archive: `2026-06-10-tokscale-windows-cmd-resolution-fix`）
**Context:** `npm install -g tokscale` 在 Windows 產生 `tokscale.cmd`（batch wrapper），Rust `Command::new("tokscale")` 底層用 `CreateProcess` 只認 `.exe`，回傳 `NotFound`。macOS 不受影響（npm 產生 symlink + shebang，`execvp` 可直接執行）。
**Applies when:** 在 Rust（或任何用 CreateProcess 的語言）中呼叫 npm 全域安裝的 CLI 工具時。
**Lesson:**
- Windows 上 `CreateProcess` 無法執行 `.cmd` / `.bat` 檔案，只認 `.exe`。
- **定案解法（2026-06-10 已落地於 `tokens/tokscale.rs`）**：裸命令名稱（無路徑分隔符、無副檔名）spawn 回 `NotFound` 時，以同名 `.cmd` 變體重試一次；explicit path override 永不變體重試。此模式可複用於任何「app 內呼叫外部 CLI」場景。
- 不採 `cmd /c` 包裝：經 shell 執行引入注入面，且 args 轉義規則複雜（已於 `2026-06-08-eliminate-subprocess-cmd-windows` 全面移除 cmd 包裝）。
- 解法二（仍有效）：環境變數（如 `FELINA_TOKSCALE_BIN`）指定絕對路徑。
- `npx` 也是 `.cmd` shim，同樣受影響——修復前 Windows 上 npx fallback 從未生效過。
- GUI app（Tauri）的 PATH 可能和使用者的 shell 環境不同，進一步加劇找不到 binary 的問題。
**Keywords:** windows, createprocess, cmd shim, npm global, rust command, tokscale, npx, tauri, gui path
**Related:** kb-platform-windows-claude-credentials
**Supersedes:** kb-platform-tokscale-parser-fallback

---

## git2 crate: vendored feature 名稱是 vendored-libgit2 不是 vendored
**ID:** kb-platform-git2-vendored-feature
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** local-versioning-and-snapshot-layer 實作 — cargo check 首次失敗
**Context:** `git2 = { version = "0.19", features = ["vendored"] }` 導致 `cargo check` 報錯 "does not have that feature"，正確名稱為 `vendored-libgit2`。
**Applies when:** 在 Cargo.toml 加入 `git2` crate 並希望內嵌 libgit2 不依賴系統安裝時。
**Lesson:**
- git2 0.19 的 vendored feature 名稱為 `vendored-libgit2`，不是 `vendored`。
- 另有 `vendored-openssl` 可選。完整可用 features 見 `cargo check` 錯誤訊息。
- 首次編譯 vendored libgit2 需額外 30-60 秒（C 編譯），後續增量不受影響。
**Keywords:** git2, vendored, vendored-libgit2, cargo, libgit2, feature name, build error

---

## Tauri v2: plugin config 與 plugin 註冊必須同進退（缺 config → 視窗建立前無聲 panic）
**ID:** kb-tauri-plugin-config-registration-pairing
**Date:** 2026-06-10
**Updated:** 2026-06-10
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-06-10 — 1.1.0 安裝檔點 exe 無反應；commit 301fd7a 拔 plugins.updater config 但 lib.rs 仍註冊 plugin；修復 change remove-updater-plugin-surface（merge 75fac86）
**Context:** 1.1.0 Windows 安裝版點開完全沒反應（ExitCode 101），dev 模式與舊版正常。
**Applies when:** 移除/新增任何需要 config 的 Tauri plugin（updater、deep-link 等），或 release exe「點了沒反應」「無聲退出」時的診斷。
**Lesson:**
- 部分 Tauri v2 plugin（如 tauri-plugin-updater）初始化時強制反序列化 tauri.conf.json 的 `plugins.<name>` 區塊；config 缺失 + plugin 仍在 lib.rs 註冊 → `PluginInitialization("updater", ...invalid type: null, expected struct Config")` panic，發生在視窗建立之前。
- Windows release 用 `windows_subsystem = "windows"` 沒有 console，panic 訊息完全不可見，表現就是「點 exe 無反應」。診斷法：從 cmd/PowerShell 啟動 exe 並查 `$LASTEXITCODE`（panic = 101），或用 dev build 重現。
- 移除 plugin surface 必須全鏈同步：tauri.conf.json config、lib.rs `.plugin(...)` 註冊、capabilities permission（如 `updater:default`）、Cargo.toml 依賴、前端 npm 依賴與呼叫元件。只拔其中一層就會出現 config/程式碼不一致的啟動炸彈。
- `gen/schemas/*.json` 是 build 時平台別重生成的產物：Windows build 只更新 windows/desktop schema，`macOS-schema.json` 殘留舊 permission 字樣屬正常，等 mac build 自動更新，不要手改。
**Keywords:** tauri, plugin, updater, PluginInitialization, panic, ExitCode 101, windows_subsystem, silent exit, 點exe沒反應, capabilities, plugins config
**Related:** kb-git-windows-crlf-stat-false-modified
