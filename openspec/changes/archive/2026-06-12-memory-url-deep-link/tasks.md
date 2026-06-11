## 1. Baseline

- [x] 1.1 跑 npm run check 記錄 TypeScript baseline；確認 MemoryPage.tsx 現狀無 useSearchParams、選取狀態（selectedProject/editingFile）僅在元件 state。驗證：baseline 可與驗證階段比對，區分本 change 新引入 vs pre-existing。

## 2. 實作

- [x] 2.1 MemoryPage.tsx 實作 spec「Memory selection is restored from URL query parameters」：以 react-router useSearchParams 讀取 project/file 參數；專案清單載入完成後比對 project hash（一次性還原，比照 History deep-link effect 的「列表就緒後比對」模式），命中則選取並載入記憶檔，file 參數（decodeURIComponent）命中檔名則開啟編輯器；任一參數無命中時靜默忽略、維持預設未選取狀態。驗證：npm run check 通過；4.2 手動驗證涵蓋還原與無效參數情境。
- [x] 2.2 MemoryPage.tsx 實作 spec「Memory selection changes are reflected in the URL」：選取專案 → set project、清除 file；開啟檔案 → set file（encodeURIComponent）；關閉編輯器或切換專案 → 清除 file；searchQuery 與編輯器草稿不寫入 URL。URL 更新走單一 helper（比照 TokensPage updateTokenSearchParams 模式）避免分散 setSearchParams 呼叫。驗證：npm run check 通過。

## 3. 驗證

- [x] 3.1 全域確認：npm run check 與 1.1 baseline 比對無新引入 error/warning；grep MemoryPage.tsx 確認 setSearchParams 集中於單一 helper。
- [x] 3.2 跑 /felina-ui-guidelines 評估（本 change 無視覺變更，評估重點為未意外引入新樣式或違規色），輸出命中與 deviation 清單。驗證：清單產出且 deviation 已處理或記錄為接受。
- [x] 3.3 npm run tauri dev 手動驗證：(a) 選取專案 → URL 出現 ?project=<hash>；開檔 → 加上 &file=<name>；關閉編輯器 → file 消失、project 保留；切換專案 → file 清除；(b) 複製 ?project=&file= URL 後重新導向（或重整）→ 專案與編輯器正確還原；(c) 偽造不存在的 hash / 檔名 → 頁面維持預設未選取、無錯誤；(d) 含中文或空格檔名的 file 參數編解碼正確；(e) 搜尋字串輸入不改變 URL。
