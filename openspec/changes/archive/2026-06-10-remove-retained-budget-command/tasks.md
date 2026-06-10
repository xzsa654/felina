## 1. Baseline

- [x] 1.1 [P] 跑 baseline `npm run check`，在 apply notes 記錄 exit code 與主要 TypeScript 錯誤摘要，方便最終驗證區分 pre-existing failures 與本 change 引入的 regressions。
- [x] 1.2 [P] 在 `src-tauri/` 跑 baseline `cargo check --lib`，在 apply notes 記錄 exit code 與任何 pre-existing Rust warning/error。

## 2. Felina quota TTL IPC

對應設計：「TTL 落地 `~/.felina/settings.json`，新增專用 commands 而非通用 scope」、「Default TTL fallback 為 60 秒」。涵蓋 requirements：「Felina quota TTL IPC」。

- [x] 2.1 實作 **Felina quota TTL IPC** 後端 helper。新增 backend module（建議 `src-tauri/src/commands/felina_settings.rs`，或於既有 module 內聯）：實作 `read_quota_ttl_seconds()` helper 讀 `paths::felina_global_settings_path()` JSON 的 `quotaTtlSeconds`，檔案或欄位不存在時回 `60`，parse error 視為「無設定」回 `60`。實作 `write_quota_ttl_seconds(seconds: u64)` helper：read-modify-write 整個 JSON 物件以保留其他欄位（例如 `agentPaths`），atomic write（temp file + rename），檔案不存在時建立。範圍驗證 `30..=3600`，超出回 `Err("quota TTL must be between 30 and 3600 seconds")`。驗證：在同 module 加 unit tests 覆蓋（i）檔案不存在回 fallback、（ii）round-trip 保留 `agentPaths` 欄位、（iii）out-of-range 拒絕。`cargo test --lib` 通過。
- [x] 2.2 暴露 **Felina quota TTL IPC** Tauri commands `get_felina_quota_ttl() -> Result<u64, String>` 與 `set_felina_quota_ttl(seconds: u64) -> Result<(), String>`，在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊；在 `src-tauri/src/commands/mod.rs` 宣告 module。驗證：`cargo check --lib` 通過。
- [x] 2.3 [P] 在 `src/lib/tauri/commands.ts` 新增 `felinaSettings.getQuotaTtl` / `setQuotaTtl` wrapper：`getQuotaTtl: () => invoke<number>("get_felina_quota_ttl")`、`setQuotaTtl: (seconds: number) => invoke<void>("set_felina_quota_ttl", { seconds })`。驗證：`npm run check` 通過。

## 3. Migrate quota TTL consumers

對應設計：「`ccusage::quota_cache_ttl` 直接讀檔，不走 IPC」。涵蓋 requirements：「Backend quota cache uses Felina settings」、「Agent quota panel TTL persistence」。

- [x] 3.1 實作 **Backend quota cache uses Felina settings**：修改 `src-tauri/src/tokens/ccusage.rs::quota_cache_ttl`：移除 `crate::commands::budget::get_budget()` 與 `default_quota_ttl_seconds()` 呼叫，改為呼叫 Phase 2 的 `read_quota_ttl_seconds()` helper（同 crate path）。驗證：`cargo check --lib` 通過、ccusage 既有測試（若有）通過。
- [x] 3.2 在 `src/lib/components/tokens/hooks/useTokenQueries.ts` 新增 `useFelinaQuotaTtl()`（query，queryKey `["felinaSettings","quotaTtl"]`、`queryFn: api.felinaSettings.getQuotaTtl`、`staleTime: 5 * 60 * 1000`）與 `useSetFelinaQuotaTtl()`（mutation，呼 `api.felinaSettings.setQuotaTtl`，onSuccess invalidate query key）。實作 optimistic update 模仿 `useSetBudgetSettings` 既有 pattern。驗證：`npm run check` 通過。
- [x] 3.3 實作 **Agent quota panel TTL persistence**：修改 `src/lib/components/tokens/components/AgentQuotaPanel.tsx`：把 `useBudgetSettings` / `useSetBudgetSettings` 改為 `useFelinaQuotaTtl` / `useSetFelinaQuotaTtl`，欄位名 `quota_ttl_seconds` → `number`（直接是 TTL 秒數）。`budgetTtl ?? 60` 改為 `ttlQuery.data ?? 60`。setSelect onChange 改呼新 mutation `mutate(seconds)`（不再傳整個 `BudgetSettings` partial）。驗證：`npm run check` 通過，無 dangling `budget` import。

## 4. Remove retained Budget surface

對應設計：「保留 `CostBudgetCard`」（確認 `/tokens` analytics 卡片在拔 Budget 期間不受影響）。

- [x] 4.1 [P] 刪除 `src-tauri/src/commands/budget.rs` 整檔；從 `src-tauri/src/commands/mod.rs` 移除 `#[allow(dead_code)] pub(crate) mod budget;` 宣告。驗證：`rg "get_budget|set_budget|get_cost_summary|glyphic-settings|default_quota_ttl_seconds" src-tauri/src` 無 matches；`cargo check --lib` 通過。
- [x] 4.2 [P] 刪除 frontend `src/lib/tauri/commands.ts` 的 `api.budget` wrapper、`BudgetSettings` interface、`CostSummary` interface（與其依賴 type 如 `ProjectCost` 若僅 budget 使用）。Retained-for-reference 註解若含 "budget"，更新為僅列實際保留項目。驗證：`rg "api\\.budget|BudgetSettings|CostSummary|get_budget|set_budget|get_cost_summary" src/lib/tauri` 無 matches。
- [x] 4.3 [P] 刪除 `src/lib/components/tokens/hooks/useTokenQueries.ts` 的 `useBudgetSettings`、`useSetBudgetSettings`，與 `tokenKeys.budget` 若無其他 consumer。驗證：`rg "useBudgetSettings|useSetBudgetSettings|tokenKeys\\.budget" src` 無 matches；`npm run check` 通過。

## 5. Live spec drift cleanup

對應設計：「Live spec drift 清理，archived 保持歷史」。

- [x] 5.1 移除 live specs 中把 `src-tauri/src/commands/budget.rs` 列為 active related code 的所有 references。涵蓋檔案（依 baseline grep 結果）：`openspec/specs/{agent-skills-schema,app-routing,frontend-i18n,multi-agent-skills,token-analytics-api,token-analytics-dashboard,token-data-ingestion,token-incremental-scanning,token-pricing,token-usage-source-of-truth,tokscale-backed-token-ingestion}/spec.md`。驗證：`rg "src-tauri/src/commands/budget.rs" openspec/specs` 無 matches；`openspec/changes/archive` 下保留歷史不動。

## 6. Final verification

- [x] 6.1 跑 `npm run check`，確認 exit 0；若 baseline 有 pre-existing failures，failure diff 為 0。
- [x] 6.2 從 `src-tauri/` 跑 `cargo check --lib`，確認 exit 0；若 baseline 有 pre-existing failures，failure diff 為 0。
- [x] 6.3 跑 `spectra analyze remove-retained-budget-command --json` 與 `spectra validate remove-retained-budget-command`，確認 analyze 無 Critical/Warning findings、validate exit 0。
- [x] 6.4 Manual smoke：`npm run tauri dev`，到 `/tokens` 頁，TTL 下拉選 30s → reload → 確認下拉仍顯示 30s 且 quota 卡片 refetch 間隔對應；`cat ~/.felina/settings.json` 確認 `quotaTtlSeconds: 30` 寫入；`agentPaths` 欄位未被覆蓋；改回 60s 再驗證一次。記錄結果於 apply notes。
