## Context

目前 Sidebar 底部放置 LanguageSwitcher 與 theme toggle（Sun/Moon icon），佔兩個獨立控制項。現有 Settings page 混合 Claude settings editor 與 Felina 本地偏好（Agent Paths）。`~/.felina/known-projects.json` 的 saved entries 沒有獨立管理介面。

可重用既有元件：

- `src/lib/components/shared/ConfirmDialog.tsx`：移除 saved entry 前的確認對話框
- `src/lib/components/settings/AgentPathsSection.tsx`：複用既有 Agent Paths UI
- `src/lib/utils/path.ts`：前端 path identity 比對
- `src/lib/tauri/commands.ts`：新增 typed wrapper

## Goals / Non-Goals

**Goals:**

- 在 Sidebar 底部以單一 gear icon 取代散落的 theme/language 控制項，點擊後展開 Quick Settings Popover。
- Popover 提供 theme 切換（含 System 自動偵測）與語言切換。
- Popover 底部提供「All Settings」連結導向 `/felina-settings` 路由頁面。
- Felina Settings 頁面承載 Agent Paths（從 Settings page 搬出）與 Saved Known Projects 管理。
- 後端新增 `known_projects_saved_list` command 提供 saved-only read contract。

**Non-Goals:**

- 不重命名或重構 Settings page 的 Claude settings 部分。
- 不改變 `known_projects_list` 三來源合併 contract。
- 不提供 detected/cwd-only project 移除能力。
- 不刪除任何實體資料夾或 agent files。
- 不新增第三方 npm 或 Cargo dependency。
- 不遷移 budget / plan display settings。

## Decisions

### Quick Settings Popover 實作方式

使用 absolute 定位的 popover 元件 `QuickSettingsPopover.tsx`，附著於 Sidebar 底部 gear button 上方。點擊按鈕 toggle 開關，點擊 popover 外部自動關閉（`mousedown` 事件 + ref 偵測）。

Popover 內容：
- Theme 區塊：三個選項按鈕（Dark / Light / System），以 radio-group 形式呈現，當前選擇以 accent 色標示。
- Language 區塊：沿用既有 LanguageSwitcher 的選項呈現方式（en / zh-TW）。
- 底部分隔線後放「All Settings」連結，使用 react-router `Link` 導向 `/felina-settings`，點擊後同時關閉 popover。

替代方案：Modal 過於干擾、Drawer 遮擋主畫面。Popover 最符合高頻輕量操作特性。

### Theme 支援 System 模式

擴充 `src/lib/stores/theme.ts`：

- `ThemePreference` 型別改為 `"dark" | "light" | "system"`，代表使用者選擇。
- `resolvedTheme` 衍生值永遠是 `"dark" | "light"`，供 `data-theme` 使用。
- 選擇 `system` 時，透過 `window.matchMedia('(prefers-color-scheme: dark)')` 決定 resolvedTheme，並監聽 `change` 事件即時切換。
- `localStorage` 儲存的值改為 `ThemePreference`（含 `"system"`）。
- 舊版 localStorage 值（`"dark"` / `"light"`）自然相容，不需 migration。
- `toggleTheme` 保留但循環順序改為 dark → light → system → dark。

替代方案：只保留 dark/light。但桌面軟體慣例需提供跟隨系統選項。

### Felina Settings 頁面路由

在 `src/router.tsx` 新增 `/felina-settings` 路由，lazy load `FelinaSettingsPage`。此頁面不加入 `NAV_ITEMS`（不出現在 Sidebar 導航），使用者只能從 Quick Settings Popover 的「All Settings」連結進入。

`Page` type union 與 `NAV_ITEMS` array 不變。`/felina-settings` 是 app layout 的子路由但不在導航列中，與 `app-pages` spec 的 registered pages 要求不衝突（那個 spec 管的是 sidebar 導航項目）。

### Saved-only backend contract

新增 `known_projects_saved_list` command：直接讀取 `KnownProjectsStore.projects`，回傳 saved-only `KnownProject[]`。每個 entry 的 `sources` 固定含 `saved`，`exists` 由 filesystem stat 決定。缺檔或 malformed store 回傳空陣列。

選擇 saved-only API 而非前端過濾 `known_projects_list` 的原因：Felina Settings 的語意是管理 `known-projects.json` 這份手動清單；同一路徑可能同時是 saved + detected，前端過濾合併結果會讓 UI 解釋成本變高。

### Felina Settings 頁面內容

`FelinaSettingsPage.tsx` 使用與其他頁面一致的 layout 結構（Header + scrollable content area）。包含兩個 section：

1. **Agent Paths**：複用既有 `AgentPathsSection`，從 Settings page 移出。Settings page 不再 render 此區塊。
2. **Saved Known Projects**：新增 `SavedKnownProjectsSection`，列出 saved-only paths，顯示 exists/missing 狀態，提供 remove action。移除前使用 `ConfirmDialog`，確認文案明確說明只移除 Felina saved entry、不刪資料夾。移除成功後重新載入 saved list，失敗時顯示 inline error。Empty state 顯示引導文案。

### Remove 行為邊界

移除 saved project 呼叫既有 `known_projects_remove(path)`。UI copy 明確說明不刪除檔案系統內容。此功能讀寫使用者本機 Felina state（`~/.felina/known-projects.json`），但不刪除檔案——安全風險主要是語意誤解，以確認對話框降低。

### 路徑正規化邊界

後端沿用 `known_projects::normalize_path`。前端顯示後端回傳 path，path identity 比對使用 `normalizeProjectPath`，不寫 ad hoc `.toLowerCase()`。

## Implementation Contract

**Behavior:**

- Sidebar 底部 gear icon 取代原有 language switcher 和 theme toggle。
- 點擊 gear 展開 Quick Settings Popover，再點擊或點擊外部關閉。
- Popover 提供 Dark / Light / System 三選一 theme 切換，以及 en / zh-TW 語言切換。
- System theme 即時跟隨 OS 偏好，切換結果持久化至 localStorage。
- Popover 底部「All Settings」連結導向 `/felina-settings`。
- Felina Settings 頁面顯示 Agent Paths 和 Saved Known Projects 兩個 section。
- Settings page 不再顯示 Agent Paths，其餘 Claude settings 行為不變。
- Saved Known Projects 只列出 `~/.felina/known-projects.json` 中的 saved entries。
- 每個 saved row 顯示 path 和 folder 是否存在。
- 移除 saved row 只移除 saved entry，不刪除資料夾或 agent files。
- 移除後 saved list 自動刷新。

**Interface / data shape:**

- 新增 Tauri command `known_projects_saved_list`，回傳 `Vec<KnownProject>`（沿用現有序列化 shape）。
- 前端 typed wrapper：`commands.ts` 新增 `knownProjects.savedList()`。
- `ThemePreference = "dark" | "light" | "system"`，localStorage key 不變（`felina-theme`）。
- `resolvedTheme` 衍生值永遠是 `"dark" | "light"`。

**Failure modes:**

- Saved list 讀取失敗（檔案缺失或 malformed）→ 顯示空清單，不阻塞。
- Remove 失敗 → inline error，row 保持可見直到下次成功刷新。
- Missing project folders → 標示為 missing 但仍可移除。

**Acceptance criteria:**

- `npm run check` 無新增 TypeScript errors。
- Rust tests 覆蓋 saved-only list：missing store、saved existing path、saved missing path。
- `cargo build` 在 `src-tauri/` 無錯誤。
- 手動 `npm run tauri dev` 驗證：gear icon 展開 popover、theme 三選一含 system 模式、語言切換、All Settings 導向 Felina Settings page、Agent Paths 在 Felina Settings 而非 Settings page、Saved Known Projects 列出 saved entries、移除後 entry 消失且 folder 未刪除。

**Scope boundaries:**

- In scope：Quick Settings Popover、theme system 模式、Felina Settings page 路由、Agent Paths 搬遷、Saved Known Projects section、backend saved-only command、i18n 文案、targeted Rust tests。
- Out of scope：Settings page IA 重構、Claude settings 改動、detected/cwd project 移除、filesystem 刪除、path editing、budget/plan settings 遷移。

## Risks / Trade-offs

- [Risk] `window.matchMedia` listener 未正確清理造成 memory leak。→ Mitigation：在 store subscribe/unsubscribe 或 useEffect cleanup 中移除 listener。
- [Risk] 使用者以為 remove 會刪除 project folder。→ Mitigation：ConfirmDialog 文案明確說明只移除 saved entry。
- [Risk] 新增 `known_projects_saved_list` 與 `known_projects_list` 部分重複。→ Mitigation：共用 `read_store`、`normalize_path`、`KnownProject` shape，新 command 邏輯極薄。
- [Risk] Agent Paths 搬遷後使用者在 Settings 找不到。→ Mitigation：gear icon 位置靠近原本的 theme/language controls，直覺可見。
- [Risk] Command registration 遺漏。→ Mitigation：tasks 包含 mod.rs export + invoke_handler 註冊 + frontend wrapper 三步驟。

## Migration Plan

無資料遷移。既有 `known-projects.json` 與 agent path 設定維持有效。Rollback 只需移除新增元件與 command，將 Agent Paths render 恢復到 Settings page。
