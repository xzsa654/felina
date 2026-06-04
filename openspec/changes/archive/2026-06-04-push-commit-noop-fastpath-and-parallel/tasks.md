## 1. Baseline 與 NoOp Fast-Path

- [x] 1.1 執行 baseline `npm run check` 與 `cargo build`（工作目錄 `src-tauri/`），記錄實作前狀態；驗證方式：命令輸出與退出碼已記錄於 apply 工作紀錄。
- [x] [P] 1.2 在 `src-tauri/src/commands/fan_out/mod.rs` 的 `SkillSyncPreviewOperation::NoOp` 分支加入 hash 比對 fast-path：取 `item.rendered_hash` 或 `item.current_hash` 與 `meta.last_sync[item.target_key].pushed_hash` 比較，若相同則跳過 `try_snapshot` 與 `compute_sibling_hashes`，僅以 `entry.get_mut` 更新 `at` 為 `attempted_at`、保留既有 `base_snapshot` 與 `sibling_hashes`；hash 不同時走既有完整路徑，落實 **NoOp fast-path: skip snapshot and sibling hash when pushed_hash unchanged** 與 **Push Commit NoOp Fast-Path**；驗證方式：`cargo test --lib noop_fast_path` 覆蓋 hash match（at 更新、snapshot/sibling 保留）與 hash mismatch（snapshot/sibling 重算）兩個 scenario 並通過。
- [x] [P] 1.3 在 `src-tauri/src/commands/fan_out/mod.rs` 的 `skill_sync_all_commit` 函式改為 `std::thread::scope` 並行：將 `for entry in entries` 替換為 `std::thread::scope` + chunking，並行度上限為 `std::thread::available_parallelism` 與 8 取較小值；每條 thread 獨立呼叫 `skill_sync_commit`，結果 flatten 回 `Vec<SyncResult>`，落實 **Inter-skill 並行化: std::thread::scope over rayon** 與 **Push All Inter-Skill Parallel Execution**；驗證方式：`cargo test --lib sync_all_commit` 通過，且函式簽名與回傳型別不變。

## 2. 整合驗證

- [x] [P] 2.1 執行 `cargo test --lib` 與 `cargo build`（工作目錄 `src-tauri/`），確認 NoOp fast-path、inter-skill 並行與既有 push/drift/snapshot tests 無回歸；驗證方式：所有命令退出碼為 0，或清楚記錄僅有 pre-existing warnings。
- [x] [P] 2.2 執行 `npm run check`，確認前端無回歸（本 change 不修改前端，但驗證 TypeScript 型別一致性）；驗證方式：退出碼為 0。
- [x] 2.3 執行 `npm run tauri dev` 手動驗證：(a) Push 單 skill 對全 NoOp targets 回應速度明顯改善；(b) Push All 對多 dirty skills 回應速度接近單 skill 而非線性疊加；(c) Push 後 drift scan 仍正確（`at` 時間戳前推、mtime fast-path 生效）；驗證方式：逐項記錄 UI 回應時間與 drift 狀態。
- [x] 2.4 執行 `spectra analyze push-commit-noop-fastpath-and-parallel --json` 與 `spectra validate push-commit-noop-fastpath-and-parallel`，確認 artifacts 與 spec coverage 一致；驗證方式：無 Critical / Warning 且 validation 通過。
