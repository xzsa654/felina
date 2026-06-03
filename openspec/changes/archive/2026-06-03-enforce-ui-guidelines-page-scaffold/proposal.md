## Why

目前系統內的四個主要頁面（TokensPage、MemoryPage、HistoryPage、FelinaSettingsPage）遺漏了共用的 `<PageScaffold>` (包含 `<PageHeader>` 與 `<PageBody>`)，並使用手刻的 `div` 排版，違反了 `felina-ui-guidelines` 規定的「文件中心化」與「強制使用 Page Scaffold」準則。此外，MemoryPage、HistoryPage、SkillsPage 與 ProjectsPage 的主要清單仍混用實心背景、硬邊框與不同 hover/selected 規則，阻擋了底層的 `<ShapeGrid>` 幾何動畫，缺乏一致的毛玻璃（Glassmorphism）沉浸感。為確保全站 UI 體驗的一致性與高級感，我們必須將這些介面元件對齊最新規範。

## What Changes

- **擴充 `<PageHeader>` 元件**：新增 `bottomSlot?: ReactNode` 屬性，用以容納如 TokensPage 的次級導覽分頁（Tabs）。
- **頁面骨架升級**：將 `TokensPage`、`MemoryPage`、`HistoryPage` 與 `FelinaSettingsPage` 的外層容器替換為 `<PageHeader>` 和 `<PageBody>`，移除舊有的硬刻 padding。
- **主要清單毛玻璃化**：重構 `MemoryPage` (專案列表)、`HistoryPage` (對話列表)、`SkillsPage` (skill list)、`ProjectsPage` (known projects list 與 managed inventory rows) 的選項狀態，移除 `border-l-2` / `border-r-2` 等硬邊框與實心 selected/hover 背景，改用半透明 row、`backdrop-blur` 模糊效果與低透明邊緣微光，讓底層背景動畫自然透出，並賦予 active 狀態更高的亮度區隔。
- **玻璃基礎設施與 light mode 視覺修正**（驗證階段擴充）：
  - 新增 `--color-accent-soft` token（dark 15% 紫霓光 / light 6% 淡紫），`glassListSelectedRowClass` 改用此 token，解決 light mode `bg-accent/15` 在白底上呈現「飽和粉紫色塊」、奪走文字焦點的問題。
  - 新增 `--color-glass-surface` / `--color-glass-surface-border` token（light 較強對比、dark 維持淡色），`glassListSurfaceClass` 改用 token，讓 light mode 清單面板能與頁面背景產生視覺區分。
  - 新增 `.app-gradient-layer` 柔和徑向漸層層，放在 `<main>` 最底、`<ShapeGrid>` 之下；提供 `backdrop-blur` 可糊的色彩內容（原本 ShapeGrid 僅描邊六角線條，blur 後幾乎無視覺差異）。
  - `<ShapeGrid>` 的 `borderColor` 與 wrapper `opacity` 改為 theme-aware（light: `#8b5cf6` / 30%、dark: `#3a3a3a` / 15%）。
  - `glassListRowClass` 移除未選取狀態的預設 `border-white/[0.03]` 與 `bg-white/[0.025]`，改用 `border-transparent` 佔位避免 selected ↔ unselected 切換時 layout shift；row idle 完全透視底層動畫。
  - `ProjectsPage` 預設選取改為 `null`（移除 cwd / list[0] fallback），讓使用者主動選取；`ProjectsList` 的 `<ul>` 加 `py-2` 避免第一列 selected border 與外層 Panel 容器 border 重疊。

## Non-Goals

- 不處理 TokensPage 內部的 `<table>` 標籤或 analytics data table row 結構（這將在未來的「數據報表卡片化」變更中處理）。
- 不重構 `SkillsPage` / `ProjectsPage` 的 `ResizablePanel`、資料流、排序、篩選、匯入或編輯邏輯；僅統一主要清單 row 的 visual treatment。
- 不改變任何後端 Tauri command 或資料流行為。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-pages`: 強制推廣 Page Scaffold 至 Tokens, Memory, History, Settings 四個頁面，並統一主工作流清單的 glassmorphism visual treatment。
- `history-page`: 移除寫死的 border 標示，導入毛玻璃 UI。
- `felina-settings-page`: 套用標準 PageHeader 與 PageBody 結構。
- `token-analytics-dashboard`: 標題列遷移至 PageHeader 並將 Tabs 放進 bottomSlot。

## Impact

- Affected specs: `app-pages`, `history-page`, `felina-settings-page`, `token-analytics-dashboard`
- Affected code:
  - Modified: `src/lib/components/shared/PageScaffold.tsx`
  - Modified: `src/lib/components/tokens/TokensPage.tsx`
  - Modified: `src/lib/components/memory/MemoryPage.tsx`
  - Modified: `src/lib/components/history/HistoryPage.tsx`
  - Modified: `src/lib/components/settings/FelinaSettingsPage.tsx`
  - Modified: `src/lib/components/skills/SkillList.tsx`
  - Modified: `src/lib/components/projects/ProjectsList.tsx`
  - Modified: `src/lib/components/projects/ManagedInventory.tsx`
  - Modified: `src/lib/components/projects/ProjectsPage.tsx`
  - Modified: `src/app.css`
  - Modified: `src/router.tsx`
