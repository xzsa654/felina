# Notes — memory-history-i18n

- Task 4.3（npm run tauri dev 手動驗證 (a)–(f)）未逐項執行：使用者裁決提前歸檔（同 shared-error-display 前例）。使用者實際開過 app（驗證過程中回報下述跑版問題），但 (a)–(f) 未逐項確認；後續發現問題依清單補驗。
- 使用者於驗證時回報既有版面問題：Memory 頁第二欄卡片格的 `feedback` type 標籤溢出版面 — 已記錄於 `.session/handoff/2026-06-11.md` Open Questions，非本 change 引入、不在本 change 修復。
- 靜態驗證皆通過：tsc 0 errors（與 baseline 一致）；memory/ 與 history/ grep 無殘留硬編碼 UI 英文、無 purple-500 / white 系原生色、無未帶 locale 的 formatNumber。
- 範圍備註：HistoryPage usage line 的 token 計量標籤（input/output/cache/write/reasoning）與 agent 產品名（Claude/Codex/Gemini）依 spec 維持 verbatim；MemoryPage 的 `border-white/5` 分隔線雖未列於 tasks 1.1 清單（原僅列 History），依 4.1「兩目錄無原生結構色」驗證條件一併修為 `border-border`。
- timestamps 的 `toLocaleString(undefined, ...)` 維持系統 locale，spec 僅要求 number formatting 帶 locale，未擴大範圍。
