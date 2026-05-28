## 1. 準備與基線

- [x] 1.1 執行 `cargo check` 和 `npm run check` 紀錄現有錯誤作為基準。

## 2. 建立 Git 抽象層

- [x] 2.1 在 `src-tauri/Cargo.toml` 新增 `git2 = { version = "0.19", features = ["vendored"] }` 依賴。驗證：`cargo check` 成功。
- [x] 2.2 建立 `src-tauri/src/commands/snapshot.rs`。實作 `ensure_repo() -> Result<Repository, String>`：若 `~/.felina/skills/.git` 不存在則 `Repository::init`，已存在則 `Repository::open`。對應 Global Git Repository requirement。驗證：撰寫單元測試，在 temp dir 呼叫兩次 `ensure_repo` 確認冪等。
- [x] 2.3 在 `snapshot.rs` 實作 `commit_skill_changes(skill_name: &str) -> Result<String, String>`：將指定 skill 目錄下所有檔案加入 index 並 commit（message 格式 `push: <skill-name>`），回傳 40 碼 commit hash。驗證：單元測試驗證 commit hash 為 40 碼 hex 且 repo log 有對應 commit。
- [x] 2.4 在 `snapshot.rs` 實作 `get_snapshot_content(commit_hash: &str, relative_path: &str) -> Result<Option<String>, String>`：從 git object store 讀取指定 commit 的檔案內容，不需 checkout。若 hash 無效或檔案不存在回傳 `Ok(None)`。對應 Snapshot Content Retrieval requirement。驗證：單元測試先 commit 再用 hash 讀回內容，比對一致。
- [x] 2.5 在 `src-tauri/src/commands/mod.rs` 宣告 `pub mod snapshot;`。驗證：`cargo check` 通過。

## 3. 串接 Fan-out Push 流程

- [x] 3.1 修改 `src-tauri/src/commands/fan_out/mod.rs`：在單一 target push 成功後，呼叫 `snapshot::commit_skill_changes`。若成功，將回傳的 commit hash 寫入 `LastSyncEntry.base_snapshot`（`Some(hash)`）。若失敗，`tracing::warn!` 記錄並維持 `base_snapshot` 原值，不中斷 push。對應 Snapshot Commits on Push requirement。驗證：`cargo check` 通過。

## 4. 驗證與整合

- [x] 4.1 確認 `canonical_skills.rs` 中所有讀取 `base_snapshot` 的位置不會因值從 `None` 變為 `Some("40-char-hex")` 而崩潰（靜態檢查 + 既有 cargo test 通過）。
- [x] 4.2 執行完整 `cargo test --lib` 確認無 regression。
- [x] 4.3 手動驗證：`npm run tauri dev`，修改一筆 Skill 並 Push。檢查 `~/.felina/skills/.felina-sync-meta.json` 對應 target 的 `base_snapshot` 已為 40 碼 commit hash，且 `~/.felina/skills/.git` 存在。
