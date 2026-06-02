## Why

目前的 Skill 匯入對話框 (Import Dialog) 缺乏直覺的互動，且在面對同名 Skill 衝突時，依賴阻斷式的 Alert 警告，打斷了使用者的工作流。為了符合 Felina「文件中心化、去線條化、任務導向」的設計語彙，我們需要重新設計一個具備現代感、基於雙區塊拖拉 (Two-Pane Drag & Drop) 的匯入介面，並將原生的系統檔案選擇視窗降級為左側區塊的資料輸入口。

## What Changes

- 將 Import Dialog 重構為雙區塊 (Split View) 佈局：左側為偵測池 (Discovered/Available)，右側為匯入佇列 (To Import/Staging)。
- 實作原生的 HTML5 拖拉互動 (Native Drag & Drop)，支援從左側拖拉至右側，並支援雙擊 (Double Click) 快速移動。
- 衝突處理改為「行內決策」：當匯入佇列發生同名衝突時，直接在卡片下方展開選項 (Overwrite / Rename)，不彈出 Alert 視窗。
- 將原生檔案選擇視窗 (Browser Dialog) 整合至左側偵測池，作為手動選擇外部檔案的入口。選取後檔案將出現於左側，而非直接觸發匯入。
- 所有列表使用去表格化、無邊框的 Skill Card 呈現，並以顏色和標籤 (`Ready`, `Conflict`) 區分狀態。

## Non-Goals (optional)

- 不實作多餘或過度浮誇的動畫（如拖曳時放大、物理陰影等），保持操作極致的快速與零延遲。
- 不提供直接從右側佇列編輯 Skill 內容的功能，僅處理匯入前的檔名與衝突決策。

## Capabilities

### New Capabilities

- `skill-import-split-view`: 實作雙區塊拖曳架構與卡片化列表。
- `inline-conflict-resolution`: 實作行內的衝突警告與決策選項（Overwrite / Rename）。

### Modified Capabilities

- `skill-library-management`: 修改匯入流程的觸發邏輯，支援先 staging 再 batch import。

## Impact

- Affected specs: `skill-import-split-view`, `inline-conflict-resolution`, `skill-library-management`
- Affected code:
  - Modified: `src/lib/components/skills/SkillsPage.tsx`
  - Modified: `src/lib/i18n/locales/en.ts`
  - Modified: `src/lib/i18n/locales/zh-TW.ts`
  - New: `src/lib/components/skills/import/ImportStagingDialog.tsx`
  - New: `src/lib/components/skills/import/SkillStagingCard.tsx`
  - New: `src/lib/components/skills/import/staging-logic.ts`
  - New: `tests/staging-logic.test.ts`
  - Modified: `src-tauri/src/commands/agent_paths.rs`（`GEMINI_LEGACY_GLOBAL` 常數 + `extra_global_paths()`，集中 legacy 路徑去重）
  - Modified: `src-tauri/src/commands/skill_import.rs`（import scan 改用 `extra_global_paths()`，移除硬編 antigravity fallback）
