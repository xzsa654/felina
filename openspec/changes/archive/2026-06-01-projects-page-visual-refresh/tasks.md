## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline。驗證：npm run check 結果記錄

## 2. Project Summary Header

- [x] 2.1 `src/lib/components/projects/ManagedInventory.tsx`：在 component 頂部（error 訊息之後、表格/清單之前）新增 Project Summary Header 區塊。顯示專案目錄名稱（路徑末段）為 `text-xl font-bold` 標題，下方一行狀態摘要顯示 discovered 和 managed 數量（格式 `N Discovered · M Managed`，用 `text-text-secondary text-sm`）。行為：選取專案後右側面板頂部顯示專案名稱和數量摘要。驗證：npm run check 通過

## 3. 去表格化

- [x] 3.1 `src/lib/components/projects/ManagedInventory.tsx`：將 `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<td>` 結構全部替換為 `<div>` flex 清單。分為 Discovered 區塊（`row.candidate && !row.managed` 的 rows）和 Managed 區塊（`row.managed` 的 rows），上下堆疊。Discovered 區塊在上，數量為 0 時整個區塊隱藏。每個區塊有 section header（`text-xs font-semibold uppercase tracking-wide text-text-secondary`）。每個 row 用 `flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary/50 rounded` 取代 tr/td。行為：右側面板從表格變為清單式佈局，Discovered 在上 Managed 在下。驗證：npm run check 通過

## 4. Agent Chips 統一

- [x] 4.1 `src/lib/components/projects/ManagedInventory.tsx`：移除 `AGENT_CHIP_LABEL` 硬編碼文字 chip，改為與 SkillList 一致的 brand icon 呈現。import SkillList 使用的 `AGENT_ICON` map（或直接 import 圖片資源），每個 agent 顯示為 `<img>` icon（w-4 h-4）+ agent 名稱小字。行為：agent 標籤顯示 brand icon 而非純文字。驗證：npm run check 通過

## 5. 狀態融入

- [x] 5.1 `src/lib/components/projects/ManagedInventory.tsx`：移除獨立 Status 欄位（原本的 managed/unmanaged 文字），改為在 row 內以小型 Badge 呈現。Managed row 在名稱右側顯示 `text-success` 小圓點或 check icon；Discovered row 在名稱右側顯示 `text-info` badge「new」。行為：狀態以低調方式融入清單項目，無獨立 Status 欄位。驗證：npm run check 通過

## 6. i18n

- [x] [P] 6.1 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts`：新增 i18n keys — summary header 的 discovered/managed 計數文案、section header 文案（Discovered / Managed）、Discovered row 的 new badge 文案。驗證：npm run check 通過，兩個 locale 檔案 key 對齊

## 7. 驗證

- [x] 7.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 7.2 npm run tauri dev 手動驗證以下行為：(a) Summary Header 顯示專案名稱和數量摘要、(b) Discovered 區塊在上 Managed 在下、(c) 無 Discovered 時該區塊隱藏、(d) Agent chips 顯示 brand icon、(e) 狀態以 Badge 融入 row、(f) Managed row 可點擊跳轉到 Skills 頁面。驗證：逐項目視確認
