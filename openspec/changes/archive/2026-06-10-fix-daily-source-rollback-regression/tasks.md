## 1. Baseline

- [x] 1.1 在 src-tauri/ 跑 baseline `cargo test --lib tokens::`，於 apply notes 記錄目前唯一失敗為 `tokens::aggregator::tests::active_source_can_roll_back_to_legacy_parser_rows`（assertion left 999 != right 321），其餘 tokens 測試全綠，以便最終驗證區分 pre-existing 與本 change 引入的 regression。

## 2. TDD：固化三分支同規則的 rollback 測試

對應 requirement：「Honor explicit rollback in default analytics source resolution」的 Scenario「Explicit rollback to felina_parser is honored」。

- [x] 2.1 在 src-tauri/src/tokens/aggregator.rs 測試模組新增 `weekly_analytics_honors_explicit_rollback_to_felina_parser` 與 `monthly_analytics_honors_explicit_rollback_to_felina_parser`：仿照既有 `active_source_can_roll_back_to_legacy_parser_rows` 的資料佈置（legacy felina_parser rows input=321/output=123/events=1 + tokscale rows input=999/output=111/events=3），`set_active_source(SOURCE_FELINA_PARSER)` 後分別以 `TimeGranularity::Weekly`、`TimeGranularity::Monthly` 呼叫 `build_analytics`，斷言回傳 legacy 總量（321/123/1、model_breakdown 為 legacy-model）。驗證：兩個新測試與既有 Daily rollback 測試在修正前皆 FAILED（red），確認測試確實覆蓋缺陷。

## 3. 修正 default_analytics_source

對應 requirement：「Honor explicit rollback in default analytics source resolution」全部 Scenarios。

- [x] 3.1 實作 **Honor explicit rollback in default analytics source resolution**：修改 src-tauri/src/tokens/aggregator.rs 的 `default_analytics_source`：Daily、Weekly、Monthly 三分支統一改為（i）先讀 `active_source()`；（ii）active source 為 `SOURCE_FELINA_PARSER` 時直接回傳之，不查 tokscale row count；（iii）否則維持現行邏輯 — `count_events_for_source(SOURCE_TOKSCALE_EXPORT) > 0` 則回 `SOURCE_TOKSCALE_EXPORT`，否則回 active source。Hourly 分支不動。三分支共用同一 helper 或同一段邏輯，消除複製貼上分歧。行為契約：明確 rollback 被尊重、`parser_fallback` 與 `tokscale_export` 狀態下聚合視圖仍 tokscale 優先。驗證：task 2.1 的兩個新測試與 `active_source_can_roll_back_to_legacy_parser_rows` 轉綠，且 `monthly_analytics_prefers_tokscale_export_over_parser_fallback_active_source` 維持綠（期望不翻轉）。
- [x] 3.2 更新 `default_analytics_source` 的 doc comment，使其描述實際三狀態規則：felina_parser（明確 rollback）一律尊重；tokscale_export 與 parser_fallback 狀態下 Daily/Weekly/Monthly 在 tokscale rows 存在時優先 `tokscale_export`；Hourly 一律 active source。移除「Daily views keep using the active ingestion source」這句與實作矛盾的舊敘述。驗證：comment 內容與 task 3.1 實作逐條對應，無殘留舊語意。

## 4. Final verification

- [x] 4.1 在 src-tauri/ 跑 `cargo test --lib tokens::`，確認 0 failed（含 baseline 那筆 pre-existing failure 已轉綠），failure diff 相對 baseline 為 -1、無新增失敗。
- [x] 4.2 跑 `spectra analyze fix-daily-source-rollback-regression --json` 與 `spectra validate fix-daily-source-rollback-regression`，確認 analyze 無 Critical/Warning findings、validate exit 0。
