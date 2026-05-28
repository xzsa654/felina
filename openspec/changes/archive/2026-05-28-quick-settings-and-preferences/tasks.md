## 1. Baseline

- [x] 1.1 建立 frontend baseline：執行 `npm run check` 並記錄目前 TypeScript 結果，完成條件是後續驗證能區分本 change 新增錯誤與既有狀態。

## 2. Backend Contract

- [x] 2.1 實作 Saved Known Projects Backend Contract 與 Saved-Only Known Projects Listing（saved-only backend contract）：在 `known_projects.rs` 新增 `known_projects_saved_list` function，直接讀取 `KnownProjectsStore.projects`，回傳 saved-only `KnownProject[]`，每個 entry 的 `sources` 含 `saved`，`exists` 由 filesystem stat 決定。缺檔或 malformed store 回傳空陣列。以 Rust tests 驗證 missing store 回傳空陣列、saved existing path 回傳 `exists: true`、saved missing path 回傳 `exists: false`。
- [x] 2.2 註冊 `known_projects_saved_list` 到 active backend surface：在 `src-tauri/src/commands/mod.rs` export 該 function，在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 加入 `known_projects_saved_list`。完成條件是 `cargo build` 在 `src-tauri/` 無錯誤。

## 3. Theme System 模式

- [x] [P] 3.1 實作 Theme Selection（theme 支援 system 模式）：修改 `src/lib/stores/theme.ts`，將 `Theme` type 改為 `ThemePreference = "dark" | "light" | "system"`，新增 `resolvedTheme` 衍生值（永遠是 `"dark" | "light"`），system 模式透過 `window.matchMedia('(prefers-color-scheme: dark)')` 決定 resolved 值並監聽 `change` 事件即時切換。`applyTheme` 使用 resolvedTheme 設定 `data-theme`，localStorage 儲存 `ThemePreference`。`toggleTheme` 循環順序改為 dark → light → system → dark。舊版 localStorage 值自然相容。完成條件是 `npm run check` 通過且 store 型別正確。

## 4. 路由與頁面

- [x] [P] 4.1 新增 Felina Settings route（felina settings 頁面路由）：在 `src/router.tsx` 新增 `/felina-settings` 路由，lazy load `FelinaSettingsPage`，使用與其他路由一致的 `LazyPage` wrapper。不修改 `NAV_ITEMS` 或 `Page` type union。完成條件是 `npm run check` 通過。
- [x] 4.2 實作 Felina Settings Page（felina settings 頁面內容）：建立 `src/lib/components/settings/FelinaSettingsPage.tsx`，使用與其他頁面一致的 layout 結構（in-page title + scrollable content area），包含 `AgentPathsSection` 和 `SavedKnownProjectsSection` 兩個 section。完成條件是 `npm run check` 通過。

## 5. Saved Known Projects UI

- [x] 5.1 新增 frontend typed wrapper：在 `src/lib/tauri/commands.ts` 新增 `knownProjects.savedList()` wrapper，完成條件是 `npm run check` 型別正確。
- [x] 5.2 實作 Saved Known Projects Listing：建立 `src/lib/components/settings/SavedKnownProjectsSection.tsx`，呼叫 `knownProjects.savedList()` 列出 saved-only paths，每個 row 顯示 path 與 exists/missing 狀態，提供 remove 按鈕。Empty state 顯示引導文案。完成條件是 `npm run check` 通過。
- [x] 5.3 實作 Saved Known Projects Removal（remove 行為邊界、路徑正規化邊界）：remove action 使用 `ConfirmDialog`，確認文案明確說明只移除 Felina saved entry、不刪資料夾、不刪 agent files。確認後呼叫既有 `known_projects_remove(path)` 並重新載入 saved list，失敗時顯示 inline error。完成條件是手動 UI 驗證 row 消失、folder 仍存在、取消時無變更。

## 6. Quick Settings Popover

- [x] 6.1 實作 Quick Settings Popover（quick settings popover 實作方式）含 Language Selection 與 All Settings Link：建立 `src/lib/components/layout/QuickSettingsPopover.tsx`，使用 absolute 定位附著於 Sidebar 底部 gear button 上方。內容包含 theme 三選一（Dark/Light/System，當前選擇以 accent 色標示）、language 選擇（en/zh-TW）、底部分隔線後「All Settings」連結（react-router `Link` 導向 `/felina-settings`，點擊後關閉 popover）。點擊 popover 外部自動關閉（mousedown + ref 偵測）。完成條件是 `npm run check` 通過。
- [x] 6.2 修改 Sidebar 整合 popover：修改 `src/lib/components/layout/Sidebar.tsx`，將底部 LanguageSwitcher 與 theme toggle 替換為單一 gear icon button + `QuickSettingsPopover`。完成條件是 Sidebar 底部只顯示 gear button，popover 開關行為正確。

## 7. Settings Page 清理與 i18n

- [x] 7.1 修改 Settings Page Agent Paths Section — 從 Settings page 移除 Agent Paths：修改 `src/lib/components/settings/SettingsPage.tsx`，不再 render `AgentPathsSection`。完成條件是 Settings page 不顯示 Agent Paths 區塊，其餘 Claude settings 行為不變。
- [x] 7.2 新增 i18n 文案：在 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts` 補齊 Quick Settings Popover（theme labels、language labels、All Settings）、Felina Settings page title、Saved Known Projects（section title、description、empty state、remove confirm title/body、remove error）文案。完成條件是 `TranslationDict` 結構對齊並通過 `npm run check`。

## 8. Verification

- [x] 8.1 執行 frontend static gate：`npm run check` 不新增 TypeScript errors，相對 1.1 baseline 無 regression。
- [x] 8.2 執行 Rust verification：在 `src-tauri/` 跑 `cargo test` 針對 `known_projects` 相關的 narrow scope，完成條件是 saved-only listing tests 通過。
- [x] 8.3 執行 backend build verification：在 `src-tauri/` 跑 `cargo build`，完成條件是無錯誤。
- [x] 8.4 執行 UI manual verification：用 `npm run tauri dev` 驗證：Sidebar 底部 gear icon 開啟 Quick Settings Popover；Popover 中 theme 三選一含 System 即時跟隨 OS 偏好；語言切換正常；All Settings 導向 Felina Settings page；Felina Settings 顯示 Agent Paths 與 Saved Known Projects；透過 Add Target Browse 加入 project 後 Felina Settings 顯示 saved entry；移除後 entry 消失且 folder 未刪除；Settings page 不再顯示 Agent Paths 且 Claude settings 行為正常。
