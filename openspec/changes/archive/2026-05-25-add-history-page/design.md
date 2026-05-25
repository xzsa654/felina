## Context

Felina 已有 `/tokens` dashboard 與 Daily Top sessions，可用 session ID 找到高用量對話。最近新增的 session transcript resolver 已能用 `agent + session_id` 定位本機原始檔，但使用者仍只能從 `/tokens` 單點觸發，沒有獨立頁面瀏覽過往紀錄或讀取內容。

現有 routing 使用 React memory router，導航來源包含 route table、`NAV_ITEMS`、Sidebar、Header 與 Command Palette。token analytics DB 目前保存聚合用量與 session ID，不保存完整 prompt 或 transcript 內容。

## Goals / Non-Goals

**Goals:**

- 新增 top-level History 頁，讓使用者瀏覽本機 agent session 歷史。
- 支援從 `/tokens` Daily Top sessions deep link 到 History 的指定 session。
- 提供 transcript 讀取 API，將 Codex/Claude JSONL 解析為共用 viewer 資料形狀。
- 保留 reveal-in-file-manager 行為，讓使用者可回到原始檔。
- 將 transcript 內容視為敏感資料，只在使用者打開 session 時讀取。

**Non-Goals:**

- 不做全文搜尋、AI 摘要、自動標題生成或跨裝置同步。
- 不把完整 transcript 寫入 token analytics DB。
- 不要求 Gemini 第一版一定能完整呈現 transcript；來源不足時提供 unavailable 狀態。
- 不重新設計 `/tokens` dashboard 的資訊架構。

## Decisions

### Add History as a top-level page

History 應作為 Sidebar 的一級頁面，而不是 `/tokens` 子面板。原因是「查看過往對話」是獨立工作流，使用者也可能不先經過用量分析就想回看紀錄。

Alternative considered: 將 transcript viewer 內嵌在 `/tokens` Daily detail。此做法能快速完成 drill-down，但會把 tokens dashboard 變成歷史瀏覽器，且不利於未來從 Command Palette 或其他頁面進入。

### Use `agent + session_id` as the deep-link identity

History deep link 使用 `agent` 和 `session_id` 定位 session。單獨使用 `session_id` 不足以跨 agent 保證唯一，也無法知道要搜尋哪個本機 log 目錄。

Alternative considered: 使用原始檔 path 作為 URL 參數。此做法較直接，但會把本機路徑暴露在 navigation state 中，也比較容易因檔案搬移而失效。

### Read transcripts on demand instead of storing them in analytics DB

History viewer 讀取原始 transcript 檔並在前端呈現，token analytics DB 僅保存用量索引與 session identity。這能避免把敏感 prompt、工具輸出和檔案內容混入 analytics storage。

Alternative considered: 建立 transcript cache table。此做法可提升列表與搜尋速度，但會擴大敏感資料持久化範圍，且第一版沒有全文搜尋需求。

### Normalize transcript data behind one backend command family

後端應提供 session listing、transcript resolve/read 和 reveal commands，前端只消費共用 JSON shape。不同 agent 的原始 JSONL/JSON 差異應留在 Rust adapter 層，避免 History UI 知道各 agent 檔案格式。

Alternative considered: 前端拿 path 後自行讀檔解析。Tauri 前端不應直接擁有本機檔案讀取與格式解析責任，也會讓權限和錯誤處理分散。

### Keep History first version filterable but not full-text searchable

第一版列表提供 agent、project、date/session identity 等輕量篩選，並支援 deep link selection。全文搜尋需要索引、隱私策略與效能設計，應延後。

Alternative considered: 一次做全文搜尋。這會迫使第一版建立 transcript cache 或每次掃描大量 JSONL，增加 scope 與效能風險。

## Implementation Contract

### History page navigation and route contract

The app must register a `history` page in the route table, navigation item source, Sidebar, Header, and Command Palette. The route must be `/history`. A direct navigation to `/history?agent=<agent>&session=<session_id>` must open the History page and attempt to select that session after data loads.

Acceptance criteria: inspect route/navigation sources for the `history` entry, run `npm run check`, and manually navigate to `/history` and a deep-link URL in the Tauri app.

### Session listing contract

The backend must expose a Tauri command that returns sessions usable by History. Each row must include at least `agent`, `session_id`, optional `project`, optional `model`, timestamp or date metadata when available, token/message totals when available, and a status indicating whether the transcript file can be resolved.

The frontend must render a scannable list with agent, session identity, project/model metadata, token/message totals if present, and an empty/unavailable state when no sessions are found.

Acceptance criteria: add focused Rust tests or fixture-backed tests for list shape, and verify the History page renders rows from existing local session data.

### Transcript read contract

The backend must expose a Tauri command that reads one transcript by `agent + session_id` and returns a normalized transcript shape. The shape must include source path, agent, session ID, metadata, and ordered entries. Entries must distinguish at minimum user-like content, assistant-like content, tool/system/other content, and token usage entries when present.

The command must fail with a clear not-found error when no transcript file exists, and with a parse/read error when a file exists but cannot be read. The UI must surface these errors without crashing and must retain the selected session identity.

Acceptance criteria: add Rust parser tests for Codex session JSONL and Claude conversation JSONL fixtures, run `cargo test --manifest-path src-tauri/Cargo.toml tokens::`, and manually open a known local session from History.

### Tokens-to-History deep link contract

`/tokens` Daily Top sessions must include an action that navigates to `/history?agent=<agent>&session=<session_id>`. The existing reveal action may remain available, but the primary product path must support opening the History page for that session.

Acceptance criteria: from `/tokens`, expand a daily row, click a Top sessions action, and verify History opens with the matching session selected or displays a not-found state for that exact identity.

### Privacy and persistence boundary

The implementation must not store full transcript content in token analytics DB or app settings. It may read transcript content on demand and hold it in frontend memory for the active view. Any future cache or indexing work requires a separate change.

Acceptance criteria: code review confirms no migration adds transcript text columns and no settings write persists transcript body content.

## Risks / Trade-offs

- [Risk] Some agent logs may not have stable timestamps or consistent message roles → Mitigation: show best-effort metadata and keep unavailable/other entry types explicit.
- [Risk] Large transcript files may make the viewer slow → Mitigation: read one selected transcript on demand and consider entry virtualization only if needed during implementation.
- [Risk] Deep links can point to deleted local files → Mitigation: show a clear not-found state and keep reveal/read failures non-fatal.
- [Risk] Transcript content is sensitive → Mitigation: avoid persistent transcript storage and show source path so users understand what is being read.
