# ProjectsPage UI 重構方針 (討論中)

為解決 `ProjectsPage.tsx` 中 `ManagedInventory` 過於強烈的「傳統後台表格感」，以「收件匣與盤點」為核心理念重新設計，並與 SkillEditor 重構後的極簡現代風格對齊。

## 實作進度總覽

| Section | 項目 | 狀態 | Spectra Change |
|---------|------|------|----------------|
| 1 | 核心定位轉向 | ⬜ 未實作 | — |
| 2 | Project Summary Header | ⬜ 未實作 | — |
| 3 | 去表格化（Discovered/Managed 清單化）| ⬜ 未實作 | — |
| 4 | Agent Chips Design System 統一 | ⬜ 未實作 | — |
| 5 | Import 流程（Inline Drawer） | ⬜ 未實作 | — |
| 6 | 狀態標示融入 | ⬜ 未實作 | — |

---

## 項目定義

### 1. 核心定位轉向

從「資料表」轉向「收件匣與盤點」。右側面板的兩大核心任務：
- **發現與匯入 (Discovery & Import)**：揪出專案內的野生 Agent 技能
- **審查與盤點 (Audit)**：檢視專案目前套用的受控技能

### 2. Project Summary Header

右側面板頂部加入大字體專案名稱（或路徑末段），下方提供狀態數據摘要（例如 `2 Discovered · 5 Managed`），一眼掌握該專案的健康度。

### 3. 去表格化（Discovered/Managed 清單化）

捨棄傳統 `<table>` 的 `ManagedInventory`，改為現代化清單元件。利用 Flex 佈局與留白引導視覺。

**排版結構（建議選項 A：上下堆疊）**：
- 上方固定顯示 Discovered 區塊（收件匣優先），下方顯示 Managed 區塊
- 無待處理時 Discovered 區塊隱藏，只剩 Managed
- 理由：Discovered 數量少且短暫（處理完消失），放頂部符合心智模型；分頁多一步切換成本

### 4. Agent Chips Design System 統一

專案列表中的 Agent 標籤必須與 SkillEditor 的 Target Chips 採用相同 Design System（語意色、Typography、圓角）。目前 `ManagedInventory` 使用 `AGENT_CHIP_LABEL` 硬編碼文字，需改為與 SkillList brand icon 一致的呈現。

### 5. Import 流程（Inline Drawer）

Multi-source 衝突匯入（本地同時有 `.claude` 與 `.gemini` 同名技能）的處理：
- 捨棄表格內的 radio button
- 改為 Inline Drawer 展開，內部提供 Selectable Cards 二選一
- 互動模式與 SkillEditor 的 TargetPopover 一致（同時只開一個、click-outside 關閉）

### 6. 狀態標示融入

移除獨立 Status 欄位，狀態以低調方式融入清單項目：
- 標題顏色深淺或小型 Badge
- 與 SkillList 的 Action Required / All Skills 分組邏輯保持一致的設計語言

---

## 整體版面結構

```
┌──────────────┬───────────────────────────────────────┐
│              │ my-project                            │ ← Project Summary Header
│  Projects    │ 2 Discovered · 5 Managed              │ ← 狀態數據摘要
│  List        ├───────────────────────────────────────┤
│              │ ┌─ Discovered (收件匣) ──────────────┐│
│  ● proj-a    │ │ wild-skill-1  [claude] [Import ▸]  ││ ← 清單 + Inline Drawer
│  ○ proj-b    │ │ wild-skill-2  [gemini] [Import ▸]  ││
│  ○ proj-c    │ └────────────────────────────────────┘│
│              │ ┌─ Managed ──────────────────────────┐│
│              │ │ code-review   claude·global ✓       ││ ← 清單 + 狀態 Badge
│              │ │ search-helper gemini·project ●      ││
│              │ │ ...                                 ││
│              │ └────────────────────────────────────┘│
└──────────────┴───────────────────────────────────────┘
```

## 現有程式碼結構

| 檔案 | 用途 | 重構影響 |
|------|------|---------|
| `ProjectsPage.tsx` | 頂層：左側 ProjectsList + 右側 ManagedInventory | 右側加 Summary Header |
| `ProjectsList.tsx` | 左側專案清單 | 影響小 |
| `ManagedInventory.tsx` | 右側表格 + import 流程 | **主要重構目標** |
| `managed-inventory.ts` | buildInventoryRows 資料邏輯 | 可能需調整 row 結構 |
