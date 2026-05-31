## Summary

TargetEditor 從獨立區塊重構為 Document Header 內的 Metadata 屬性列：收合態以 compact chips 顯示每個 target，展開態提供完整操作介面。

## Motivation

`skill-editor-document-header` 建立了文件中心化的 Document Header 結構。目前 TargetEditor 仍作為獨立元件在 SkillsPage 中渲染於 SkillEditor 上方，佔用大量垂直空間且與文件標題視覺斷裂。將 TargetEditor 融入 Document Header 作為 Metadata 屬性列（類似 Notion 文件頂部的 Tag 屬性列），讓使用者一眼看到「這份 Skill 發布到哪裡」。

## Proposed Solution

1. **收合態（預設）**：在 Description 下方渲染一行 compact chips，每個 target 顯示為 `agent · scope · mode` 格式的小標籤。最右邊一個 `+` 按鈕觸發 AddTargetDialog。
2. **展開態**：點擊任一 chip 或展開按鈕後，展開為現有完整 TargetEditor 內容（mode 切換 Auto/Manual/Disabled、Pull/Repoint/Delete 操作、drift 狀態、help dialog）。
3. **移入 SkillEditor 內部**：TargetEditor 從 SkillsPage 獨立渲染改為 SkillEditor 的 props 傳入或內部子元件，位置在 Document Header 的 Description 下方、分頁列上方。
4. **新建模式不顯示**：`isNew` 時不渲染 Target Chips 區域。

## Non-Goals

- 不修改 TargetEditor 的後端邏輯或 IPC command
- 不修改 AddTargetDialog / PullConfirmDialog / TargetRemovalDialog 的功能
- 不實作 Target 拖曳排序

## Impact

- Affected specs: `skills-workspace-layout`
- Affected code:
  - Modified: `src/lib/components/skills/SkillEditor.tsx`, `src/lib/components/skills/TargetEditor.tsx`, `src/lib/components/skills/SkillsPage.tsx`, `src/lib/i18n/locales/en.ts`, `src/lib/i18n/locales/zh-TW.ts`
  - New: `src/lib/components/skills/TargetChips.tsx`
