## Summary

將 ProjectsPage 的 Multi-source Import 流程從表格內 radio button 改為 Inline Drawer + Selectable Cards，提供更清晰的來源選擇體驗。

## Motivation

`projects-page-visual-refresh` 將 ManagedInventory 從表格改為清單，但 Import 流程中的 multi-source 衝突解決仍保留原本的 radio button + 表格內展開方式。在清單化佈局下，radio button 擠在行內顯得突兀。需要一個與清單風格一致的互動模式。

## Proposed Solution

1. **Inline Drawer 展開**：點擊 Discovered row 的 Import 按鈕時，若為 multi-source 衝突，在該 row 下方展開 Inline Drawer（不是 modal，不是 popover）
2. **Selectable Cards**：Drawer 內每個來源顯示為一張可選卡片（`bg-bg-secondary/30 border border-border rounded`，選中時 `border-accent`），卡片內顯示來源 agent icon、路徑、檔案大小等資訊
3. **互動模式**：同時只開一個 Drawer（開新的自動關閉舊的），click-outside 或 Esc 關閉，與 SkillEditor TargetPopover 保持一致的互動慣例
4. **確認按鈕**：選擇來源後，Drawer 底部顯示確認按鈕執行匯入

## Non-Goals

- 不修改單一來源匯入的流程（無衝突時直接匯入，不開 Drawer）
- 不修改匯入後端邏輯（`skill_import.rs` 不變）
- 不修改 overwrite 確認 dialog（已存在 canonical master 時的覆蓋確認保持不變）

## Impact

- Affected specs: `projects-view`（匯入互動方式變更）
- Affected code:
  - Modified: `src/lib/components/projects/ManagedInventory.tsx`（multi-source 展開從 radio button 改為 Inline Drawer + Selectable Cards）
  - Modified: `src/lib/i18n/locales/en.ts`（新增 i18n keys）
  - Modified: `src/lib/i18n/locales/zh-TW.ts`（新增 i18n keys）
- 前置依賴：`projects-page-visual-refresh` 須先完成（清單化佈局）
