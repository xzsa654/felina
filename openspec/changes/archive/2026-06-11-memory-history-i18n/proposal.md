## Summary

Memory 與 History 兩頁補齊 i18n（全部 UI 文字走 t(locale, key)、錯誤改用 ErrorNotice），並順帶修正 History 的語意色違規與兩頁的小型慣例偏差（路徑反斜線、formatNumber locale）。

## Motivation

MemoryPage 與 HistoryPage 是目前僅有的兩個完全沒有接 i18n 的頁面：沒有 useLocaleStore / t()，標題、按鈕、空狀態、載入文字、錯誤訊息全是硬編碼英文，違反專案 i18n 慣例（CLAUDE.md：新增或修改 user-facing UI 文字必須走 t(locale, key)）。切換語言時這兩頁不會跟著變，與其他頁面體驗不一致。同時 HistoryPage 使用了 purple-500、white/5 等原生 Tailwind 色違反語意色規範，MemoryPage 以 .split("/").pop() 顯示專案名稱未先正規化反斜線（Windows 路徑會整串顯示），HistoryPage 的 formatNumber 呼叫未帶 locale。共用元件 ErrorNotice 已於 shared-error-display change 就位，本 change 的錯誤顯示直接採用。

## Proposed Solution

- MemoryPage（src/lib/components/memory/MemoryPage.tsx）：
  - 引入 useLocaleStore 與 t()，所有硬編碼 UI 文字（頁面標題、載入、空狀態、按鈕、編輯器標籤、儲存回饋）改為 t(locale, key)，新增 memory.* namespace keys（en + zh-TW）
  - 錯誤顯示改用 ErrorNotice（i18n 標題 + 後端錯誤 verbatim detail），取代目前的字串插值與僅寫 console 的靜默錯誤
  - 專案名稱顯示先做反斜線→正斜線正規化再取最後一段（對齊 normalizeProjectPath 慣例的顯示用途）
- HistoryPage（src/lib/components/history/HistoryPage.tsx）：
  - 引入 useLocaleStore 與 t()，agent filter 標籤、transcript filter 標籤、頁面標題、搜尋 placeholder、載入/空狀態/選取提示等改為 t(locale, key)，新增 history.* namespace keys（en + zh-TW）
  - 列表與 transcript 錯誤顯示改用 ErrorNotice（i18n 標題 + verbatim detail）
  - 語意色修正：usage entry 的 purple-500 系改為 info 語意色；border-white/5 等原生白色透明度改為 border-border 系 theme token
  - formatNumber 呼叫補 locale 參數
- i18n 字典：src/lib/i18n/locales/en.ts 與 zh-TW.ts 新增 memory.*、history.* namespaces，結構由 TranslationDict type 強制對齊

## Non-Goals

- 不重構兩頁的狀態管理（React Query 遷移、URL 深連結為先前評估的獨立項目，不混入）
- 不翻譯 user/system data：專案路徑、agent ID、model 名稱、session ID、時戳、transcript 內容、後端錯誤 payload 一律 verbatim
- 不動 Memory / History 的後端 commands 與資料流
- 資料視覺化色彩不在語意色修正範圍（依 CLAUDE.md 豁免），僅修 UI 結構色

## Impact

- Affected specs: `frontend-i18n`（delta ADDED：Memory 與 History 頁 i18n requirements）
- Affected code:
  - Modified:
    - src/lib/components/memory/MemoryPage.tsx
    - src/lib/components/history/HistoryPage.tsx
    - src/lib/i18n/locales/en.ts
    - src/lib/i18n/locales/zh-TW.ts
  - New: (none)
  - Removed: (none)
- 無新增 npm / Cargo 依賴；純前端變更
- 風險：低。文字與樣式遷移，不改行為邏輯；TranslationDict type 與 tsc 把關缺 key；HistoryPage 今日剛被 history-transcript-conversation-channel 改過，遷移時以 dev 分支現狀為準
