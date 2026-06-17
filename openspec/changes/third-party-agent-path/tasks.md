## 1. Baseline

- [x] 1.1 執行 `npm run check` 和 `cargo test --lib`（在 `src-tauri/`），記錄現有結果作為 baseline。驗證：兩者皆通過，無 pre-existing failure

## 2. Backend — Data Model 與 Migration

- [x] 2.1 將 `AgentId` 從 sealed enum 改為 `type AgentId = String`，新增 `BUILTIN_AGENTS` 常數陣列。更新 `src-tauri/src/commands/canonical_skills.rs` 中所有 `AgentId` enum 引用。對應 spec「Open Agent Identity」。驗證：`cargo check` 通過
- [x] 2.2 將 `AgentPathPair` 擴充 `label: Option<String>` 和 `icon: Option<String>` 欄位（serde skip_serializing_if is_none）。對應 spec「Custom Agent Path CRUD」。驗證：`cargo check` 通過
- [x] 2.3 將 `AgentPathsConfig` 從固定三欄位 struct 改為 `HashMap<String, AgentPathPair>` wrapper，序列化格式為 `{ agents: {...} }`。修改 `agent_paths_get()` 實作雙格式讀取（新格式優先、舊格式 fallback、兩者皆失敗 → default）。修改 `agent_paths_set()` 寫入新格式。對應 spec「Settings JSON Migration」。驗證：新增單元測試 `test_agent_paths_migration_legacy_format` 和 `test_agent_paths_new_format`，斷言兩種格式皆能正確讀取
- [x] 2.4 更新 `validate_pair()` 接受任意 agent key，額外驗證 key 為 kebab-case（僅含 `[a-z0-9-]`）且不含 `..`。對應 spec「Rejecting invalid agent key」。驗證：新增單元測試 `test_validate_agent_key`，涵蓋合法/非法 key 場景

## 3. Backend — Fan-out Pipeline

- [x] 3.1 更新 `pair_for()` 從 match enum 改為 HashMap lookup。更新所有呼叫端（`build_preview_for_skill`、`skill_sync_one`、`skill_pull_preview`、`skill_fork_diff_preview` 等）傳入 `&str` 而非 enum variant。對應 spec「Open Agent Identity」。驗證：`cargo check` 通過
- [x] 3.2 新增 `src-tauri/src/commands/fan_out/generic.rs` 實作 `GenericRenderer`：`render()` 輸出 SKILL.md（frontmatter 含 name + description，body 原樣）。在 `fan_out/mod.rs` 註冊模組並更新 `renderer_for()` 為 match built-in + default GenericRenderer。對應 spec「Generic Fan-Out Renderer」。驗證：新增單元測試 `test_generic_renderer_output`，斷言輸出格式正確且不含 agent-specific 欄位

## 4. Backend — Agent Path Remove

- [x] 4.1 新增 `agent_path_removal_preview(agent_key: String)` command：掃描所有 skill 的 sync-meta，回傳 `RemovalPreview { skills: Vec<String>, target_count: u32 }`。新增 `agent_path_remove(agent_key: String)` command：驗證非 built-in、移除 sync-meta targets、移除 config entry，回傳 `RemoveResult { skills_affected: u32, targets_removed: u32 }`。在 `src-tauri/src/lib.rs` 的 `invoke_handler` 註冊兩個新 command。對應 spec「Deleting a custom agent path」和「Preventing deletion of built-in agents」。驗證：新增單元測試 `test_agent_path_remove_cleans_targets` 和 `test_agent_path_remove_rejects_builtin`

## 5. Frontend — Types 與 Commands

- [x] [P] 5.1 將 `src/lib/types/skills.ts` 的 `AgentId` 從 union literal 改為 `string`。更新 `src/lib/types/index.ts` 若有 re-export。對應 spec「Open Agent Identity」。驗證：`npm run check` 通過
- [x] [P] 5.2 在 `src/lib/tauri/commands.ts` 新增 `agentPathRemovalPreview(agentKey)` 和 `agentPathRemove(agentKey)` wrapper。新增 `RemovalPreview` 和 `RemoveResult` 型別。驗證：`npm run check` 通過

## 6. Frontend — Settings UI

- [x] 6.1 重構 `AgentPathsSection` 從固定三列改為動態清單：從 `agentPaths` config 的 entries 產生列表，built-in 在前（固定順序）、custom 在後（alphabetical）。Custom entries 顯示 🗑 按鈕，built-in 不顯示。新增「+ Add Agent Path」按鈕。對應 spec「Agent Paths Settings Section」。驗證：`npm run check` 通過 + `npm run tauri dev` 手動確認 Settings 頁面正確渲染
- [x] 6.2 新增 `AddAgentPathDialog` 元件：表單含 agent key（kebab-case 驗證 + 重複檢查）、global path、project relative path、optional label、optional icon（file picker）。送出後呼叫 `agent_paths_set` 更新 config。i18n key 加入 `en.ts` 和 `zh-TW.ts`。對應 spec「Adding a custom agent path」和「Rejecting duplicate agent key」。驗證：`npm run check` 通過
- [x] 6.3 新增 `RemoveAgentPathDialog` 元件：接收 agent key，呼叫 `agentPathRemovalPreview` 顯示影響清單，確認後呼叫 `agentPathRemove`。i18n key 加入 `en.ts` 和 `zh-TW.ts`。對應 spec「Deleting a custom agent path」。驗證：`npm run check` 通過

## 7. Frontend — Target UI 與 Icon

- [x] [P] 7.1 更新 `AddTargetDialog` 的 agent dropdown：從 `agentPaths` config keys 動態產生，不再使用 hardcoded 陣列。對應 spec「Add Target dialog lists all configured agents」。驗證：`npm run check` 通過
- [x] [P] 7.2 更新 `TargetChips` 的 `AgentIcon` 元件：icon 優先從 `agentPaths[agent].icon` 讀取（透過 `convertFileSrc` 轉 URL），其次 hardcoded `AGENT_ICON` map，再次 label 文字，最後 agent key capitalized。對應 spec「Custom Agent Icon Display」。驗證：`npm run check` 通過
- [x] [P] 7.3 更新 `AgentFieldsEditor` 的 `agentLabels` 從 hardcoded 改為動態讀取 config 的 label。驗證：`npm run check` 通過

## 8. 驗證

- [ ] 8.1 執行 `cargo test --lib` 於 `src-tauri/`，確認所有既有測試 + 新增測試全數通過。驗證：exit code 0，無 failure
- [ ] 8.2 執行 `npm run check`，確認 TypeScript 無 error。驗證：exit code 0
- [ ] 8.3 執行 `npm run tauri dev` 手動驗證完整流程：(1) Settings 頁面顯示 3 built-in + 可新增 custom (2) 新增 custom agent "test-agent" 含 label 和 icon (3) 在任一 skill 的 Add Target 選擇 "test-agent" 並 push，確認磁碟產出 SKILL.md (4) 回 Settings 刪除 "test-agent"，確認 target 被清除 (5) 確認 built-in agents 無 🗑 按鈕。驗證：以上 5 步驟皆通過
- [ ] 8.4 執行 `/felina-ui-guidelines` 評估本 change 的 UI 改動。驗證：輸出命中的 guideline 與 deviation 清單
