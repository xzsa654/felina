## Context

在 Skills 頁面的 `TargetEditor` 以及 Projects 頁面的 `ManagedInventory` 中，存在許多初學者難以理解的操作概念（例如 Auto/Manual/Disabled 同步模式、Pull、重新指向、多來源）。直接在每個按鈕旁加入 tooltip 會使畫面顯得擁擠。為了解決這個問題，我們決定在區塊標題旁提供一個統一的說明按鈕 (`?`)，點擊後以 Dialog 形式呈現該區塊的完整名詞解釋。

## Goals / Non-Goals

**Goals:**
- 提供一個可重用的 `InfoDialog` 元件，專門用來顯示文字說明的彈出視窗。
- 在 `TargetEditor` 的區塊標題旁加入說明按鈕，點擊顯示與 Target 相關的概念解釋。
- 在 `ManagedInventory` 的適當位置加入說明按鈕，點擊顯示與 Project 庫存相關的概念解釋。
- 確保所有新增的說明文案都有雙語翻譯 (en/zh-TW)。

**Non-Goals:**
- 不實作整頁式或步驟式的互動導覽（Guided Tour）。
- 不更動原本的按鈕位置或底層同步邏輯。

## Decisions

- **自製 `InfoDialog` 元件**：因為我們不依賴第三方 UI 庫，且現有的 `ConfirmDialog` 帶有確認/取消語意，不適合純資訊展示。我們將新增 `src/lib/components/shared/InfoDialog.tsx`，使用簡單的 fixed overlay 與中置容器，並提供一個關閉按鈕。
- **位置設計**：
  - `TargetEditor.tsx`: 尋找標題 `<h4>TARGETS</h4>`，在其右方補上一個帶有 `?` icon 的小按鈕。
  - `ProjectsPage` / `ManagedInventory`: 由於 `ManagedInventory` 本身是表格結構，我們可以在表格上方加入一個帶有標題與 `?` 按鈕的資訊列，或者修改其父元件在標題旁加入。
- **文案排版 (Formatting)**：為了讓說明文案能夠加粗關鍵字，`InfoDialog` 將接受 `ReactNode` 作為 `content`，由呼叫端透過組合多個 i18n keys（每個名詞一個 key）來渲染排版，而非依賴單一包含 `\n` 的超長字串。
- **說明文案範圍（討論後修訂）**：
  - **TargetEditor**：說明 Auto / Manual / Disabled 三種同步模式、Pull（drift 時覆寫主檔）、重新指向（變更目標專案資料夾）。不包含 Prune Orphans（功能可由刪除 target 時的選項取代，未來可移除按鈕）。
  - **ManagedInventory**：說明多來源（Multi Source）— 同一 Skill 存在於多個 Agent 目錄時需選擇匯入來源。
- **翻譯一致性**：i18n help 文案中的名詞必須與 UI 上的按鈕/標籤用詞一致。Pull 保持英文；重新指向保持中文；多來源統一用「多來源」。

## Implementation Contract

- **Behavior**: 
  - `TargetEditor` 標題旁有 `?` 圖示，點擊彈出說明框。
  - `ManagedInventory` 表格上方或標題旁有 `?` 圖示，點擊彈出說明框。
- **Interface / data shape**:
  - `InfoDialog` props: `open: boolean`, `title: string`, `content: ReactNode`, `onClose: () => void`.
- **Failure modes**: 純 UI 顯示組件，無特殊失敗情境。
- **Acceptance criteria**:
  - `npm run check` 通過，且雙語 i18n keys 結構完全對齊。
  - 點擊按鈕能正確彈出對應的 Dialog。
  - Dialog 內的文字排版清晰（各個名詞分段解釋），視窗支援點擊外部或 X 按鈕關閉。
- **Scope boundaries**: 僅限於前端 UI 與 i18n 檔案，不涉及任何 Rust 後端。

## Risks / Trade-offs

- **[Trade-off] Text length and formatting**: 長篇的說明文字寫在 i18n 字典檔中可能不易維護。
  - **Mitigation**: 將每一個名詞解釋獨立成一個 key（例如 `skills.targets.help.auto`），在 component 層級組裝，確保字典檔結構扁平易讀。
