## Context

目前 `SkillsPage` 使用固定的 CSS flex (或固定寬度) 來劃分左側清單 (Skill List) 與右側編輯器 (Skill Editor)。當內容過長或使用者需要更多編輯空間時，固定佈局造成了可用性問題。為了改善 UX，需要引進可拖曳調整大小的面板佈局。

## Goals / Non-Goals

**Goals:**
- 將 `SkillsPage` 的版面切割改由可調整大小的面板控制。
- 支援使用者用滑鼠拖曳中間的邊界來改變左右寬度。
- 左側列表可以完全收合 (Collapse)。
- 寬度偏好能在重新整理或重開應用後保留 (Persistent State)。

**Non-Goals:**
- 不套用任何第三方的 UI 樣式庫；把手 (Resizer) 與面板邊界仍使用手寫 Tailwind 樣式。
- 不實作垂直 (上下) 切割的調整。

## Decisions

- **選擇 `react-resizable-panels` 作為底層引擎**：它是一個無樣式的輕量組件，專為 React 與 Flexbox 設計。它能自動處理拖曳事件、寬度限制與收合邏輯，完美符合我們的「無第三方 UI 元件庫」規範，且比手刻 resize hook 穩定許多。
- **儲存偏好於 LocalStorage**：`react-resizable-panels` 原生支援 `autoSaveId` 屬性，可以直接將使用者調整的百分比尺寸存入瀏覽器的 LocalStorage。這對桌面應用來說足夠可靠，不需要特地透過 Tauri 存入檔案系統。

## Implementation Contract

- **Behavior**: 使用者在 `SkillsPage` 中可以看見左右區塊中間有一條拖曳把手。拖曳可即時改變左右區塊比例；將左側推至極限時可收合。重啟 App 時維持上次調整的比例。
- **Interface / data shape**: 引入 `<PanelGroup direction="horizontal" autoSaveId="felina-skills-layout">`，包含兩個 `<Panel>` 以及中間自訂的把手。
- **Failure modes**: 如果 localStorage 無法存取，面板預設顯示給定的 `defaultSize` 且不中斷渲染。
- **Acceptance criteria**:
  - `npm run check` 通過。
  - 開發模式下，滑鼠游標停在分割線上會有 resize 指標，並可順暢拖曳改變寬度。
  - 將左側寬度縮小至指定閥值時，觸發收合行為。
  - 重新整理網頁後，分割比例維持不變。
- **Scope boundaries**: 僅更動前端 `SkillsPage.tsx` 的佈局結構與新增一個把手元件，不涉及後端。

## Risks / Trade-offs

- **[Risk] 新增 npm 依賴** → 增加第三方套件維護成本。
  - **Mitigation**: `react-resizable-panels` 極度輕量且廣泛使用於諸多開源專案（如 shadcn/ui），風險極低。
