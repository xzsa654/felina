## Context

History 頁透過 `read_session_transcript` command 讀取各 agent 的 session JSONL，由 transcript 解析函式（src-tauri/src/commands/tokens.rs 的 `transcript_entries_from_value` 與 `infer_transcript_role`）攤平成 `TranscriptEntry { role, content, timestamp, model, usage 欄位 }`。原始 JSONL 中可區分「後台運作 vs 使用者可見對話」的訊號在解析時被丟棄：

- **Claude Code**：`isSidechain: true`（subagent 對話）、`isMeta: true`（harness meta 訊息）、user role 但 content 為 `tool_result` block（工具輸出）、`type: "system"` 行（hook 輸出）、內文以 `<system-reminder>` / `<local-command-stdout>` / `Caveat:` 開頭的 harness 注入文字
- **Claude Code slash command**：使用者輸入 `/foo args` 時，transcript 的 user 行被包裝為 `<command-message>foo</command-message> <command-name>/foo</command-name> <command-args>args</command-args>` — 這是使用者真實輸入的對話內容，只是格式被 harness 包裝
- **Codex**：`response_item` payload 的 `reasoning` / `function_call` / `function_call_output` type，目前被 `normalized_role` 一律折成 `assistant`
- **Gemini**：本機無 session transcript 檔可驗證（apply 時已查證），無可靠 background 訊號

前端 HistoryPage 已有三顆 transcript filter pill（All / Conversation / Usage），Conversation 目前語意是「非 usage」，因此後台內容全部混在 Conversation 檢視裡。

可重用的現有元件：filter pill UI 與 `matchesTranscriptEntry` 過濾函式（src/lib/components/history/HistoryPage.tsx）、`TranscriptEntry` 型別（src-tauri/src/tokens/types.rs、src/lib/types/token-analytics.ts）。不需新增任何 UI 元件。

## Goals / Non-Goals

**Goals:**

- transcript entry 帶 channel 分類（conversation / background），讓前端能過濾出使用者視角的對話
- slash command 的 user 行歸 conversation，且內容還原為使用者實際輸入形式（`/指令 參數`）
- Conversation filter 升級為「只看對話」：排除 background entry 與 usage entry
- 分類與還原邏輯有單元測試覆蓋（每種訊號至少一個 case）

**Non-Goals（Out of Scope）:**

- 不改 History 頁版面、不新增 filter pill（重用既有三顆）
- 不改 usage entry 的產生與顯示邏輯
- 不做 background entry 的進一步細分（如 tool vs reasoning vs sidechain 分組顯示）— channel 只有兩值
- 不改 token 統計、不影響 ingestion / aggregation 路徑
- 不處理 transcript 搜尋 highlight

**In Scope:**

- src-tauri/src/commands/tokens.rs（channel 判定 + slash command 還原 + 測試）、src-tauri/src/tokens/types.rs、src/lib/types/token-analytics.ts、src/lib/components/history/HistoryPage.tsx

## Decisions

**1. channel 是新欄位，不是新 role**

role 已承載顯示樣式（bubble 配色、pill 文字），channel 是正交的過濾維度（同一個 user role entry 可能是真輸入也可能是 tool_result）。混進 role 會破壞既有顯示邏輯；獨立欄位讓前端 filter 與顯示各自演進。

**2. 判定策略：結構訊號優先、內文 prefix 為輔，無法判定一律歸 conversation**

結構欄位（isSidechain、isMeta、content block type、payload type、line type）是穩定 API 形狀；內文 prefix（`<system-reminder>` 等）是啟發式，格式改版可能漏判。fail-open 設計：漏判頂多多顯示幾條後台內容，絕不誤吞真對話。拒絕的替代方案：白名單制（只有明確 conversation 訊號才顯示）— 誤吞風險不可接受。

**3. slash command user 行是 conversation，內容還原而非隱藏**

`<command-name>` / `<command-args>` 包裝的 user 行是使用者真實輸入（例如輸入 `/spectra-discuss xxx`），不是 harness 後台內容。分類為 conversation，並把 content 重組為 `<command-name 值> <command-args 值>`（即 `/spectra-discuss xxx`）。同理，含 `<bash-input>` 的 user 行是 `!` shell escape 輸入，重組為 `! <指令>` 並捨棄隨附的 `<bash-stdout>` / `<bash-stderr>` 包裝。重組失敗（tag 結構不完整）時保留原文、仍歸 conversation（fail-open）。`<local-command-stdout>` / `<local-command-caveat>` 與「僅含 bash-stdout/bash-stderr、無 bash-input」的行不是使用者輸入，歸 background。

**4. 判定在後端做，不在前端做**

理由：(a) 結構訊號只存在於原始 JSONL，`TranscriptEntry` 攤平後已遺失，前端判定只能靠內文猜；(b) Rust 端可直接對三種 agent 格式寫單元測試；(c) 前端只需一行過濾條件。

**5. serde 序列化：`channel` 採字串值（"conversation" / "background"），與既有 role 欄位風格一致**

前端型別用 union literal `"conversation" | "background"`。不設 Option — 解析時必定產出判定結果（預設 conversation）。

**6. Conversation filter 語意升級而非新增第四顆 pill**

使用者需求就是「只看對話 / ALL」二態切換，既有 Conversation pill 語意升級正好滿足，不增加 UI 面積。All 維持顯示全部（含 background 與 usage），Usage 不變。

**安全敏感性評估**：本 change 解析外部輸入（JSONL），但僅做唯讀分類與文字重組、不執行內容、不寫檔；解析層既有的 serde 錯誤處理不變。判定為低敏感，tasks 不需獨立 /spectra-audit 步驟。

**UI-related 標記**：本 change 修改 HistoryPage 的 filter 行為，無新視覺元素、無新樣式。屬輕量 UI-related — tasks 包含 /felina-ui-guidelines 對照確認步驟，驗證結論寫進 archive notes。

**依賴評估**：無新增 npm / Cargo 依賴。

## Implementation Contract

**行為**：

- `read_session_transcript` 回傳的每個非 usage entry 帶 `channel` 欄位；usage entry 也帶（固定 conversation，但前端 Usage/Conversation filter 均以 role 優先判斷，不受影響）
- Claude Code transcript 中下列 entry 的 channel 為 `background`：`isSidechain == true` 的行、`isMeta == true` 的行、`type == "system"` 的行、user role 但 content 僅含 tool_result block 的行、user role 且內文 trim 後以 `<system-reminder>`、`<local-command-stdout>`、`<local-command-caveat>`、`Caveat:` 任一 prefix 開頭的行
- Claude Code transcript 中含 `<command-name>` 包裝的 user 行：channel 為 `conversation`，content 還原為 `<command-name 值> <command-args 值>` 串接（args 為空時僅指令名）；含 `<bash-input>` 的 user 行：channel 為 `conversation`，content 還原為 `! <bash-input 值>`（捨棄 bash-stdout/bash-stderr）；僅含 bash-stdout/bash-stderr 的 user 行：channel 為 `background`；tag 結構不完整時保留原文、channel 仍為 conversation
- Codex transcript 中 payload type 為 `reasoning`、`function_call`、`function_call_output` 的 response_item，channel 為 `background`
- 其餘 entry（含無法判定者）channel 為 `conversation`
- History 頁 Conversation filter 啟用時，僅顯示 `role != "usage"` 且 `channel == "conversation"` 的 entry；All 顯示全部；Usage 僅顯示 usage entry（後兩者行為不變）

**介面 / 資料形狀**：

- Rust：`TranscriptEntry` 增 `pub channel: String`（值域 "conversation" / "background"，serde 正常序列化、無 skip、無 Option）
- TypeScript：`TranscriptEntry` 增 `channel: "conversation" | "background"`
- 過濾邏輯收在既有 `matchesTranscriptEntry`，不新增前端函式

**失敗模式**：

- JSONL 行解析失敗：維持既有行為（整檔報錯），channel 判定不引入新錯誤路徑
- 訊號欄位缺失或格式不符：靜默歸 conversation（fail-open，刻意不 surface）
- slash command tag 重組失敗：保留原文顯示，channel conversation

**驗收標準**：

- cargo test：tokens.rs 單元測試覆蓋 — sidechain 行、isMeta 行、tool_result content 行、system 行、harness prefix 行（system-reminder / local-command-stdout / Caveat）、Codex reasoning/function_call 行各判為 background；一般 user 輸入與 assistant 文字判為 conversation；slash command 行判為 conversation 且 content 還原為 `/指令 參數`；訊號缺失時預設 conversation
- npm run check 通過
- 手動驗證（npm run tauri dev）：選一個含 subagent / tool 呼叫的 Claude Code session，Conversation filter 下不再出現 system-reminder、tool 輸出與 sidechain 內容，slash command 顯示為 `/指令 參數` 原始輸入形式；切 All 可看到全部

**範圍邊界**：僅上述四檔；不動 ingestion、aggregation、其他頁面。

## Risks / Trade-offs

- [harness 注入 prefix 是啟發式，agent 格式改版可能漏判] → fail-open 設計保證不誤吞；漏判的後台內容仍可在 All 檢視確認，後續可增補 prefix 清單
- [slash command tag 格式（command-message/name/args 順序與巢狀）若改版，重組可能失效] → 重組失敗保留原文，顯示退化但不遺失資訊
- [Gemini session 格式的 background 訊號未經實證] → 已查證本機無 Gemini transcript 檔；Gemini entry 全部歸 conversation（行為等同現狀，不退化）
- [Conversation filter 預設值即為啟用（現有 state 預設 "conversation"），語意升級後使用者首次打開直接看到較少 entry] → 屬預期行為（這正是需求目的）；All pill 一鍵可回全量
