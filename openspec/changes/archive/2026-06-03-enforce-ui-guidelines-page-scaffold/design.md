## Context

目前的 Felina 專案有 `@felina-ui-guidelines` 規範，其中明確要求：
1. 頂層頁面必須使用共用元件 `<PageScaffold>`（包含 `<PageHeader>` 與 `<PageBody>`）。
2. 清單與背景設計必須走「去線條化」與「毛玻璃（Glassmorphism）」風格，以便讓底層的 `<ShapeGrid>` 幾何動畫透出。

目前 `TokensPage`、`MemoryPage`、`HistoryPage`、`FelinaSettingsPage` 四個頁面尚未套用 `<PageScaffold>`。且 `MemoryPage`、`HistoryPage`、`SkillsPage` 與 `ProjectsPage` 的主要清單依賴寫死的實體邊框 (`border-l-2` / `border-r-2`) 或實心背景 (`bg-bg-secondary` / `hover:bg-bg-secondary/50`) 來標示選中與懸浮狀態，造成各頁 list row 的視覺語彙不一致。

## Goals / Non-Goals

**Goals:**
- 將四個主要頁面的頂層結構切換為 `<PageScaffold>`。
- 擴充 `<PageHeader>` 支援 `bottomSlot` 以應付如 `TokensPage` 的分頁標籤 (Tabs)。
- 替換主工作流清單樣式為統一毛玻璃風格 (`backdrop-blur`)，涵蓋 History session list、Memory project list、Skills skill list、Projects known project list 與 Projects managed inventory rows。

**Non-Goals:**
- 不重構 `TokensPage` 內的 `<table>` 標籤。
- 不重構 `SkillsPage` / `ProjectsPage` 內部已存在的 panel layout、排序、篩選、資料流、匯入或編輯行為。
- 不將 Tokens analytics table/list 納入本次清單統一；該資料表卡片化需另案處理。
- 不修改後端指令與 API 介面。

## Decisions

- **`<PageHeader>` 擴充 `bottomSlot`**:
  - *Rationale*: 原本的 `<PageHeader>` 只有 title 與右側 actions。新增 `bottomSlot?: ReactNode` 可以容納 `TokensPage` 的 Tabs 導覽列，確保 header 下邊框能正確包覆 Tabs，無需在各頁面外掛獨立元件。
- **毛玻璃 (Glassmorphism) 選中狀態實作**:
  - *Rationale*: 捨棄 `border-l-2` 等硬邊框後，單純的半透明背景可能不易辨識選中項。因此，我們對 hover 狀態使用 `bg-bg-secondary/40 backdrop-blur-md`，對 active 狀態使用更高亮度的 `bg-accent/15 backdrop-blur-md border border-accent/20` 或相似高對比度的設定。這能保持透視感同時維持對比度。
- **統一主工作流清單 visual treatment**:
  - *Rationale*: 若只有 History 與 Memory 採用 glassmorphism，Skills 與 Projects 的主要清單仍使用實心 selected/hover 背景，使用者會感覺各頁風格分裂。因此主工作流清單 row 應共用同一套 class 語彙：normal row 使用淡透明背景與低透明 border，hover row 使用更亮的半透明背景與 `backdrop-blur-xl`，selected row 使用 `bg-accent/18` 或同等透明 accent 背景、`border-accent/25` 與陰影。這只改 visual class，不改變 row 的排序、選取、匯入、push 或 navigation 行為。

## Implementation Contract

- **Behavior**: 使用者瀏覽 Tokens, Memory, History, Felina Settings 頁面時，將看到標準化的 PageHeader 與統一的 padding 排版。瀏覽 History session list、Memory project list、Skills skill list、Projects known project list 與 Projects managed inventory rows 時，normal/hover/selected 效果將呈現一致的半透明透視感，可看見背景動畫，且不再使用粗硬左/右邊框或實心 selected/hover 背景作為主要狀態提示。
- **Interface / data shape**: `<PageHeader>` 介面新增 `bottomSlot?: ReactNode` 屬性。
- **Failure modes**: 視覺排版破裂，如 Tabs 未能正確對齊或出現雙重捲軸。
- **Acceptance criteria**: 執行 `npm run tauri dev` 並開啟 Tokens, Memory, History, Felina Settings, Skills, Projects 頁面，肉眼確認 `TokensPage` 的標籤列正常顯示於 Header 內，且 History、Memory、Skills、Projects 的主要清單 hover/selected 狀態採用一致半透明玻璃效果，無粗硬狀態邊框或實心 selected/hover 背景。
- **Scope boundaries**: 僅限於前端 UI class 與外層 `div` 元件結構替換，不得變動內部業務邏輯、後端 API、路由、資料查詢、排序、篩選、匯入、push 或 Tokens analytics table 結構。

## Risks / Trade-offs

- [Risk] `bottomSlot` 可能導致 `<PageHeader>` 預設的下邊框與內部 tab 的底線衝突。
  - Mitigation: `TokensPage` 的 Tabs 使用時不應自帶下邊框，或者 `<PageHeader>` 在有 `bottomSlot` 傳入時移除自身 `border-b`，交由 slot 內容負責。
