## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline。驗證：npm run check 結果記錄

## 2. Inline Drawer 元件

- [x] 2.1 `src/lib/components/projects/ManagedInventory.tsx`：將現有的 multi-source 展開邏輯（`expandedMulti` state + radio button + `selectedSource` state）替換為 Inline Drawer。點擊 multi-source row 的 Import 按鈕時，在該 row 下方展開 Drawer 區塊（`bg-bg-secondary/20 border border-border rounded mx-3 my-1 p-3`）。同時只開一個 Drawer（開新的自動關舊的），Esc 關閉。行為：multi-source 衝突時展開 Inline Drawer 而非 inline radio。驗證：npm run check 通過

## 3. Selectable Cards

- [x] 3.1 `src/lib/components/projects/ManagedInventory.tsx`：Drawer 內每個來源候選顯示為一張 Selectable Card（`bg-bg-secondary/30 border border-border rounded p-3 cursor-pointer hover:border-accent`，選中時 `border-accent ring-1 ring-accent`）。Card 內顯示來源 agent brand icon、來源路徑、agent 名稱。預設選中第一個。底部顯示確認匯入按鈕（accent 底色）。行為：使用者點擊卡片選擇來源，點擊確認按鈕執行匯入。驗證：npm run check 通過

## 4. i18n

- [x] [P] 4.1 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts`：新增 i18n keys — Drawer 的確認按鈕文案、來源選擇提示文案。驗證：npm run check 通過，兩個 locale 檔案 key 對齊

## 5. 驗證

- [x] 5.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 5.2 npm run tauri dev 手動驗證：(a) multi-source skill 點擊 Import 展開 Inline Drawer、(b) 卡片可選擇切換、(c) 確認按鈕執行匯入、(d) 同時只開一個 Drawer、(e) Esc 關閉 Drawer。驗證：逐項目視確認
