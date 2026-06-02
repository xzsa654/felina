## 1. 基線 (Baseline)

- [x] 1.1 紀錄移除前的 `npm run check` 與 `cargo build`（於 `src-tauri/`）輸出狀態，確保任何後續錯誤可區分本 change 新引入 vs pre-existing。完成條件：在本 change 工作目錄留下 baseline 輸出摘要（pass / fail + error count），驗證方式為比對最終驗證階段的輸出差異。

## 2. 後端移除（Settings Backend）

- [x] 2.1 移除 `src-tauri/src/commands/settings.rs` 檔案，並從 `src-tauri/src/commands/mod.rs` 移除 `pub mod settings;` 宣告。完成條件：檔案不存在、`mod.rs` 不再 reference `settings`。驗證：`test -f src-tauri/src/commands/settings.rs` 回傳 false。
- [x] 2.2 自 `src-tauri/src/lib.rs` 的 `tauri::generate_handler!` 中移除 `read_settings` 與 `write_settings` 兩個 entry。完成條件：`grep -E "(read|write)_settings" src-tauri/src/lib.rs` 無結果。驗證：`cargo build` 於 `src-tauri/` 通過，無 unresolved import / unused symbol 錯誤。

## 3. 前端 Wrapper 移除

- [x] 3.1 [P] 自 `src/lib/tauri/commands.ts` 移除 `api.settings` namespace（含 `read` 與 `write` 兩個 wrapper），同步移除僅 `SettingsPage` 使用、自此 wrapper export 的 `Settings` type alias（若有）。完成條件：`grep "api.settings"` 在 `src/` 下無結果。驗證：`npm run check` 通過。

## 4. 前端頁面與元件移除（Registered Pages 縮減）

- [x] 4.1 刪除 `SettingsPage` 及其專屬 sub-components 目錄 `src/lib/components/settings/`（保留 `FelinaSettingsPage`、`QuickSettingsPopover` 等不在此目錄下的元件）。完成條件：`SettingsPage.tsx`、`GeneralSettings.tsx`、`PermissionsEditor.tsx`、`EnvVarsEditor.tsx` 四檔不存在。驗證：`grep -r "SettingsPage\|GeneralSettings\|PermissionsEditor\|EnvVarsEditor" src/` 僅可能命中 `FelinaSettingsPage`（含 `Settings` 子字串），其餘無結果。
- [x] 4.2 刪除 `TemplatesPage` 與 `TemplateGallery`：`src/lib/components/templates/TemplatesPage.tsx`、`src/lib/components/shared/TemplateGallery.tsx`。完成條件：兩檔不存在。驗證：`grep -r "TemplatesPage\|TemplateGallery" src/` 無結果（含下方對 retained 頁面的清理）。
- [x] 4.3 [P] 自 retained-for-reference 頁面 `src/lib/components/hooks/HooksPage.tsx` 與 `src/lib/components/mcp/McpPage.tsx` 移除 `TemplateGallery` 的 import 與所有呼叫點（含開啟 gallery 的觸發按鈕與 `onselect` 處理），確保兩檔仍可獨立 type-check 通過。完成條件：兩檔不再引用 `TemplateGallery`、無 dangling state。驗證：`npm run check` 通過、`grep "TemplateGallery" src/lib/components/{hooks,mcp}/` 無結果。

## 5. Routing 與 Navigation 修正（Routes defined for all 18 pages）

- [x] 5.1 自 `src/router.tsx` 移除 `/settings`、`/templates` 兩條 route 與對應 lazy import 行（`SettingsPage`、`TemplatesPage`），不新增 redirect，使 Routes defined for all 18 pages requirement 在 delta 後維持一致。完成條件：`router.tsx` 內無 `settings` / `templates` route 字面字串。驗證：啟動 `npm run tauri dev` 後手動導向 `/settings` 與 `/templates`，預期路由解析失敗或落到首頁，非渲染原頁面。
- [x] 5.2 [P] 自 `src/lib/stores/navigation.ts` 的 `Page` type union 與 `NAV_ITEMS` 陣列移除 `settings`、`templates` 兩個 entry，以滿足 Registered Pages requirement。完成條件：`Page` type 僅含 `skills | projects | tokens | memory | history`，`NAV_ITEMS` 不含對應項目。驗證：`npm run check` 通過（TranslationDict / Page 對齊不會報錯）。
- [x] 5.3 [P] 更新 `src/lib/components/layout/Sidebar.tsx` 的 `ICON_MAP`：移除 `gear`、`templates` 兩鍵；保留 `Settings` lucide import（仍由 QuickSettings 觸發按鈕使用）。完成條件：Sidebar 渲染後不再顯示 Settings / Templates 兩個導覽項。驗證：`npm run tauri dev` 手動目視 Sidebar 列表。

## 6. i18n 清理

- [x] 6.1 自 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 移除僅供已刪除頁面 / 元件使用的 key（含 Sidebar 的 Settings / Templates label、SettingsPage 內所有 tab / 按鈕字串、TemplateGallery 標題等）。完成條件：兩檔結構仍對齊（TranslationDict 不報錯）、未刪到仍被 `FelinaSettingsPage` / `QuickSettingsPopover` 使用的 key。驗證：`npm run check` 通過。實作結果：audit 後發現 legacy 頁面用 hardcoded 英文字串、無 i18n key 殘留可清；no-op。

## 7. 驗證階段（首輪）

- [x] 7.1 執行 `cargo build` 於 `src-tauri/`，確認無新增錯誤；對照 Task 1.1 baseline。完成條件：build 成功且 warning 數不超過 baseline。
- [x] 7.2 執行 `npm run check`，確認無新增 TypeScript 錯誤；對照 Task 1.1 baseline。完成條件：tsc --noEmit 無錯誤。
- [ ] 7.3 執行 `npm run tauri dev` 手動驗證：(a) Sidebar 不再顯示 Settings 與 Templates 兩個項目；(b) 手打 `/settings` 與 `/templates` URL 不會渲染原頁面；(c) `/felina-settings` 仍正常運作；(d) Sidebar 上的 QuickSettings 觸發按鈕仍可開啟 popover；(e) Tokens 頁的 `AgentQuotaPanel`（消費 `api.budget`）仍正常運作。完成條件：上述五項全部通過。
- [x] 7.4 確認 Settings Page Agent Paths Section 已被刪除：legacy `SettingsPage.tsx` 不存在，FelinaSettingsPage 仍使用的 `src/lib/components/settings/AgentPathsSection.tsx` 與 spec REMOVED 的 legacy Settings Page Agent Paths Section 是不同元件，不衝突。完成條件：legacy 設定相關 UI 不存在於程式碼。

## 8. Spec 同步（首輪）

- [x] 8.1 執行 `spectra validate remove-legacy-settings-templates-pages`，確認 proposal / specs / tasks 一致。完成條件：validate 無錯誤。

## 9. 深層退役：hooks / mcp（解除 settings 耦合）

- [x] 9.1 刪除 `src-tauri/src/commands/hooks.rs` 與 `src-tauri/src/commands/mcp.rs`。完成條件：兩檔不存在。驗證：`test -f` 兩檔皆回傳 false。
- [x] 9.2 自 `src-tauri/src/commands/mod.rs` 移除 retained `mod hooks;` 與 `mod mcp;` 宣告，並確認 `settings` 也已自 retained 清單拔除（與 Task 2.1 一致）。完成條件：retained 清單為 `budget / instructions / rules / stats` 四項。驗證：`cargo build` 通過。
- [x] 9.3 刪除前端 `src/lib/components/hooks/`（`HooksPage.tsx`、`HookCard.tsx`）與 `src/lib/components/mcp/`（`McpPage.tsx`）整目錄。完成條件：兩目錄不存在。驗證：`ls src/lib/components/hooks src/lib/components/mcp` 回傳目錄不存在錯誤。
- [x] 9.4 自 `src/lib/tauri/commands.ts` 移除 `api.hooks` 與 `api.mcp` namespace，以及不再使用的 `SettingsScope` / `HookEventConfig` type imports。同步更新檔首註解，反映 retained-for-reference wrapper 縮減為 `instructions / rules / budget / stats`。完成條件：`grep -E "api\.(hooks|mcp)\b" src/` 無結果。驗證：`npm run check` 通過。

## 10. paths.rs 清理（settings/mcp 專用 helper）

- [x] 10.1 自 `src-tauri/src/paths.rs` 刪除 5 個僅 settings/mcp 使用的 helper：`global_settings_path` / `project_settings_path` / `project_local_settings_path` / `project_mcp_json_path` / `claude_desktop_config_path`。保留 `claude_home`、`felina_global_settings_path` 等仍被 active code（agent_paths 等）使用的 helper。完成條件：上述 5 個 helper 不存在於 paths.rs。驗證：`cargo build` 通過、warning 數回到 baseline。

## 11. 文件同步（CLAUDE.md retained 清單）

- [x] 11.1 更新 `CLAUDE.md` 的 retained-for-reference 段落：「Registered vs retained-for-reference modules」章節與「Gotchas」最後一條的 retained 模組清單，從 `hooks / instructions / mcp / rules / budget / stats` 改為 `instructions / rules / budget / stats`，前端目錄清單從 `hooks/ / instructions/ / mcp/ / rules/` 改為 `instructions/ / rules/`。完成條件：兩處清單一致、不再列出 hooks / mcp。驗證：`grep -n "retained" CLAUDE.md` 兩處皆只列四個模組。

## 12. 連帶 TS 收窄修正（Page type narrowing 副作用）

- [x] 12.1 `src/lib/components/shared/OnboardingWelcome.tsx`：移除 `page: "settings"` 與 `page: "templates"` 兩個 onboarding step（含對應的 Settings / LayoutTemplate icon imports），因 Page type 收窄後這兩個值已不存在。完成條件：steps array 不含 settings / templates。驗證：`npm run check` 通過。
- [x] 12.2 `src/lib/components/shared/CommandPalette.tsx`：移除 ICON_MAP 的 `gear: Settings` / `templates: LayoutGrid` 兩 entry，與不再使用的 `Settings` / `LayoutGrid` lucide imports。完成條件：ICON_MAP 不含 gear / templates。驗證：`npm run check` 通過。

## 13. Orphan 型別清理（dead-引用-dead 鏈）

- [x] 13.1 刪除 `src/lib/utils/achievements.ts`：整檔來自 upstream Glyphic baseline (`1f713a5 chore: baseline snapshot of upstream Glyphic by Caio Ricciuti`)，匯出的 `calculateXP` / `evaluateAchievements` 在整個 src/ 下無任何 caller，是純 upstream dead code。刪除後解除其對 `Settings` 型別的 dead 引用。完成條件：檔案不存在。驗證：`grep -rE "calculateXP|evaluateAchievements" src/` 無結果。
- [x] 13.2 刪除 `src/lib/types/hooks.ts`：HooksPage / HookCard 被刪後零 consumer。完成條件：檔案不存在。驗證：`grep -rE "HOOK_EVENTS|HOOK_EVENT_DESCRIPTIONS|HookEvent\b" src/` 無結果（注意排除 `HookEventConfig` / `HookHandler` 命名前綴，但這兩個型別本身也應在 13.3 後一併清空）。
- [x] 13.3 刪除 `src/lib/types/settings.ts`：13.1 移除 achievements.ts 後 `Settings` / `SettingsScope` / `EffortLevel` / `DefaultMode` / `HookEventConfig` / `HookHandler` / `McpStdioServer` / `McpSseServer` / `McpServerConfig` 全部無 live consumer。完成條件：檔案不存在。驗證：`grep -rE "\b(Settings|SettingsScope|EffortLevel|DefaultMode|McpServerConfig|McpStdioServer|McpSseServer|HookEventConfig|HookHandler)\b" src/` 無結果（排除註解、`Settings` lucide icon、字串字面值）。
- [x] 13.4 從 `src/lib/types/index.ts` 移除對 `./settings`、`./hooks` 的 re-export 區塊（兩段 `export type { ... } from "./settings"` 與 `export { HOOK_EVENTS, HOOK_EVENT_DESCRIPTIONS } from "./hooks"` / `export type { HookEvent } from "./hooks"` 共三段）。完成條件：index.ts 不再引用 ./settings 或 ./hooks。驗證：`npm run check` 通過。

## 14. 最終驗證

- [x] 14.1 執行 `cargo build` 於 `src-tauri/`：完成條件 warning 數不超過 baseline（2 warnings: `ensure_repo` dead_code + `SkillTarget` unused_import）。
- [x] 14.2 執行 `npm run check`：完成條件 0 errors。
- [x] 14.3 執行 `spectra validate remove-legacy-settings-templates-pages`：完成條件 valid。
