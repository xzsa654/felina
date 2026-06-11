## 1. 後端 channel 分類

- [x] 1.1 TDD red：在 src-tauri/src/commands/tokens.rs 新增單元測試，依 spec「History page reads a selected transcript」的 channel 分類範例撰寫失敗測試 — Claude Code：sidechain 行（isSidechain: true）、isMeta 行、type=system 行、user role 但 content 僅 tool_result block 的行、user role 內文以 `<system-reminder>` / `<command-name>` / `<local-command-stdout>` / `Caveat:` 開頭的行均判為 channel=background；一般 user 輸入與 assistant 文字判為 conversation。Codex：reasoning / function_call / function_call_output response_item 判為 background、message 判為 conversation。訊號缺失或無法辨識時預設 conversation（fail-open）。完成條件：測試存在且因 TranscriptEntry 尚無 channel 欄位而編譯失敗或斷言失敗
- [x] 1.2 TDD green：TranscriptEntry（src-tauri/src/tokens/types.rs）新增 `pub channel: String`（值域 "conversation" / "background"，serde 正常序列化、不用 Option），並在 transcript 解析（src-tauri/src/commands/tokens.rs 的 transcript_entries_from_value / infer_transcript_role 周邊）實作 channel 判定：結構訊號優先、內文 prefix 為輔、無法判定一律 conversation。實作時對照本機實際 Gemini session 檔確認是否有可靠 background 訊號，若無則 Gemini entry 全歸 conversation 並把結論記錄於 change 筆記。完成條件：1.1 全部測試綠，`cargo test --lib` 該 scope 通過

## 2. 前端 Conversation filter 語意升級

- [x] 2.1 前端型別與過濾：src/lib/types/token-analytics.ts 的 TranscriptEntry 新增 `channel: "conversation" | "background"`；HistoryPage（src/lib/components/history/HistoryPage.tsx）的 matchesTranscriptEntry 升級 Conversation filter 語意 — 依 spec「History page supports agent and metadata filtering」：Conversation 僅顯示 role != "usage" 且 channel == "conversation" 的 entry，All 顯示全部、Usage 僅 usage entry（兩者行為不變）。不新增 pill、不動版面。完成條件：`npm run check` 通過
- [x] 2.2 /felina-ui-guidelines 對照確認：本 change 無新視覺元素，確認 filter pill 既有樣式未被更動、無 hardcode 色彩或文案變更；評估結論（命中哪些 guideline、是否有 deviation 與理由）記錄於 change 筆記供 archive notes 使用。完成條件：結論記錄完成

## 3. 驗證

- [x] 3.1 全套件驗證：src-tauri 下 `cargo test --lib` 0 failed、`npm run check` 通過。完成條件：兩項輸出記錄於 change 筆記
- [x] 3.2 手動驗證（npm run tauri dev）：選一個含 subagent / tool 呼叫的 Claude Code session — Conversation filter 下不出現 system-reminder、tool 輸出、sidechain 內容；切 All 可見全部 entry；另選一個 Codex session 確認 reasoning / function_call 被 Conversation 隱藏。完成條件：驗證結果（含漏判觀察）記錄於 change 筆記
