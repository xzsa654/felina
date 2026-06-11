## 1. Triage 與基線

- [x] 1.1 記錄 dev 基線：`cargo test --lib` 全套件失敗清單（7 項）與各失敗的 assert 訊息，存入 change 工作筆記；讀取 `openspec/changes/archive/` 中 `gemini-to-antigravity-cli-default` 與 `94209a4` 對應 change 的 spec/proposal，整理「刻意行為變更」清單作為 triage 依據。完成條件：7 項各標注初判（測試過時 vs 疑似行為 bug）並記錄

## 2. R1：Gemini 預設路徑變更的測試對齊（fan_out + canonical_skills）

- [x] 2.1 查證 `disabled_and_detached_targets_are_skipped`「codex (detached) target was written」：在路徑期望對齊後重跑，若 detached target 仍被 push 寫入即為真行為 bug，修 fan_out push 邏輯使 detached 模式不被寫入（語意須與 `multi-agent-skills` spec 一致）；若對齊後即綠則記錄為測試過時。完成條件：該測試綠，處置理由記錄
- [x] 2.2 對齊其餘 5 項測試的目標路徑期望至現行 `agent_paths.rs` 預設（Antigravity CLI 路徑），涵蓋 `fan_out_to_three_agents_mirrors_bundled_siblings`、`preview_classifies_targets_and_does_not_mutate_files_or_sync_meta`、`commit_blocks_drift_until_override_and_detach_are_explicit`、`skill_drift_scan_detects_synced_and_drifted_targets`、`canonical_skills::target_remove_policy_prunes_meta_deletes_only_selected_and_preserves_on_failure`；測試僅改路徑/設定期望，不得弱化原本驗證的行為斷言（mirror siblings、preview 不落盤、drift 阻擋、meta prune 語意全部保留）。完成條件：5 項測試綠且斷言強度不降

## 3. R2：ensure_required_fields 的 agents fallback contract

- [x] 3.1 釐清並修復 `ensure_required_fields(raw, name, fallback_agent)` contract：從 agent-native 目錄匯入時來源 agent 已知，缺 `agents` 時應注入 `fallback_agent`（與 `94209a4`「agents=[] 合法」不衝突 — 該設計針對無法推斷來源的情境）；修 `ensure_required_fields` 注入邏輯使 `ensure_required_fields_handles_bom_crlf_source` 綠。若調查後採相反決策（維持 agents=[]），改測試並驗證 import 後空 agents 在 SkillsPage 與 fan-out 的處理無 panic/異常，並把決策理由記錄於 change 筆記。完成條件：該測試綠（或依決策更新後綠），決策理由記錄

## 4. 驗證與防再發

- [x] 4.1 全套件驗證：`cargo test --lib` 0 failed、`npm run check` 通過；與 1.1 基線比對確認無新引入失敗。完成條件：兩項檢查輸出記錄
- [x] 4.2 CLAUDE.md 的驗證指引補充：Rust/backend 改動的 gate 由「narrowest relevant cargo test scope」改為「相關 scope + 收尾前全套件 `cargo test --lib` 一次」，防止 scoped-only 測試讓跨模組回歸再次潛伏。完成條件：CLAUDE.md 對應段落更新，文意與現行 3-tier workflow 不衝突
