<!--
Each task description MUST state:
- the behavior or contract being delivered (what is observably true when the
  task is complete), and
- the verification target that proves completion (test, CLI invocation,
  analyzer check, manual assertion, or content review).

File paths are supporting context for locating the work, never the task
itself. "Edit file X" is not a valid task — it is missing both behavior and
verification.
-->

## 1. 後端 session 與 transcript contract

- [x] 1.1 交付 Session analytics include agent identity：`get_day_top_sessions` 回傳每列都包含 `agent + session_id`，且排序仍依 token total 由大到小；以 `cargo test --manifest-path src-tauri/Cargo.toml tokens::` 與 fixture review 驗證 `agent` shape 和排序。
- [x] 1.2 交付 Session transcript commands、Session listing contract 並符合設計決策 Use `agent + session_id` as the deep-link identity：新增/完善 History session list、read transcript、reveal transcript Tauri commands，單一 session 操作必須用 `agent + session_id`；以 Rust tests 覆蓋 found、not-found、read error 三種結果。
- [x] 1.3 交付 Transcript content is not persisted in analytics storage、Privacy and persistence boundary 並符合設計決策 Read transcripts on demand instead of storing them in analytics DB：讀取 transcript 時不新增 analytics DB transcript body 欄位、不寫 app settings；以 code review 和 `rg -n "transcript|content|body" src-tauri/src/tokens src-tauri/src/commands` 驗證持久化邊界。
- [x] 1.4 交付 Normalize transcript data behind one backend command family 與 Transcript read contract：Codex/Claude transcript adapter 需輸出共用 normalized transcript shape，至少區分 user、assistant、tool/system/other、usage entries；以 Rust fixture tests 驗證 Codex JSONL 與 Claude JSONL 的 entry order 和 role mapping。

## 2. History 頁面與導航

- [x] 2.1 交付 History page lists local sessions 並符合設計決策 Add History as a top-level page：`/history` 頁載入後顯示 session list、empty state 與 unavailable 狀態；以 `npm run check` 和瀏覽器/Tauri 手動檢查驗證。
- [x] 2.2 交付 app-pages Registered Pages、app-routing Router uses Memory Router 與 History page navigation and route contract：`history` 必須出現在 route table、`NAV_ITEMS`、Sidebar、Header、Command Palette，`/history` 使用 memory router lazy-load；以 `npm run check`、`rg -n "history" src/router.tsx src/lib/stores/navigation.ts src/lib/components/layout src/lib/components/shared/CommandPalette.tsx` 和手動導航驗證。
- [x] 2.3 交付 History page reads a selected transcript：選取 session 後顯示 metadata、source path、ordered entries，missing/unreadable 時保留 selected identity 並顯示非崩潰錯誤；以 component/manual fixture review 和 `npm run check` 驗證。
- [x] 2.4 交付 History page supports agent and metadata filtering 並符合設計決策 Keep History first version filterable but not full-text searchable：列表支援 agent filter 與 session/project/model metadata text filter，但不做全文 transcript 搜尋；以 component/manual fixture review 驗證 spec examples 的 filter output。
- [x] 2.5 交付 History page can reveal transcript source files：History viewer 提供 reveal source action，成功時開啟 OS file manager，失敗時顯示 not-found 並保留 selected session；以 Tauri 手動檢查和 `npm run check` 驗證。

## 3. Tokens 到 History 的整合

- [x] 3.1 交付 Tokens Daily sessions link to History 與 Tokens-to-History deep link contract：`/tokens` Daily Top sessions 的主要 action 導向 `/history?agent=<agent>&session=<session_id>`，且既有 reveal action 若保留需明確區分；以手動檢查從 `/tokens` deep link 到 History 的 selected session 驗證。
- [x] 3.2 完成整體品質驗證：`npm run check` 與 `cargo test --manifest-path src-tauri/Cargo.toml tokens::` 通過，並執行 `spectra analyze add-history-page --json` 確認 artifacts 無 Critical findings。
