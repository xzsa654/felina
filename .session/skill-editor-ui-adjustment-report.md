# SkillEditor UI 重構方針 (2026-06-01 定案)

為解決 `SkillEditor.tsx` 排版混亂、填表感太重的問題，以「文件中心化」為核心理念重新設計。以下為討論後的定案方針：

## 實作進度總覽

| Section | 項目 | 狀態 | Spectra Change |
|---------|------|------|----------------|
| 1 | 風格一致性 | ✅ 已實作 | `skill-editor-document-header` |
| 2 | Document Header | ✅ 已實作 | `skill-editor-document-header` |
| 3 | Target Chips（基礎收合/展開） | ✅ 已實作 | `skill-editor-target-chips` |
| 3+ | Target Chips（SyncInfoBar 融合） | 📋 已 proposed | `skill-editor-target-sync-redesign`（已 parked） |
| 3++ | TargetEditor 展開態排版重構 | 📋 已 proposed | `skill-editor-target-sync-redesign`（已 parked） |
| 4 | Content 分頁（Edit/Preview/Split） | ✅ 已實作 | `skill-editor-content-split-view` |
| 4+ | Split 同步捲動 Phase 2（Source Map） | 📋 已 proposed | `skill-editor-split-sourcemap`（已 parked） |
| 5 | Settings 分頁（Agent Fields 卡片化） | ⬜ 未實作 | `skill-editor-settings-cards`（已 parked） |
| 6 | 狀態與互動回饋 | ⬜ 未實作 | 含在 `skill-editor-settings-cards` |
| 邊緣 | Broken Raw Mode 隱藏分頁 | ✅ 已實作 | `skill-editor-document-header` |
| 邊緣 | Sticky Header | ✅ 已實作 | `skill-editor-document-header` |
| 邊緣 | Dirty State `*` 標示 | ✅ 已實作 | `skill-editor-document-header` |
| 7 | CoverageMatrix 翻新 | 📋 已 proposed | `skill-editor-coverage-matrix`（已 parked） |
| 8 | SkillList 升級 | 📋 已 proposed | `skill-editor-skill-list`（已 parked） |

---

## 已實作項目

### 1. 風格一致性 ✅

* 嚴格遵守現有 Design System，不引入與專案格格不入的新風格。
* 分頁使用專案現行的傳統底線型分頁（`border-b-2 border-accent` 等 Tailwind token）。

### 2. Document Header ✅

* **Name**：大字體標題（`text-2xl` 級別），不可編輯。改名唯一入口為 Rename 按鈕（已實作 `canonical-skill-rename`，透過 git2 在 canonical repo 記錄 rename commit）。Name 與 Action Bar 同行，Description 滿版在下方（auto-resize textarea）。
* **Description**：柔和文字顏色緊接 Name 下方，auto-resize。
* **Action Bar**：Save / Rename / Delete 整合到 Name 行右側。
* **Sticky Header**：Document Header + 分頁列固定在頂部，內容區獨立捲動。
* **Broken Raw Mode**：brokenRaw 模式提前 return，不渲染 Document Header 和分頁列。
* **Dirty State**：`isDirty` useMemo + Name 旁 `*` 號。

### 3. Target Chips（基礎收合/展開）✅

* **收合態（預設）**：每個 target 顯示為 compact chip（`agent · location · mode`），最右邊 `+` 按鈕。
* **展開態**：點擊 chip 展開完整 TargetEditor，包裹在 `max-h-[200px] overflow-y-auto` 中。
* TargetEditor 從 SkillsPage 移入 SkillEditor 內部。
* **新建模式不顯示**：`isNew` 時不渲染。

### 4. Content 分頁（Markdown Body）✅

* Content / Settings 分頁骨架（底線型分頁）。
* **三種檢視模式**：Edit（預設）、Preview、Split（同步預覽）。
* Split 僅 container 寬度 ≥ 768px 時可選，< 768px 時 disabled 並自動回退 Edit。
* 寬度偵測使用 `ResizeObserver` 偵測 container 寬度。
* **Split 同步捲動 Phase 1（已實作）：比例同步捲動** — `scrollTop / (scrollHeight - clientHeight)` 比例同步，`requestAnimationFrame` + `syncingScroll` flag 防迴圈。

---

## 未實作項目

### 3+. Target Chips — SyncInfoBar 融合 ⬜

將原獨立的 `SyncInfoBar` 徹底移除，狀態資訊融入 Target Chips。

* **收合態直接顯示同步燈號**：每個 chip 帶狀態 icon（`✓` 已同步、`●` 待同步、`!` 專案遺失）。
* **展開態顯示詳細時間**：TargetEditor 每行融入同步時間。
* **`siblingsDirty` 警告**：放在 Target Chips 區域整體指示（例如整行最前面加 ⚠），不在每個 chip 重複。

實作細節（2026-06-01 discuss 定案）：
* `TargetChips.tsx` props 擴展，加入 `lastSync: Record<string, LastSyncEntry>` 和 `knownProjects: KnownProject[]`
* 複用 `SyncInfoBar.tsx` 的 `classifyTarget`（synced/pending/missing）和 `STATUS_CONFIG`（✓/●/! + 對應色系）
* `SkillEditor.tsx` 透傳 `lastSync`、`knownProjects` 給 TargetChips
* `SkillsPage.tsx` 移除獨立 `<SyncInfoBar>` 渲染，傳 `lastSync` 給 SkillEditor
* `TargetEditor.tsx` 每個 target row 補上同步時間（from `lastSync[key].at`）
* `SyncInfoBar.tsx` 共用邏輯抽出後刪除或保留為 reference

### 3++. TargetEditor 展開態改為 Popover ⬜

原本計畫 inline 展開 TargetEditor，經 2026-06-01 補充討論後改為 **Popover 懸浮面板**方式：點擊單一 chip 開啟該 target 的 Popover（錨定在 chip 附近），取代 inline 展開，不擠壓 Content 區域。

實作細節（2026-06-01 定案）：
* 新增 `TargetPopover.tsx`：單一 target 的懸浮面板，內容包含 agent/location 標籤、mode 下拉選單、同步時間、drift 警告、操作按鈕（ghost 風格）
* Popover 內部無硬邊框，使用微弱分隔與留白
* 同時只開一個 Popover，點擊外部或 Esc 關閉
* `TargetChips.tsx` 整合 Popover 開關邏輯
* `TargetEditor.tsx` 移除 inline 展開邏輯

### 4+. Split 同步捲動 Phase 2 — Source Map 對應 ⬜

利用 `marked` parser 的 token 行號資訊，在渲染 HTML 時注入 `data-source-line` 屬性。editor 捲動時根據可見行號範圍，在 preview 側找到對應的 `[data-source-line]` DOM 元素做 `scrollIntoView`。此方案能實現區塊級精確同步（類似 VSCode / Obsidian），但需要改造 `MarkdownPreview.tsx` 的 `marked` renderer。

### 5. Settings 分頁 ⬜

**Spectra change `skill-editor-settings-cards` 已 parked（0/7）。**

#### Agent Fields

* **按 agent 分卡片，垂直堆疊，可摺疊**：
  ```
  ▸ Anthropic
  ▾ Codex
    │ UI meta fields...
  ▸ Gemini
  ```
* 只有該 skill 實際有設定欄位的 agent 才顯示卡片，空的不佔位。
* 未來第三方 agent 若透過 `dynamic-agent-field-catalog` 取得專屬欄位，直接多一個摺疊項，不需改版面結構。
* 第三方 agent 若使用通用 `.agents/skills/` 格式且無專屬欄位，則不出現在 Agent Fields（其存在感體現在 Target chips）。

#### Advanced Extras

* 包裝在獨立卡片區塊中（`bg-bg-secondary/30` + `border`）。
* 補上 `+ Add property` 按鈕，讓動態 YAML key-value 可以直覺地新增。

### 6. 狀態與互動回饋 ⬜

* 設定頁內輸入欄位加入 focus 視覺回饋（`focus:ring-1 focus:ring-accent`）。
* Save 按鈕在有未儲存變更時給予更明顯的視覺強調，disabled 狀態下降低透明度。

### 7. 摘要檢視 (CoverageMatrix) 同步翻新 ⬜

為了避免模式切換時的視覺割裂感，摘要檢視也必須與 `SkillEditor` 的極簡/現代風格對齊：

1. **去格線化 (Borderless Data Grid)**：捨棄傳統生硬的網格線條，改以留白 + 整列 Hover 時的微弱背景色（`bg-bg-secondary/20`）引導視覺對齊。
2. **狀態圖示精緻化**：純文字符號（✓, ●, ⚠ 等）升級為帶狀態色微弱底色圓角 Badge。
3. **從展示升級為導航樞紐**：Skill 名稱加 Hover 互動回饋與點擊事件，點擊後切換回 List 模式並展開對應 SkillEditor。

實作細節（2026-06-01 discuss 定案）：
* `CoverageMatrix.tsx`：移除 `gap-px` 和 cell `border-b border-border/50`，data row 改用 `hover:bg-bg-secondary/20` group hover。保留 header 底線作為 header/data 分界。
* 狀態 icon 包裹在帶底色圓角 Badge 內（如 `inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/10 text-success`）。
* Skill 名稱加 `cursor-pointer` + hover 回饋，新增 `onSkillClick?: (name: string) => void` prop。
* `SkillsPage.tsx`：傳 `onSkillClick` 給 CoverageMatrix，callback 執行 `setViewMode("list"); setSelectedName(name);`。
* 純前端 UI 改動，不需後端變更。

### 8. 側邊欄清單 (SkillList) 升級 ⬜

為使左側清單與右側的 Notion 風格編輯器匹配，將 `SkillList` 從「傳統檔案列表」升級為「現代化筆記本側欄」：

1. **明確分組排序 (Grouped Sorting)**：保留原有的排序邏輯（Broken/Dirty/無 Target 置頂），加入明確群組標題（`Action Required` / `All Skills`）。
2. **去線條化與圓角選取態**：移除 `border-l-2`，改為 `mx-2 rounded-md` + 背景深淺區分 hover/selected。
3. **標籤與狀態圖示統一**：
   - Agent 標籤改為 `agent · location` 格式小型 chip（省略 mode，保持緊湊）。
   - Push 按鈕 dirty 時永遠顯示，非 dirty 時 hover 才浮現（`opacity-0 group-hover:opacity-100`）。

實作細節（2026-06-01 discuss 定案）：
* `SkillList.tsx`：移除 `border-l-2`，改為 `mx-2 rounded-md`，selected 用 `bg-bg-secondary`，hover 用 `hover:bg-bg-secondary/50`。
* 排序後根據 `sortRank` 分界插入群組標題 `<li>`。若所有 skill 同屬一組則只顯示一個標題。
* Agent badge 改為 `agent · location` 格式小型 chip。
* Push 按鈕加 `opacity-0 group-hover:opacity-100`；dirty 狀態時永遠顯示。
* i18n 新增分組標題 keys（`skills.list.groupActionRequired` / `skills.list.groupAllSkills`）。
* 純前端 UI 改動，不需後端變更。

---

## 整體版面結構

```
┌─────────────────────────────────────────────────┐
│ code-review                  [Rename][Del][Save] │  ← Document Header (Name + Action Bar) ✅
│ A tool for reviewing pull requests               │  ← Description ✅
│ 🏷 ✓ anthropic·global·auto  ● gemini·proj·manual [+] │  ← Target chips (收合態 + 同步狀態) 🔸部分
├─────────────────────────────────────────────────┤
│ [Content]  [Settings]                            │  ← 分頁列 ✅
├─────────────────────────────────────────────────┤
│                                                  │
│  (Content 分頁: Markdown editor/preview/split) ✅│
│  (Settings 分頁: Agent Fields 摺疊卡片       ⬜ │
│                 + Advanced Extras 卡片)       ⬜ │
│                                                  │
└─────────────────────────────────────────────────┘
```

🔸 = 基礎收合/展開已實作，同步燈號融合尚未實作
