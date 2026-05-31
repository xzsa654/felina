# ProjectsPage UI 重構方針 (討論中)

為了解決 `ProjectsPage.tsx` 中 `ManagedInventory` 過於強烈的「傳統後台表格感」，並凸顯其作為「專案掃描器與收件匣」的真實用途，制定以下 UI 調整方針：

## 1. 核心定位：從「資料表」轉向「收件匣與盤點」
Projects 頁面的右側重點不在於單純列出資料，而是兩大核心任務：
* **發現與匯入 (Discovery & Import)**：揪出專案內的野生 Agent 技能。
* **審查與盤點 (Audit)**：檢視專案目前套用的受控技能。

## 2. 頂部摘要 (Project Summary Header)
* 在右側面板的最上方，加入大字體的專案名稱或路徑。
* 緊接在下方提供清晰的狀態數據摘要（例如：`2 Discovered` • `5 Managed`），讓使用者一眼掌握該專案的健康度與待辦事項。

## 3. 去表格化與視覺一致性 (Table-less Design)
* **捨棄傳統 `<table>`**：拿掉生硬的表頭與框線，改為現代化的清單元件（List View / Cards），利用 Flex 佈局與留白引導視覺。
* **Agent Chips 一致性**：目前專案列表中的 Agent 標籤（如 Anthropic, Gemini）必須與 `SkillEditor` 頂部的 Target Chips 採用完全相同的 Design System（顏色、Typography、圓角），確保全站體驗統一。
* **狀態標示融入**：移除獨立的 Status 欄位，將狀態以更低調的方式（如標題顏色深淺或小型 Badge）融入清單項目中。

## 4. 匯入流程優化 (Import Workflow)
* 針對 Multi-source（多來源衝突，例如本地同時有 `.claude` 與 `.gemini` 同名技能）的匯入流程，捨棄擁擠在表格內的 radio button。
* 改為優雅的 **內嵌抽屜 (Inline Drawer)** 展開，內部提供清晰的卡片（Selectable Cards）讓使用者二選一。

---

## ⚠️ 待確認的開放性問題 (Open Questions)

### Q1: Discovered 與 Managed 區塊的排版結構？
在去表格化後，待匯入的野生技能（Discovered）與已受控技能（Managed）該如何呈現，目前保留兩個選項待日後定案：

* **選項 A：上下堆疊 (Stacked Sections)**
  - 邏輯：「收件匣」優先。
  - 上方固定顯示 Discovered 區塊，下方顯示 Managed 區塊。強迫使用者一進來就先看到需要處理的匯入任務。若無待處理任務則隱藏上方區塊。
* **選項 B：分頁形式 (Tabbed Layout)**
  - 邏輯：介面極簡乾淨。
  - 採用與 SkillEditor 相同的分頁列，分為 `Discovered` 與 `Managed` 兩頁。
  - 防呆機制：若有待處理任務，Tab 標籤上需顯示數字 Badge（如 `Discovered (2)`），且進入專案時預設切換至該分頁。
