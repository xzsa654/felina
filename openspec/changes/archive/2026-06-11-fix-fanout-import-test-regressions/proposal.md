## Problem

dev 上 `cargo test --lib` 全套件有 7 個 deterministic 失敗（fan_out 5、canonical_skills 1、skill_import 1），自 2026-06-01 起存在 10 天未被發現——期間各 change 僅跑 scoped 測試（如 `cargo test --lib tokens::`），全套件從未驗過。失敗清單：

- `fan_out::tests::fan_out_to_three_agents_mirrors_bundled_siblings`
- `fan_out::tests::preview_classifies_targets_and_does_not_mutate_files_or_sync_meta`
- `fan_out::tests::disabled_and_detached_targets_are_skipped`（「codex (detached) target was written」）
- `fan_out::tests::commit_blocks_drift_until_override_and_detach_are_explicit`
- `fan_out::tests::skill_drift_scan_detects_synced_and_drifted_targets`
- `canonical_skills::tests::target_remove_policy_prunes_meta_deletes_only_selected_and_preserves_on_failure`
- `skill_import::tests::ensure_required_fields_handles_bom_crlf_source`（注入 `agents: []` 而非 fallback agent）

## Root Cause

Bisect 確認兩個獨立回歸，皆於 2026-06-01 進入 dev：

1. **`8fd7c45`**（merge spx/gemini-to-antigravity-cli-default）：Gemini 預設 global path 改為 Antigravity CLI。merge 前 dev 側 fan_out 全綠、merge 後即紅 — 分支基底較舊，dev 側既有測試（期望 `~/.gemini/skills` 等預設）未隨路徑變更同步更新。影響 fan_out 5 項 + canonical_skills 1 項。
2. **`94209a4`**（graceful import for skills without agents）：`parse_skill_md` 的 `agents` 欄位改為選填、缺值回傳空 vec（agents=[] 為合法的 content-only 狀態）。`ensure_required_fields` 原 contract「來源缺 agents 時注入 fallback AgentId」被默默改變，現在輸出 `agents: []`。

## Proposed Solution

逐測試 triage，原則：**commit 訊息與 archived spec 證明為刻意的行為變更 → 更新測試以編碼新 contract；無 spec 依據的行為差異 → 視為行為 bug 修程式**。

- R1 六項：比對 `gemini-to-antigravity-cli-default` 的 archived spec 與現行 `agent_paths.rs` 預設，把測試的目標路徑期望對齊新預設。特別查證 `disabled_and_detached_targets_are_skipped`：「detached target 被寫入」若在對齊路徑後仍重現，即為真行為 bug（detached 模式不得被 push），修 fan_out 邏輯而非測試。
- R2 一項：釐清 `ensure_required_fields(raw, name, fallback_agent)` 的 contract — fallback_agent 參數在 agents-optional 設計下是否仍應注入。從 agent-native 目錄匯入時來源 agent 是已知的，注入來源 agent 較符合 import 語意；若維持注入，修 `ensure_required_fields` 缺 agents 時注入 `fallback_agent`；若改採 agents=[]，更新測試並確認 import 後 UI/fan-out 對空 agents 的處理。
- 防再發：在專案驗證慣例中把「全套件 `cargo test --lib`」納入 Rust 改動的必跑 gate（已於本 change 的 tasks 落實；CLAUDE.md 驗證指引同步補一行）。

## Success Criteria

- `cargo test --lib` 全套件 0 failed（dev 上目前 297 passed / 7 failed → 304/0 或對應增減後全綠）
- 每個失敗測試的處置（改測試 vs 改程式）在 commit message 或 change notes 中逐項記錄理由
- `disabled_and_detached_targets_are_skipped` 的 detached 不被寫入語意獲得驗證（測試綠且語意與 `multi-agent-skills` spec 一致）
- `npm run check` 通過（若 R2 涉及前端對空 agents 的顯示則一併驗證）

## Impact

- Affected code:
  - Modified:
    - src-tauri/src/commands/fan_out/mod.rs（測試期望對齊；若 detached 寫入為真 bug 則含邏輯修正）
    - src-tauri/src/commands/canonical_skills.rs（target_remove 測試期望對齊）
    - src-tauri/src/commands/skill_import.rs（`ensure_required_fields` contract 釐清：注入 fallback 或更新測試）
    - CLAUDE.md（驗證指引補「Rust 改動跑全套件 cargo test --lib」）
  - New: (none)
  - Removed: (none)
- 依賴：無新增 npm / Cargo 依賴
- 風險：無破壞性變更預期；若 R1 查證出 detached 寫入為真 bug，修正屬恢復 spec 既定行為；無跨 change 依賴
