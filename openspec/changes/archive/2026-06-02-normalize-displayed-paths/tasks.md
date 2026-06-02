## 1. Baseline

- [x] 1.1 執行 `cd src-tauri && cargo test --lib` 與 `cargo check`，記錄現有 Rust pass/fail 與 warning 數作為 baseline。驗證：保留結果供 4.x 比對。

## 2. Display-Path Normalization Helper（涵蓋 Backend Display-Path Normalization 的核心輔助）

- [x] 2.1 涵蓋 `Backend Display-Path Normalization` 的核心輔助：在 `src-tauri/src/paths.rs` 新增 `pub(crate) fn normalize_display_path(p: &str) -> String` helper：實作為 `p.replace('\', "/")` 後去除所有尾端 `/`，**不**做 casefold。函式 doc comment 明確說明「display only — for identity / dedup use `known_projects::normalize_path`」。驗證：新增 `cargo test` 覆蓋 4 個 case — Windows 風格 `C:\a\b\` → `C:/a/b`、混合 separator `C:/a\b` → `C:/a/b`、空字串 → `""`、大小寫保留 `C:\Foo` → `C:/Foo`。

## 3. Apply Normalization at Backend Command Output

- [x] 3.1 [P] 在 `src-tauri/src/commands/skill_import.rs` 的 `collect_candidates_in` 函式內，建立 `ImportCandidate` 時對 `source_path` 套用 `normalize_display_path`；建立 `ConflictInfo` 時對 `canonical_path` 套用 `normalize_display_path`。涵蓋 spec 的 "Windows path with backslashes is normalized for display"、"Case is preserved"、"Conflict canonical path is normalized" 三個 scenario。驗證：新增 `cargo test` 用 tempdir 模擬 Windows 風格輸入（透過直接呼叫 helper 而非依賴 OS），確認輸出 `source_path` 與 `canonical_path` 為 forward-slash 且大小寫保留。
- [x] 3.2 [P] 在 `src-tauri/src/commands/canonical_skills.rs` 的 `canonical_skills_list` 內，對 broken entry 的 `path` 欄位套用 `normalize_display_path`（在 push 進回傳 vec 前）。涵蓋 spec 的 "Broken canonical entry path is normalized" scenario。驗證：新增 `cargo test` 建立含 malformed SKILL.md 的 tempdir，呼叫 `canonical_skills_list`，確認 broken entry 的 `path` 不含 `\`、大小寫保留。
- [x] 3.3 No-op：`canonical_skills_read_raw` 簽章為 `Result<String, String>`，**不回傳 `path` 欄位**。前端 `brokenRaw.path` 是從 `SkillListEntry`（broken kind）的 `path` 組出來，已由 task 3.2 涵蓋。保留為設計記錄，不需 code 改動。驗證：無。

## 5. Apply Normalization at Fan-Out and Delete Output（scope 擴充）

- [x] 5.1 在 `src-tauri/src/commands/fan_out/mod.rs` 對 `SyncResult.target_path`（push / commit 共 4 處）、`SkillSyncPreview.target_dir` / `skill_dir` / `skill_md_path`（3 處）、`skill_target_dir_resolve` 回傳的 `TargetDirInfo.path` 套用 `normalize_display_path`。涵蓋 spec 的 "Push result target path is normalized" 與 "Target dir resolve returns normalized path"。驗證：新增 `cargo test` `target_dir_resolve_normalizes_path_for_display` 通過、全測無新增 fail。
- [x] 5.2 在 `src-tauri/src/commands/canonical_skills.rs` 對 `canonical_skill_delete` 內部的 `canonical_path` 與 `delete_skill_dir_result` 內部的 `path_string` 套用 `normalize_display_path`。驗證：`cargo check` 通過、既有測試不破。

## 4. Verification

- [x] 4.1 執行 `cd src-tauri && cargo test --lib`，確認新增測試（normalize_display_path 4 case、skill_import_scan 輸出 normalized、canonical_skills_list 輸出 normalized）全通過，pass 數 ≥ baseline + 6、fail 數 ≤ baseline。
- [x] 4.2 執行 `cd src-tauri && cargo check`，confirm 無新增 warning。
- [x] 4.3 執行 `npm run check`，confirm 無新增 TypeScript error（前端未修改，僅確認接收 normalized payload 仍 type-check）。
- [ ] 4.4 啟動 `npm run tauri dev`（限 Windows 機器）手動驗證：在 SkillsPage 開 SkillImportWizard / ImportStagingDialog / SkillEditor broken view / SkillList broken row / TargetPopover tooltip 五處，所有路徑文字均不含 `\`，且大小寫保留原樣（例如 `C:/MyProject/...` 而非 `c:/myproject/...`）。
- [x] 4.5 確認 `known_projects::known_projects_list` 行為不變：執行對應的 `cargo test`（`normalize_path_dedupes_variants` 等），全部通過。
