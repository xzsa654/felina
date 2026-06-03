## 1. 準備階段 (Preparation)

- [x] 1.1 執行 baseline 檢查: 執行 `npm run check` 紀錄現有 TypeScript errors/warnings，以利後續比對，確認沒有引入新的編譯錯誤。(驗證: 產出 baseline 報告或截圖留存)

## 2. 基礎元件修改 (Shared Components)

- [x] 2.1 實作 `<PageHeader> 擴充 bottomSlot`: 修改 `src/lib/components/shared/PageScaffold.tsx`，為 `<PageHeader>` 介面增加 `bottomSlot?: ReactNode`。在渲染時將其放置於標題與 actions 區塊之下。這能滿足未來放入 Tabs 的排版需求。(驗證: `npm run check` 通過，且元件能正常接受並渲染 `bottomSlot` prop)

## 3. 頁面遷移與樣式升級 (Page Migrations)

- [x] [P] 3.1 遷移 `FelinaSettingsPage`: 編輯 `src/lib/components/settings/FelinaSettingsPage.tsx`，拔除舊有手刻的 padding 容器，並套用 `<PageHeader>` 與 `<PageBody>`，以滿足 "Requirement: Felina Settings Page" 與 "Requirement: Top-Level Page Scaffold Usage" 規範。(驗證: `npm run check` 通過，無佈局破裂)
- [x] [P] 3.2 遷移 `TokensPage`: 編輯 `src/lib/components/tokens/TokensPage.tsx`，套用 `<PageHeader>` 與 `<PageBody>`，並將導覽 Tabs 放入 `bottomSlot` 中。滿足 "Requirement: TokensPage replaces AnalyticsPage" 與 "Requirement: Top-Level Page Scaffold Usage"。(驗證: `npm run check` 通過，且 Tabs 成功掛載於標題列下方)
- [x] [P] 3.3 遷移 `HistoryPage` 與清單樣式: 編輯 `src/lib/components/history/HistoryPage.tsx`，套用外層骨架並針對左側會話清單實作 "Requirement: Glassmorphism List Styles" 與 "毛玻璃 (Glassmorphism) 選中狀態實作"。拔除 `border-l-2` 等硬邊框，改用 `backdrop-blur-md` 搭配半透明背景色 (例如 hover 為 `bg-bg-secondary/40`, active 為 `bg-accent/15 border border-accent/20`)。(驗證: `npm run check` 通過，且肉眼觀察無粗硬邊框)
- [x] [P] 3.4 遷移 `MemoryPage` 與清單樣式: 編輯 `src/lib/components/memory/MemoryPage.tsx`，套用外層骨架，並針對左側專案清單實作 "Requirement: Top-Level Page Scaffold Usage" 與 "毛玻璃 (Glassmorphism) 選中狀態實作"，比照 HistoryPage 移除硬邊框並導入透視感樣式。(驗證: `npm run check` 通過，樣式類別已切換為半透明透視設定)
- [x] [P] 3.5 統一 `SkillList` 清單 row 風格: 編輯 `src/lib/components/skills/SkillList.tsx`，使 canonical skill rows 與 broken rows 符合 "Requirement: Unified Glassmorphism List Treatment" 與 "統一主工作流清單 visual treatment"；selected/hover 狀態不得使用實心 `bg-bg-secondary` 作為主要狀態提示，需改用半透明背景、低透明 border、`backdrop-blur` 與 selected accent treatment，且不得改變排序、搜尋、push、drift icon 或選取行為。(驗證: `npm run check` 通過，且手動檢視 Skills list normal/hover/selected row 與 History/Memory 清單風格一致)
- [x] [P] 3.6 統一 `ProjectsList` 與 `ManagedInventory` 清單 row 風格: 編輯 `src/lib/components/projects/ProjectsList.tsx` 與 `src/lib/components/projects/ManagedInventory.tsx`，使 known projects list 與 managed inventory rows 符合 "Requirement: Unified Glassmorphism List Treatment" 與 "統一主工作流清單 visual treatment"；selected/hover/actionable row 不得使用實心 `bg-bg-secondary` 或硬狀態邊框作為主要狀態提示，需改用半透明背景、低透明 border、`backdrop-blur` 與 selected accent treatment，且不得改變 project selection、remove、import、resolution 或 open-skill 行為。(驗證: `npm run check` 通過，且手動檢視 Projects 左側清單與右側 inventory row 與 Skills/History/Memory 清單風格一致)

## 4. 驗證 (Verification)

- [x] 4.1 執行迴歸編譯檢查: 執行 `npm run check`，對比 baseline 確認沒有引入任何新的型別或語法錯誤。(驗證: CLI 輸出錯誤數未增加)
- [x] 4.2 執行手動 UI 驗證: 執行 `npm run tauri dev` 並開啟 Tokens, Memory, History, Felina Settings, Skills, Projects 六個頁面。確認 Tokens 的 Tabs 正常顯示在 Header 下方且無雙重邊框，並確認 History、Memory、Skills、Projects 的主要清單 normal/hover/active 狀態已呈現一致半透明玻璃透視，無粗硬狀態邊框或死板實心 selected/hover 背景；Tokens analytics tables 不在本次視覺統一範圍內。(驗證: 實際肉眼確認符合 felina-ui-guidelines 視覺要求)

## 5. 驗證階段擴充修正 (Glass Infrastructure & Light Mode Fixes)

驗證階段（task 4.2）暴露的視覺問題與基礎設施補強，全部已在 session 內完成並通過使用者肉眼驗收。

- [x] 5.1 解耦 selected 紫色背景: `src/app.css` 新增 `--color-accent-soft`（dark `rgba(192,132,252,0.15)` / light `rgba(139,92,246,0.06)`），`PageScaffold.tsx` 的 `glassListSelectedRowClass` 由 `bg-accent/15` 改為 `bg-accent-soft`，解決 light mode 紫色奪焦。(驗證: 切換 light/dark 模式肉眼確認 selected row 在白底不再呈現飽和粉紫色塊)
- [x] 5.2 移除未選取 row 預設邊框與底色: `PageScaffold.tsx` 的 `glassListRowClass` 拔除 `border-white/[0.03]` 與 `bg-white/[0.025]`，改用 `border-transparent` 佔位防 layout shift；row idle 完全透視底層。(驗證: list 預設狀態無「每個項目自己一個框」的視覺)
- [x] 5.3 Surface tint theme-aware 化: `src/app.css` 新增 `--color-glass-surface` / `--color-glass-surface-border`（light 較強對比、dark 維持淡色），`PageScaffold.tsx` 的 `glassListSurfaceClass` 改用 token。(驗證: light mode 清單面板能與頁面背景視覺區分)
- [x] 5.4 加入柔和漸層層為 backdrop-blur 提供色彩底: `src/app.css` 新增 `.app-gradient-layer`（三組徑向漸層，theme-aware），`src/router.tsx` 在 `<main>` 內 `<ShapeGrid>` 之下渲染漸層 div。(驗證: 玻璃 surface 上能看出霧面效果)
- [x] 5.5 ShapeGrid theme-aware: `src/router.tsx` 引入 `useThemeStore`，依 `resolvedTheme` 切換 `borderColor`（light `#8b5cf6` / dark `#3a3a3a`）與 wrapper `opacity`（light 30% / dark 15%）。(驗證: light/dark 切換時六角網格皆有足夠對比)
- [x] 5.6 ProjectsPage 預設 unselect: `src/lib/components/projects/ProjectsPage.tsx` 的 `refresh()` 內 `setSelectedPath` fallback 由「cwd / list[0]」改為 `null`。(驗證: 進入 Projects 頁面預設無選取，需使用者主動點選)
- [x] 5.7 ProjectsList 第一列邊框避讓: `src/lib/components/projects/ProjectsList.tsx` 的 `<ul>` 加 `py-2`，避免 selected row border 與外層 Panel 容器 border 重疊。(驗證: 選取第一個 project 時 border 不與容器邊重疊)
