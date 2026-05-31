## 1. 準備與基礎元件

- [x] 1.1 建立 Block-Level Info Dialog 元件: 於 `src/lib/components/shared/InfoDialog.tsx` 建立通用說明視窗，支援 `open`, `title`, `content` (ReactNode), `onClose` props。驗證: 無 TypeScript 錯誤。
- [x] 1.2 新增 i18n 翻譯: 在 `en.ts` 與 `zh-TW.ts` 中加入 `TargetEditor` 與 `ManagedInventory` 需要的說明文案。驗證: `npm run check` 通過，中英文案數量與結構一致。

## 2. 整合 TargetEditor 說明

- [x] 2.1 修改 `TargetEditor.tsx`: 在 `<h4>TARGETS</h4>` 旁邊新增 `?` icon 按鈕。綁定 onClick 事件開啟對應的 `InfoDialog`。驗證: 無 TypeScript 錯誤。
- [x] 2.2 組裝 Target 說明內容: 將同步模式、Pull、重新指向的 i18n 文字使用 `ReactNode` 組合傳入 `InfoDialog`，將關鍵字加粗。驗證: 在介面上點擊能正確顯示並排版正常。

## 3. 整合 ManagedInventory 說明

- [x] 3.1 修改 `ManagedInventory.tsx` 或其外層: 在合適的標題旁 (若無則在表格上方新增一行帶標題的列) 加入 `?` icon 按鈕。綁定 onClick 事件開啟 `InfoDialog`。驗證: 無 TypeScript 錯誤。
- [x] 3.2 組裝 Inventory 說明內容: 傳入 Multi Source 的解釋與處理方式。驗證: 點擊後彈窗能正常顯示。

## 4. 文案修正（討論後修訂）

- [x] 4.1 修正 TargetEditor help 文案: 將 `trackedDisabled` key 拆為 `auto`、`manual`、`disabled` 三個獨立 key，分別描述三種同步模式。移除 `pruneOrphans` key。更新 Pull 描述加入「偵測到不一致時出現」的前提。en/zh-TW 同步更新。驗證: `npm run check` 通過，i18n key 結構對齊。
- [x] 4.2 修正 ManagedInventory help 文案: 將 `multiSource` help 文案中「多重來源」統一為「多來源」，與既有 UI 用詞一致。驗證: `npm run check` 通過。
- [x] 4.3 更新 `TargetEditor.tsx` InfoDialog content: 渲染邏輯改為遍歷 `auto`、`manual`、`disabled`、`pull`、`repoint` 五個 key。驗證: 無 TypeScript 錯誤。

## 5. 驗證

- [x] 5.1 執行 `npm run check`，確保所有修正後的元件與 i18n keys 皆無型別錯誤。
- [x] 5.2 執行 `npm run tauri dev` 進行手動驗證，確認彈窗開關功能正常，文案排版清晰，用詞與 UI 按鈕/標籤一致。
