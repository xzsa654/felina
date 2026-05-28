## Why

目前 Sidebar 底部堆疊了語言切換與主題切換按鈕，佔用空間且不易擴充。同時，現有 Settings Page 混合了 Claude 專屬設定與 Felina 自身本地偏好（Agent Paths），邊界模糊。此外，`~/.felina/known-projects.json` 中的手動保存 project path 沒有專屬管理入口，使用者無法主動檢視或移除仍然存在的 saved entries。

本 change 建立 Quick Settings Popover 整合高頻 UI 偏好切換，並新增獨立的 Felina Settings 頁面承載 app-level 設定（Agent Paths + Saved Known Projects 管理），讓 Claude Settings 頁面專注於 Claude 設定。

## What Changes

- 將 Sidebar 底部的 theme 與 language 切換控制項合併為單一 gear icon 按鈕。
- 點擊 gear icon 向上展開 Quick Settings Popover，提供：主題切換（新增 System 自動偵測選項）、語言切換。
- Popover 底部提供「All Settings」連結，導向新建的 Felina Settings 頁面（`/felina-settings`，不顯示在 Sidebar 主導航）。
- Felina Settings 頁面承載 Agent Paths（從現有 Settings page 搬出）與 Saved Known Projects 管理。
- Saved Known Projects 清單只呈現 `~/.felina/known-projects.json` 的 saved entries，不包含 current cwd 或 auto-detected entries。
- 使用者可移除 saved entry；移除只更新 Felina saved 清單，不刪除實體資料夾、不修改 canonical skills 或 targets。
- 後端新增 `known_projects_saved_list` command，提供 saved-only read contract。
- 現有 Settings page 保留 Claude settings editor 現況，不再顯示 Agent Paths。

## Non-Goals

- 不重命名或重構現有 Settings page 的 Claude settings editor。
- 不改變 `known_projects_list` 的三來源合併 contract。
- 不提供 detected/cwd-only project 的移除能力。
- 不刪除任何 project 資料夾、agent-native skill files、canonical skills 或 targets。
- 不新增 project path 編輯、重新命名或批次匯入功能。
- 不遷移 budget / plan display settings。
- 不將 Felina Settings 頁面加入 Sidebar 主導航列。

## Capabilities

### New Capabilities

- `quick-settings-panel`: Sidebar 底部彈出式快速設定面板的行為，包含 theme（含 system 模式）與 language 切換。
- `felina-settings-page`: 專屬 Felina 本地偏好設定頁面的結構、路由與內容（Agent Paths、Saved Known Projects）。

### Modified Capabilities

- `app-pages`: 現有 Settings page 移除 Agent Paths 區塊，補充 Felina Settings 頁面定位。
- `app-routing`: 支援不顯示於 Sidebar 的 Felina Settings 頁面路由。
- `known-projects`: 新增 saved-only Known Projects read contract，供 Felina Settings 頁面列出並管理手動保存路徑。

## Impact

- Affected specs: `quick-settings-panel`, `felina-settings-page`, `app-pages`, `app-routing`, `known-projects`
- Affected code:
  - New: `src/lib/components/layout/QuickSettingsPopover.tsx`
  - New: `src/lib/components/settings/FelinaSettingsPage.tsx`
  - New: `src/lib/components/settings/SavedKnownProjectsSection.tsx`
  - Modified: `src/lib/components/layout/Sidebar.tsx`
  - Modified: `src/lib/stores/theme.ts`
  - Modified: `src/router.tsx`
  - Modified: `src/lib/stores/navigation.ts`
  - Modified: `src/lib/components/settings/SettingsPage.tsx`
  - Modified: `src/lib/tauri/commands.ts`
  - Modified: `src-tauri/src/commands/known_projects.rs`
  - Modified: `src-tauri/src/commands/mod.rs`
  - Modified: `src-tauri/src/lib.rs`
  - Modified: `src/lib/i18n/locales/en.ts`
  - Modified: `src/lib/i18n/locales/zh-TW.ts`
- Dependencies: 無新增 npm 或 Cargo dependency。
- Compatibility: 既有 `known_projects_list`、Projects page、saved file schema、`known_projects_add/remove`、Claude settings read/write 行為維持不變。
