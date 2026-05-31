# SkillEditor UI 重構方針 (2026-06-01 定案)

為解決 `SkillEditor.tsx` 排版混亂、填表感太重的問題，以「文件中心化」為核心理念重新設計。以下為討論後的定案方針：

## 待確認與邊緣情境補充 (Edge Cases & UX)

1. **損壞修復模式 (Broken Raw Mode)**：當 YAML 解析失敗進入 `brokenRaw` 模式時，應完全隱藏 Target Chips 與分頁列，只保留顯示紅色的 Action Bar 與滿版的 Raw Textarea，避免介面混亂。
2. **捲動行為 (Sticky Header)**：`Action Bar` + `Document Header` + `Target Chips` + `分頁列` 應設為固定區塊 (Sticky)，僅讓下方的 Content/Settings 區域獨立捲動 (`overflow-y-auto`)，確保全域操作隨時可見。
3. **未儲存提示 (Dirty State)**：當處於未儲存狀態時，除了 Save 按鈕的高亮，應在 Document Header 大標題旁增加 `*` 號或小紅點標示，強化防呆提示。

---

## 1. 風格一致性

* 嚴格遵守現有 Design System，不引入與專案格格不入的新風格。
* 分頁使用專案現行的傳統底線型分頁（`border-b-2 border-accent` 等 Tailwind token）。

## 2. Document Header

* **Name**：大字體標題（`text-2xl` 級別），不可編輯。改名唯一入口為 Rename 按鈕（已實作 `canonical-skill-rename`，透過 git2 在 canonical repo 記錄 rename commit）。
* **Description**：柔和文字顏色緊接 Name 下方。
* **Action Bar**：Save / Rename / Delete 整合到 Document Header 右上方，捨棄原本獨立的頂部橫幅。若實作時發現寬度不足，退回獨立 toolbar 作為備案。

## 3. Target Chips（TargetEditor 輕量化）

緊接 Description 下方，作為文件 Metadata 的一部分（類似 Notion 文件頂部的 Tag 屬性列）。

* **收合態（預設）**：每個 target 顯示為 compact chip（`anthropic · global · auto`），最右邊一個 `+` 新增按鈕。一行搞定，使用者一進來就能看見「這份 Skill 將會發布到哪裡」。
* **展開態**：點擊任一 chip 或展開按鈕後，展開成完整 TargetEditor（mode 切換 Auto/Manual/Disabled、Pull/Repoint/Delete 操作、drift 狀態指示）。

## 4. Content 分頁（Markdown Body）

在 Document Header + Target Chips 下方引入分頁列，區分 Content 與 Settings。

* Content 分頁專屬 Markdown Body，空間設定為 `flex-1` 向下填滿。
* **三種檢視模式**（使用者自行選擇，非自動切換）：
  - **Edit**：純編輯器（預設）
  - **Preview**：純預覽
  - **Split**：雙欄並排（僅 container 寬度 ≥ 768px 時可選；< 768px 時此選項 disabled）
* 寬度偵測使用 `ResizeObserver` 偵測 container 寬度（非 viewport），因面板寬度受 skill list 收合影響。

## 5. Settings 分頁

### Agent Fields

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

### Advanced Extras

* 包裝在獨立卡片區塊中（`bg-bg-secondary/30` + `border`）。
* 補上 `+ Add property` 按鈕，讓動態 YAML key-value 可以直覺地新增。

## 6. 狀態與互動回饋

* 設定頁內輸入欄位加入 focus 視覺回饋（`focus:ring-1 focus:ring-accent`）。
* Save 按鈕在有未儲存變更時給予更明顯的視覺強調，disabled 狀態下降低透明度。

## 整體版面結構

```
┌─────────────────────────────────────────────────┐
│ code-review                  [Rename][Del][Save] │  ← Document Header (Name + Action Bar)
│ A tool for reviewing pull requests               │  ← Description
│ 🏷 anthropic·global·auto  gemini·proj·manual [+] │  ← Target chips (收合態)
├─────────────────────────────────────────────────┤
│ [Content]  [Settings]                            │  ← 分頁列
├─────────────────────────────────────────────────┤
│                                                  │
│  (Content 分頁: Markdown editor/preview/split)   │
│  (Settings 分頁: Agent Fields 摺疊卡片           │
│                 + Advanced Extras 卡片)          │
│                                                  │
└─────────────────────────────────────────────────┘
```

## 7. 摘要檢視 (CoverageMatrix) 同步翻新

為了避免模式切換時的視覺割裂感，摘要檢視也必須與 `SkillEditor` 的極簡/現代風格對齊，消除原有的「傳統填表感」：

1. **去格線化 (Borderless Data Grid)**：捨棄傳統生硬的網格線條，改以適當的留白 (Padding) 與整列 Hover 時的微弱背景色（例如 `bg-bg-secondary/20`）來引導視覺對齊，讓表格看起來更輕盈。
2. **狀態圖示精緻化**：原本單薄的純文字符號 (✓, ●, ⚠ 等) 升級為帶有狀態顏色微弱底色圓角的 Badge 或是更精緻的 SVG Icon，提升整體儀表板的精緻度。
3. **從展示升級為導航樞紐**：將最左側的 Skill 名稱加上 Hover 互動回饋與點擊事件。點擊後能直接關閉摘要檢視，切換回 List 模式並展開對應的 SkillEditor，讓這個矩陣不僅是報表，更是最高效的全域跳轉入口。
