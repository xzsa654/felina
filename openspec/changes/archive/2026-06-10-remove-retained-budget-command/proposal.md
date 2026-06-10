## Summary

修好損壞的 Quota TTL 設定，並移除已成 dead code 的 Budget command surface。TTL 落腳於既有的 `~/.felina/settings.json`，前後端共用同一個值；`budget.rs` 與相關 frontend wrapper、live spec drift 一併清理。

## Motivation

調查發現 `src-tauri/src/commands/budget.rs` 與 frontend `api.budget` 早已沒有掛在 `invoke_handler!` 上，所有 `get_budget` / `set_budget` / `get_cost_summary` IPC 呼叫實際都會失敗：

- `AgentQuotaPanel` 的 TTL 下拉選單看似可調，但 `useBudgetSettings` query 永遠 error，使用者選擇不持久；
- 後端 `ccusage::quota_cache_ttl` 自呼 `budget::get_budget()`，因 `~/.claude/glyphic-settings.json` 從未被建立，永遠 fallback 到 hard-coded `180` 秒；
- 結果前端 panel 用 fallback `60s`、後端用 `180s`，前後端 cache window 不一致，UI 設定形同擺設。

`BudgetSettings` 其他三個欄位（`daily_limit` / `monthly_limit` / `plan_type`）失去 UI 入口（`SettingsPage.tsx` 已不存在），唯一還有意義的是 `quota_ttl_seconds`。本 change 把這個唯一活著的設定搬到 `~/.felina/settings.json`、修好 UI、其餘整段 Budget surface 一律拔除，避免 dead command 與 namespace pollution 風險。

## Proposed Solution

- 後端新增 minimal Tauri commands `get_felina_quota_ttl` / `set_felina_quota_ttl`，直接讀寫 `~/.felina/settings.json`。寫入時保留檔案中既有的其他欄位（例如 `agentPaths`），不引入額外 settings 抽象層。
- `ccusage::quota_cache_ttl` 改為直接讀 `~/.felina/settings.json` 的 `quotaTtlSeconds`；不存在時 fallback `60` 秒（與 panel 現行 fallback 對齊）。
- `AgentQuotaPanel` 與 `useTokenQueries` hooks 改用新 wrapper；移除 `useBudgetSettings` / `useSetBudgetSettings` 與所有 `api.budget` 引用。
- 移除 `src-tauri/src/commands/budget.rs` 與 `commands/mod.rs` 內的宣告；移除 frontend `api.budget` wrapper、`BudgetSettings` / `CostSummary` types。
- 修正 live specs 把 `src-tauri/src/commands/budget.rs` 列為 active related code 的 drift。

## Non-Goals

- 不重建 `daily_limit` / `monthly_limit` / `plan_type` 等 budget concept 的設定能力。
- 不恢復或註冊 `get_budget` / `set_budget` / `get_cost_summary`。
- 不建立通用 Settings IPC 抽象層（`api.settings` scope system）；本 change 只處理 quota TTL。
- 不移除 `CostBudgetCard` 或 `/tokens` 的 analytics-derived cost summary。
- 不重寫 archived Spectra artifacts。
- 不遷移 `~/.claude/glyphic-settings.json` 中除 TTL 外的舊資料（檔案在多數使用者機器上根本不存在）。

## Alternatives Considered

- 完全拔掉 TTL 設定能力、後端 hard-code 預設值。捨棄原因：使用者保留調整能力的需求合理（rate-limit 風險因環境而異），且修好成本小。
- 擴充既有 Settings IPC 系統建立 `"felina"` scope。捨棄原因：經查 `commands/settings.rs` 與 `api.settings` 並不存在，proposal 的前提系統失效；只為一個 TTL 設定建立完整 scope 抽象 over-engineered。
- 維持寫入 `~/.claude/glyphic-settings.json`。捨棄原因：把 Felina 內部 cache 設定寫入 Claude 目錄屬 namespace pollution；既然要修，順手挪到 `~/.felina/settings.json`。

## Capabilities

### New Capabilities

- `felina-quota-ttl-settings`: Felina 應提供 IPC 讓 UI 與 backend 讀寫共用的 quota cache TTL，儲存於 `~/.felina/settings.json`。

### Modified Capabilities

- `token-analytics-dashboard`: AgentQuotaPanel SHALL 透過新 IPC 持久化 TTL 設定到 `~/.felina/settings.json`，前後端 cache window 共用同一值。CostBudgetCard 行為不變（已不依賴 Budget IPC）。

其他被 tasks 5.1 trace-cleanup 觸及的 spec 檔（app-routing、token-data-ingestion、token-analytics-api、token-pricing 等）僅有 trace block drift、無 normative 規範變動，故不另產出 spec delta。

## Impact

- Affected specs: token-analytics-dashboard, app-routing, token-data-ingestion, token-analytics-api, token-pricing, token-usage-source-of-truth, token-incremental-scanning, tokscale-backed-token-ingestion, agent-skills-schema, frontend-i18n, multi-agent-skills（live spec drift 清理範圍涵蓋所有引用 `budget.rs` 的 active spec 檔）。
- Affected code:
  - Modified:
    - `src-tauri/src/commands/mod.rs`
    - `src-tauri/src/tokens/ccusage.rs`
    - `src-tauri/src/lib.rs`（註冊新 commands）
    - `src/lib/tauri/commands.ts`
    - `src/lib/components/tokens/components/AgentQuotaPanel.tsx`
    - `src/lib/components/tokens/hooks/useTokenQueries.ts`
  - New:
    - `src-tauri/src/commands/felina_settings.rs`（或內聯於既有 module，依實作判斷）
  - Removed:
    - `src-tauri/src/commands/budget.rs`
- Dependencies: 無 npm 或 Cargo dependency 變動。
- Compatibility: 對使用者透明 — 既有 `~/.claude/glyphic-settings.json` 在多數機器上不存在；存在者其 TTL 值不遷移（原本就沒生效），重置為新 default `60` 秒並由 UI 重新設定。
