## Why

目前 `skill_pull_from_target` 會直接用 target 端的內容覆蓋 canonical SKILL.md，使用者無法在 pull 前得知 canonical 與 target 之間的差異。同時，`LastSyncEntry.base_snapshot` 欄位雖已預留（`Option<String>`），但全 codebase 皆為 `None`，尚無可靠的「上次 push 時 canonical 的內容」基準點。

引入 Git-based snapshot layer 後：
1. Pull 時可用 base snapshot 做 diff preview，讓使用者在覆蓋前看到具體變更。
2. 未來 `forked-target-overlay` 的 3-way merge 可直接取用 commit hash 作為 merge base。

## What Changes

- 在 `~/.felina/skills/` 根目錄初始化單一隱藏的 Git 儲存庫（`.git`），使用 Rust `git2` crate（零外部相依，不需系統安裝 Git）。
- 新增 Rust 模組 `src-tauri/src/commands/snapshot.rs`，封裝 `git2` 低階操作為高階 API（`init_repo`、`commit_skill_changes`、`get_snapshot_content`）。
- 修改 Fan-out Push 流程：push 成功後自動 commit canonical 檔案，將 40 碼 commit hash 寫入 `lastSync[target].base_snapshot`。
- 修改 Pull 流程：pull 前利用 `base_snapshot` 取回上次 push 時的 canonical 內容，與現在的 canonical 和 target 內容產生 diff preview。

## Non-Goals

- 不實作 UI 上的 Git 歷史瀏覽或手動 reset 功能（此階段為底層基礎建設）。
- 不把 `.claude/skills` 等 agent-native 目錄納入 Git 版本控制，Git repo 僅管理 Felina canonical 目錄。
- 不實作 3-way merge 自動合併（留待 `forked-target-overlay`）。

## Capabilities

### New Capabilities

- `local-versioning-and-snapshot-layer`: 定義 canonical skills 目錄的 Git 版控初始化、push 後自動 snapshot commit、以及 pull 前 diff preview 的行為規則。

### Modified Capabilities

(none)

## Impact

- Affected specs: `local-versioning-and-snapshot-layer`（新增）
- Affected code:
  - New: `src-tauri/src/commands/snapshot.rs`（git2 抽象層）
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`（push 後自動 commit + 更新 base_snapshot）
  - Modified: `src-tauri/src/commands/mod.rs`（宣告 snapshot module）
- New dependency: `git2` crate（Cargo.toml）
- 風險：`git2` 綁定 `libgit2`（C library），會增加編譯時間與 binary size。Windows 上需確認 vendored OpenSSL 或 native TLS 設定。
