# Change Notes — history-transcript-conversation-channel

## Task 1.2 — Gemini 訊號查證

本機 `~/.gemini/` 無 session transcript（JSONL）檔，僅有 antigravity brain/metadata JSON。無可驗證的 background 結構訊號 → Gemini entry 依 fail-open 設計全歸 `conversation`（行為等同現狀，不退化）。未寫 Gemini 專屬判定分支。

## Task 1.2 — 實作備註

- 判定函式 `classify_channel`（src-tauri/src/commands/tokens.rs）：isSidechain / isMeta / type=system / payload type（reasoning, function_call, function_call_output）/ content 僅 tool_result blocks → background；user-role 行內文 prefix（`<system-reminder>`、`<command-name>`、`<local-command-stdout>`、`Caveat:`）→ background；其餘 conversation。
- Prefix 判斷以來源格式宣告的 `item.role == "user"` 為準（inferred display role 對 text block 會推成 assistant，不可靠）。
- usage entry channel 固定 conversation（不參與分類，前端 filter 以 role 優先）。
- Codex `function_call` / `function_call_output` 現行解析器不產出 entry（無 content 欄位）；測試斷言「不得產出 conversation entry」（vacuous-safe）。

## Task 2.2 — /felina-ui-guidelines 對照結論

本 change 的前端變更僅 `matchesTranscriptEntry` 一行過濾條件（HistoryPage.tsx）與 `TranscriptEntry` 型別欄位，無新視覺元素、無樣式變更、無新文案（沿用既有 All / Conversation / Usage pill）。逐條對照：

- Page Scaffold：HistoryPage 既有 `<PageHeader>` / `<PageBody>` 結構未動 ✓
- 毛玻璃清單樣式（glassList*Class）：未觸碰 ✓
- 反模式（表格、外掛資訊列、新風格、舊頁面、就地 modal）：均不涉及 ✓
- Design tokens / i18n：無新色彩、無 hardcode 文案 ✓

**Deviation：無（zero deviation）。**

## 使用者回饋修正 — slash command 行是 conversation（非 background）

初版把 `<command-*>` tag 行誤判為 harness 後台；使用者指正：那是 slash command 的真實輸入（如 `/spectra-discuss xxx`）被 harness 包裝。修正：

- `<command-name>` / `<command-args>` 行 → channel=conversation，content 還原為「`/指令 參數`」（`restore_slash_command`，tag 不完整時保留原文 fail-open）
- `<local-command-stdout>` / `<local-command-caveat>`（`!` 指令輸出）→ 維持 background
- spec / design / 測試已同步（spec 新增 slash command 還原 scenario 與 example）
- 第二輪回饋：`!` bash escape 同類處理 — 含 `<bash-input>` 的行還原為 `! <指令>`（conversation、捨棄 stdout/stderr 包裝）；僅含 `<bash-stdout>`/`<bash-stderr>` 的行歸 background（prefix `<bash-std`）。還原統一收在 `restore_typed_input`。

## Task 3.2 — 手動驗證（使用者裁決提前歸檔）

使用者在兩輪回饋（slash command、bash escape 還原）後決定先歸檔，完整的 in-app 手動驗證未逐項執行；後續若發現漏判的 harness 包裝類型，另開 change 增補 prefix/還原規則。自動化覆蓋：21 個 tokens.rs 單元測試（含 channel 分類 7 訊號 + 兩種 typed-input 還原）全綠。

過程事故：用 PS 5.1 `Get-Content -Raw` + `Set-Content` 改 design.md 導致中文 mojibake（ANSI 讀 UTF-8 再回寫），已以 Write tool 全文重寫修復；spec.md（純英文）未受損。

## Task 3.1 — 全套件驗證紀錄

- `cargo test --lib`（src-tauri）：**310 passed; 0 failed; 0 ignored**（基線 304 + 本 change 新增 6 個 channel/還原測試，零新引入失敗）
- `npm run check`（tsc --noEmit）：**通過，exit 0**

備註：同分支另載有上一個 ad-hoc 改動（History transcript markdown preview：MarkdownPreview `escapeHtml` prop、`.md-preview.md-compact` CSS 變體、user/assistant bubble 改 markdown 渲染）。該改動屬本 change 之外的同性質工作，其 UI 對照：md-compact 僅縮放既有 `.md-preview` 樣式、未引入新色彩或邊框風格，符合 guidelines；escape HTML 屬安全/正確性行為非視覺變更。
