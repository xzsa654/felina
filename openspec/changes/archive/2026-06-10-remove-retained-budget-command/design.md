## Context

Felina 目前保留 `src-tauri/src/commands/budget.rs`、frontend `api.budget` wrapper、以及 `useBudgetSettings` / `useSetBudgetSettings` React Query hooks。`get_budget` / `set_budget` / `get_cost_summary` 全部沒在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊，所以前端呼叫永遠失敗、`useBudgetSettings` query 永遠 error、TTL 改了不持久。後端 `ccusage::quota_cache_ttl` 直接呼 `budget::get_budget()`（非 IPC，function call），但 `~/.claude/glyphic-settings.json` 在使用者機器上不存在，所以 fallback 永遠返回 hard-coded `180` 秒。`BudgetSettings` 其餘三欄（`daily_limit` / `monthly_limit` / `plan_type`）的 UI 入口 `SettingsPage.tsx` 已不存在；只有 `quota_ttl_seconds` 仍有 UI 顯示。

`~/.felina/settings.json` 已經是 Felina 內部設定的 canonical 位置（目前存放 `agentPaths`）。本 change 把 quota TTL 落地此處、修好前後端一致性、其餘 Budget surface 整段拔除。

相關既有邊界：

- `src-tauri/src/lib.rs`: active Tauri command registration source。
- `src-tauri/src/commands/mod.rs`: backend command module inventory，目前以 `#[allow(dead_code)] pub(crate) mod budget;` 保留 budget。
- `src-tauri/src/paths.rs`: 提供 `felina_global_settings_path()` 指向 `~/.felina/settings.json`。
- `src-tauri/src/tokens/ccusage.rs`: 後端 quota cache TTL 讀取點（`quota_cache_ttl` function）。
- `src/lib/tauri/commands.ts`: typed frontend invoke wrapper。
- `src/lib/components/tokens/components/AgentQuotaPanel.tsx`: TTL 下拉選單與 quota refetch UI。
- `src/lib/components/tokens/hooks/useTokenQueries.ts`: 提供 `useBudgetSettings` / `useSetBudgetSettings` hooks。
- `src/lib/components/tokens/components/CostBudgetCard.tsx`: `/tokens` analytics cost summary，不依賴 Budget IPC，本 change 不動。

## Goals / Non-Goals

**Goals:**

- 提供 minimal Tauri IPC 讓前後端共用 quota TTL，儲存於 `~/.felina/settings.json`。
- 修好 `AgentQuotaPanel` TTL 下拉：使用者選擇持久化、影響後端 cache window。
- 移除已失效的 Budget command surface（backend `budget.rs`、frontend `api.budget`、相關 types、unused hooks）。
- 修正 live specs 中 `budget.rs` references 的 active-code drift。
- 保留 `CostBudgetCard` 與 `/tokens` analytics 行為不變。

**Non-Goals:**

- 不建通用 Settings IPC scope system；本 change 只暴露 quota TTL 一對命令。
- 不恢復 `daily_limit` / `monthly_limit` / `plan_type` 設定能力。
- 不註冊 `get_budget` / `set_budget` / `get_cost_summary`。
- 不從 `~/.claude/glyphic-settings.json` 讀取舊值或執行 migration。
- 不重寫 archived Spectra artifacts。

## Decisions

### TTL 落地 `~/.felina/settings.json`，新增專用 commands 而非通用 scope

新增 `get_felina_quota_ttl` 與 `set_felina_quota_ttl` 兩個 Tauri commands，直接讀寫 `~/.felina/settings.json` 的 `quotaTtlSeconds` 欄位。讀寫時 round-trip 整個 JSON 物件以保留既有 `agentPaths` 等欄位。

替代方案：建立通用 `api.settings.read/write(scope, key)` 抽象層。捨棄原因：`commands/settings.rs` 與 `api.settings` 不存在，只為一個 TTL 設定建立完整 scope 系統 over-engineered；未來真有多個 Felina 設定需求時再泛化。

### `ccusage::quota_cache_ttl` 直接讀檔，不走 IPC

`ccusage` 是 backend internal module，與其呼叫剛才註冊的 IPC command，更直接是讀 `paths::felina_global_settings_path()` JSON、取 `quotaTtlSeconds` 欄位。

替代方案：抽出 backend helper `read_quota_ttl_seconds()` 同時被 IPC 與 ccusage 呼叫。可採用以避免兩處解析 JSON；實作時若 helper 自然，採之，但不強制。

### Default TTL fallback 為 60 秒

`~/.felina/settings.json` 不存在或無 `quotaTtlSeconds` 欄位時，後端 fallback `60` 秒；對齊 panel 目前的 `?? 60` 顯示 fallback。

替代方案：沿用 `budget.rs` 的 `180` 秒。捨棄原因：panel 下拉選項範圍 `30–150`，180 比 panel 任何選項都大；新 default 應落在 UI 表達範圍內。

### 保留 `CostBudgetCard`

`CostBudgetCard` 接受 analytics-derived props，不呼 `api.budget`。component 名稱含 Budget 容易誤導，但實際行為與 Budget IPC 無關。

替代方案：一併刪除。捨棄原因：那會移除可見的 `/tokens` analytics UI，不在本 change scope。

### Live spec drift 清理，archived 保持歷史

Live specs 移除把 `src-tauri/src/commands/budget.rs` 列為 active related code 的 references；archived Spectra artifacts 保留以記錄當時決策。

## Implementation Contract

**Behavior:**

- 使用者在 `AgentQuotaPanel` 改 TTL 下拉，選擇寫入 `~/.felina/settings.json` 的 `quotaTtlSeconds`，並立即影響後續 quota refetch cooldown。
- 後端 `ccusage::quota_cache_ttl` 與前端 panel 從同一檔案讀同一個值；前後端 cache window 一致。
- `BudgetSettings` / `CostSummary` / `api.budget` / `useBudgetSettings` / `useSetBudgetSettings` 等 symbols 自 source tree 完全移除。

**Interface / data shape:**

- 後端命令：
  - `get_felina_quota_ttl() -> Result<u64, String>`：讀 `~/.felina/settings.json` 的 `quotaTtlSeconds` 欄位；檔案或欄位不存在時回傳 `60`。
  - `set_felina_quota_ttl(seconds: u64) -> Result<(), String>`：讀現有 JSON、覆寫 `quotaTtlSeconds`、寫回；檔案不存在時建立含此欄位的新檔；接受值範圍 `30..=3600`，超出視為 invalid argument 回 Err。
- `~/.felina/settings.json` schema 擴充：頂層多一個 `quotaTtlSeconds: number`（optional）。
- 前端 wrapper：`api.felinaSettings.getQuotaTtl()` / `api.felinaSettings.setQuotaTtl(seconds)`，回傳 `number` 與 `void`。
- React Query hooks：以 `useFelinaQuotaTtl()` / `useSetFelinaQuotaTtl()` 取代舊 hooks，query key 改為 `["felinaSettings","quotaTtl"]`。

**Failure modes:**

- JSON parse 失敗：`get` 視為「無設定」回 fallback；`set` 回 Err 並包含原因，由 panel 顯示錯誤。
- 寫入失敗（權限/IO）：`set` 回 Err，panel 維持 optimistic 值但顯示 toast/錯誤。
- 範圍違規（< 30 或 > 3600）：`set` 回 Err，panel 不更新 cache key。

**Acceptance criteria:**

- `rg "api\\.budget|BudgetSettings|CostSummary|get_budget|set_budget|get_cost_summary|glyphic-settings|useBudgetSettings|useSetBudgetSettings" src src-tauri/src` 無 active-source matches。
- `rg "src-tauri/src/commands/budget.rs" openspec/specs` 無 live-spec matches（archive 目錄不算）。
- `src-tauri/src/commands/budget.rs` 已刪除；`mod.rs` 不再宣告 budget。
- `npm run check` 通過，diff 不增加 pre-existing TypeScript failures。
- 從 `src-tauri/` 執行 `cargo check --lib` 通過，diff 不增加 pre-existing Rust failures。
- Manual smoke：`/tokens` 頁 TTL 下拉選 30 / 60 / 90 / 120 / 150，page reload 後維持選擇，且後端 quota cache 行為對應。

**In Scope:**

- 新增 felina quota TTL 讀寫 commands（backend + frontend wrapper + hooks）。
- 遷移 `ccusage::quota_cache_ttl` 與 `AgentQuotaPanel` 的資料來源。
- 刪除 `budget.rs`、`api.budget`、相關 types 與 unused hooks。
- Live spec drift 清理。

**Out of Scope:**

- 通用 Settings IPC scope system。
- `~/.claude/glyphic-settings.json` 遷移或保留任何欄位。
- `daily_limit` / `monthly_limit` / `plan_type` 重新實作。
- Token analytics aggregation、pricing、quota fetch 主邏輯。
- Archived Spectra artifacts。

## Risks / Trade-offs

- [Risk] 既有 `~/.claude/glyphic-settings.json`（罕見情境）中的 TTL 不遷移。Mitigation: 本 change 設定形同壞掉、值未生效，遺失無實質影響；release notes 提一句即可。
- [Risk] 兩處讀取 JSON（IPC handler 與 ccusage）導致解析邏輯重複。Mitigation: 實作時抽出 backend helper `read_quota_ttl_seconds()`，IPC 與 ccusage 共用。
- [Risk] 寫入 settings.json 與並行讀寫 race（例如多視窗）。Mitigation: 採 read-modify-write 序列、保留檔案 atomic write（temp file + rename）；目前 Felina 同檔多 writer 風險低，列為已知限制。
- [Risk] 移除 Budget types 留下 dangling TypeScript imports。Mitigation: `npm run check` 與 `rg` 雙重驗證。
- [Risk] Live specs 有許多自動產生的 trace references 指向 `budget.rs`。Mitigation: 統一以 `rg` acceptance check 涵蓋。
