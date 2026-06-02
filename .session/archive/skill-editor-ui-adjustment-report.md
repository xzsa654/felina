# SkillEditor UI 重構方針 (2026-06-01 定案，同日全數完成)

為解決 `SkillEditor.tsx` 排版混亂、填表感太重的問題，以「文件中心化」為核心理念重新設計。以下為討論後的定案方針：

## 實作進度總覽

| Section | 項目 | 狀態 | Spectra Change |
|---------|------|------|----------------|
| 1 | 風格一致性 | ✅ 已實作 | `skill-editor-document-header` |
| 2 | Document Header | ✅ 已實作 | `skill-editor-document-header` |
| 3 | Target Chips（基礎收合/展開） | ✅ 已實作 | `skill-editor-target-chips` |
| 3+ | Target Chips（SyncInfoBar 融合 + Popover） | ✅ 已實作 | `skill-editor-target-sync-redesign` |
| 4 | Content 分頁（Edit/Preview/Split） | ✅ 已實作 | `skill-editor-content-split-view` |
| 4+ | Split 同步捲動 Phase 2（Source Map） | ✅ 已實作 | `skill-editor-split-sourcemap` |
| 5 | Settings 分頁（Agent Fields 卡片化） | ✅ 已實作 | `skill-editor-settings-cards` |
| 6 | 狀態與互動回饋 | ✅ 已實作 | `skill-editor-settings-cards` |
| 7 | CoverageMatrix 翻新 | ✅ 已實作 | `skill-editor-coverage-matrix` |
| 8 | SkillList 升級 | ✅ 已實作 | `skill-editor-skill-list` |
| 邊緣 | Broken Raw Mode 隱藏分頁 | ✅ 已實作 | `skill-editor-document-header` |
| 邊緣 | Sticky Header | ✅ 已實作 | `skill-editor-document-header` |
| 邊緣 | Dirty State `*` 標示 | ✅ 已實作 | `skill-editor-document-header` |
| 追加 | Header 自動收合（preview/split 模式） | ✅ 已實作 | `skill-editor-split-sourcemap` 附帶 |
| 追加 | bodyMode localStorage 記憶 | ✅ 已實作 | `skill-editor-split-sourcemap` 附帶 |
| 追加 | Action Bar pill toggle 風格統一 | ✅ 已實作 | `skill-editor-settings-cards` 附帶 |

---

## 完成項目摘要

### 1. 風格一致性
* 嚴格遵守現有 Design System，分頁使用底線型分頁（`border-b-2 border-accent`）。

### 2. Document Header
* Name 大字體不可編輯 + Description auto-resize 滿版 + Action Bar 右側 pill toggle 整合 + Sticky Header + isDirty `*` 標示。

### 3. Target Chips + SyncInfoBar 融合 + Popover
* 收合態 compact chip（`agent · location · mode`）帶同步狀態 icon（✓/●/!）+ 語意色，drifted 時覆蓋 warning 色（⟳）。
* 點擊 chip 開啟 TargetPopover（mode 下拉、同步時間/drift 警告、Pull/Repoint/Open folder/Delete + confirmation dialog）。
* 共用邏輯抽至 `sync-status-utils.ts`（classifyTarget, STATUS_CONFIG, targetKey, isTargetDisabled）。
* SyncInfoBar 標記 retained-for-reference。

### 4. Content 分頁 + Split Source Map
* Edit / Preview / Split 三模式切換，pill toggle 風格。
* Split 模式 source map 區塊級同步捲動（`data-source-line` 屬性注入 + DOM 查找），取代 Phase 1 比例映射。
* 雙向同步 + 底部對齊（任一側到底時另一側同步到底）。
* `renderWithSourceMap` 抽至 `src/lib/utils/markdown-source-map.ts`，7 個 node:test 單元測試。

### 5. Settings 分頁
* Agent Fields 按 agent 分卡片（`bg-bg-secondary/30 border border-border rounded`），預設展開，可摺疊。
* Advanced Extras 包裝為獨立卡片 + `Add property` 按鈕。
* Focus ring（`focus:ring-1 focus:ring-accent`）統一視覺回饋。

### 6. Header 自動收合 + bodyMode 記憶
* preview / split 模式自動隱藏 Name / Description / Target Chips，最大化閱讀空間。
* bodyMode 持久化到 localStorage，切換 skill 和重啟 app 後自動還原。

### 7. CoverageMatrix 翻新
* 去格線化 + zebra striping（`bg-bg-tertiary/50`）。
* 狀態符號升級為圓角 Badge（帶語意色底色）。
* Crosshair hover（accent 色行高亮 + 列高亮偽元素）。
* Skill 名稱可點擊導航回 List 模式。

### 8. SkillList 升級
* 去 `border-l-2`，改 `mx-2 rounded-md` 圓角選取態。
* 排序後依 `sortRank` 分界插入 Action Required / All Skills 群組標題。
* Agent chip 改為 brand icon（claude.svg / codex.png / antigravity.png）。
* Push 按鈕 dirty 常駐、clean hover 浮現。

### 9. Action Bar pill toggle
* Rename / Delete / Save 從散裝按鈕改為 pill toggle 容器（`bg-bg-tertiary rounded-lg p-1`），與 bodyMode toggle 風格統一。

---

## 整體版面結構

```
┌─────────────────────────────────────────────────┐
│ code-review            [Rename][Del][Save] ← pill│  ← Document Header (自動收合)
│ A tool for reviewing pull requests               │  ← Description (自動收合)
│ ✓ claude·global  ● gemini·proj  ⟳ codex·global [+]│  ← Target Chips + 同步狀態
├─────────────────────────────────────────────────┤
│ [Content]  [Settings]                            │  ← 分頁列 (Sticky)
├─────────────────────────────────────────────────┤
│                                                  │
│  Content: [Edit] [Preview] [Split] ← pill toggle │
│  Settings: Agent Fields 摺疊卡片 + Extras 卡片   │
│                                                  │
└─────────────────────────────────────────────────┘
```
