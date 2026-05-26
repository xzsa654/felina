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

## 1. 資訊架構與資料語意

- [x] 1.1 交付 Insight-first tokens dashboard hierarchy：`/tokens` 首屏以總 tokens、estimated cost、message count、cache composition、agent/model split、source/data resolution status 呈現主要重點，並符合設計決策 Keep source status compact and diagnostic detail expandable；以 Playwright 或瀏覽器手動檢查 aggregate-only fixture 首屏不需要先閱讀三張時間圖即可理解「用量最大來源、cache 佔比、資料來源狀態」。
- [x] 1.2 交付 Data resolution governs temporal views 的資料解析契約：前端從現有 analytics response 推導 `all`、dated bucket、hourly bucket 的 resolution 狀態，並讓 temporal sections 依狀態決定是否顯示圖表或說明；以單元測試或 component test 覆蓋 only-`all`、dated、hourly 三種輸入。

## 2. 核心洞察元件

- [x] 2.1 交付 Top models insight table 並符合設計決策 Make Top Models the primary analytical surface：模型列需顯示 model、agent、total tokens、input/output/cache/reasoning composition、cache read %、message count、estimated cost，且排序能突顯最大 token 貢獻；以 component test 或 fixture review 驗證 `claude-opus-4-6` 與 `gpt-5.5` 範例排序與欄位值合理。
- [x] 2.2 交付 cache 與 agent split 的可讀摘要：使用者可直接看出 cache read 是 token 主體時的節省/重複使用訊號，以及各 agent 在總量中的佔比；以瀏覽器手動檢查 aggregate-only fixture 驗證摘要與 Top models 數字一致。

## 3. 時間圖表降級與成本標示

- [x] 3.1 交付 Data resolution governs temporal views 並符合設計決策 Gate temporal charts by data resolution：當資料只有 `all` bucket 時，每小時活動、Token 使用趨勢、費用趨勢 (USD) 不再呈現空白或誤導性時間序列，而是顯示「目前資料沒有時間粒度」的狀態與仍可用的 aggregate insights；以瀏覽器手動檢查與 `npm run check` 驗證。
- [x] 3.2 交付 dated/hourly bucket 的 secondary temporal view：當 response 含日期或小時 bucket 時，時間圖表仍可產出並位於主要洞察之後，避免遮蔽 Top Models；以 component test 或 fixture review 驗證 dated buckets 會產生趨勢資料。
- [x] 3.3 交付 Estimated cost transparency 並符合設計決策 Treat cost as estimated unless pricing confidence is explicit：所有 cost label、tooltip、table header、chart title 在缺少 billing confidence 時標示 estimated，避免把價格估算表述成實際帳單；以 `rg -n "Cost|cost|USD|estimated" src/lib/components/tokens src/lib/i18n` 與瀏覽器手動檢查驗證。

## 4. 狀態、錯誤與驗證

- [x] 4.1 交付 Compact refresh and source diagnostics 並符合設計決策 Keep source status compact and diagnostic detail expandable：成功狀態以簡短 source badge/last refreshed 顯示，missing_binary、parse failure、stale data 等錯誤可展開查看且不清空既有 analytics；以手動注入 error fixture 或現有錯誤狀態測試驗證。
- [x] 4.2 完成整體品質驗證：`npm run check` 通過，若觸及 Tauri response type 或 Rust command contract 則加跑 `cargo test --manifest-path src-tauri/Cargo.toml tokens::`；以命令輸出作為 apply 階段完成證據。
