## 1. Baseline

- [x] 1.1 跑 npm run check 記錄現有 TypeScript errors / warnings 作為 baseline，並 grep 兩頁現狀清單：MemoryPage.tsx 與 HistoryPage.tsx 內的硬編碼 UI 字串、HistoryPage.tsx 的 purple-500 / white/5 原生色 class、MemoryPage.tsx 的 .split("/").pop() 站點、HistoryPage.tsx 未帶 locale 的 formatNumber 呼叫。驗證：清單可與驗證階段逐項比對，區分本 change 新引入 vs pre-existing。

## 2. i18n keys

- [x] 2.1 在 src/lib/i18n/locales/en.ts 與 zh-TW.ts 新增 memory.* 與 history.* namespaces：memory 至少含頁面標題、載入、專案/檔案空狀態、新增/編輯/儲存/刪除/取消控制、儲存成功與失敗標題；history 至少含頁面標題、agent filter 標籤（All/Claude/Codex/Gemini 其中 agent 名稱保留原文不譯）、transcript filter 標籤、session 與 transcript 搜尋 placeholder、載入、無 session 空狀態、未選取提示、load-more 控制、列表與 transcript 載入失敗標題。en 與 zh-TW 結構對齊。驗證：npm run check 通過（TranslationDict 缺 key 會 compile error）。

## 3. 頁面遷移

- [x] 3.1 [P] MemoryPage 遷移，滿足 spec「Memory page uses translation resources」：引入 useLocaleStore 與 t()，1.1 清單中的硬編碼 UI 文字全部改 t(locale, key)；儲存/載入/刪除失敗改用 ErrorNotice（i18n 標題 + 後端錯誤 verbatim detail），原本僅寫 console.error 的載入失敗也改為使用者可見的 ErrorNotice；專案名稱顯示先 replace 反斜線為正斜線再 .split("/").pop()（兩處顯示站點）。專案路徑、檔名、時戳、記憶內容維持 verbatim。驗證：npm run check 通過；grep MemoryPage.tsx 無殘留硬編碼 UI 英文字串。
- [x] 3.2 [P] HistoryPage 遷移，滿足 spec「History page uses translation resources」與「History page uses locale-aware number formatting」：引入 useLocaleStore 與 t()，AGENTS / TRANSCRIPT_FILTERS 標籤常數與 1.1 清單中的硬編碼 UI 文字改走 t(locale, key)（agent 名稱 Claude/Codex/Gemini 保留原文）；session 列表與 transcript 載入失敗改用 ErrorNotice（i18n 標題 + verbatim detail）；formatNumber 呼叫補 locale 參數；usage entry 的 border-purple-500/25 bg-purple-500/5 改為 info 語意色（border-info/25 bg-info/5），border-white/5 等原生白色透明度 class 改為 border-border 系 theme token。session ID、model 名稱、transcript 內容維持 verbatim。驗證：npm run check 通過；grep HistoryPage.tsx 無 purple-500、無 white/5、無未帶 locale 的 formatNumber。

## 4. 驗證

- [x] 4.1 全域確認：npm run check 與 1.1 baseline 比對無新引入 error/warning；grep src/lib/components/memory/ 與 src/lib/components/history/ 確認無殘留硬編碼 UI 英文、無原生 Tailwind 結構色。
- [x] 4.2 跑 /felina-ui-guidelines 評估本 change 的 UI 改動（兩頁的 ErrorNotice 採用與 History 語意色替換），輸出命中的 guideline 與 deviation 清單。驗證：清單產出且 deviation 已處理或明確記錄為接受。
- [x] 4.3 npm run tauri dev 手動驗證：(a) 切換 en / zh-TW，Memory 與 History 兩頁標題、按鈕、空狀態、filter 標籤即時切換，專案路徑/session ID/transcript 內容維持原文；(b) Memory 儲存失敗（如唯讀路徑）顯示 ErrorNotice 含本地化標題 + 錯誤原文；(c) History 列表或 transcript 載入失敗顯示 ErrorNotice；(d) History usage entry 與分隔線在亮/暗主題下顏色來自 theme 語意色；(e) zh-TW 下 token/message 數字格式正常且數值不變；(f) Windows 路徑的專案名稱在 Memory 頁正確顯示最後一段。
