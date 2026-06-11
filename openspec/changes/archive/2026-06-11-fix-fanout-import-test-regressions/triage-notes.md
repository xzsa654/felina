# Triage Notes — fix-fanout-import-test-regressions（2026-06-11）

## 基線（dev `869596c`，cargo test --lib 全套件）

297 passed / 7 failed（deterministic，單執行緒重跑結果相同）：

| # | 測試 | assert 訊息 | 初判 |
|---|---|---|---|
| 1 | `fan_out::fan_out_to_three_agents_mirrors_bundled_siblings` | missing SKILL.md in `<tmp>/.gemini/skills/smoke-fanout` | 測試過時：gemini project-relative 已改 `.agents/skills`（archived spec `agent-skills-schema` MODIFIED） |
| 2 | `fan_out::preview_classifies_targets_and_does_not_mutate_files_or_sync_meta` | assertion left == right failed | 測試過時（路徑/target 數量期望） |
| 3 | `fan_out::disabled_and_detached_targets_are_skipped` | codex (detached) target was written | 待查證：疑似 codex/gemini 共用 `.agents/skills` 後，enabled gemini 的寫入出現在 codex 路徑 → 測試混淆而非真 bug；須以隔離路徑驗證 detached 真的不被 push |
| 4 | `fan_out::commit_blocks_drift_until_override_and_detach_are_explicit` | assertion left == right failed | 測試過時（同路徑因素） |
| 5 | `fan_out::skill_drift_scan_detects_synced_and_drifted_targets` | NotFound（找不到指定路徑） | 測試過時（期望的舊預設路徑不存在） |
| 6 | `canonical_skills::target_remove_policy_prunes_meta_deletes_only_selected_and_preserves_on_failure` | assertion failed: delete_file.target_removed | 測試過時（target 路徑預設變更）；須確認 remove policy 語意不變 |
| 7 | `skill_import::ensure_required_fields_handles_bom_crlf_source` | 注入 `agents: []` 而非 `- anthropic` | contract 議題：`94209a4` 讓 parse 接受缺 agents（合法 content-only 狀態），但 `ensure_required_fields(_, _, fallback_agent)` 的 fallback 注入被默默移除；import 自 agent 目錄時來源已知，應注入 fallback_agent |

## 刻意行為變更依據

- `2026-06-01-gemini-to-antigravity-cli-default`（archived）：gemini global 預設 `~/.gemini/skills` → `~/.gemini/antigravity-cli/skills`；project-relative `.gemini/skills` → `.agents/skills`
- `d626b18` spec invariant：codex + gemini 共用 `.agents/skills` 是刻意 convention，「system MUST NOT collapse/hide; do not re-debate」
- `94209a4`：`parse_skill_md` agents 選填、`agents: []` 合法（content-only，no fan-out）

## 引入點（bisect 結論）

- R1（#1–#6）：`8fd7c45` merge（spx 分支基底舊於 dev 測試，merge 後未跑全套件）
- R2（#7）：`94209a4`
- 潛伏原因：6/01 之後各 change 只跑 scoped cargo test，全套件首次完整跑是 2026-06-11 baseline

## 最終處置（2026-06-11 apply 完成）

- #1 fanout3：測試改為兩個實體 root（.claude + 共用 .agents），新增「.gemini 不得再被寫入」斷言（強度提升）
- #2 preview：gemini 改用第二個 project root 承載 drift 情境（共用目錄下 codex/gemini render 的 semantic hash 相等，無法在同一檔案同時呈現 no_op 與 drift）；create/no_op/blocked_drift 三分類原意保留
- #3 disabled/detached：角色重排（tracked=anthropic、detached=codex、disabled=gemini），共用 .agents 目錄整體斷言不存在 — detached 隔離驗證後確認**未被寫入，非行為 bug**，原失敗為共用目錄測試混淆
- #4 commit drift：gemini 期望路徑 .gemini → .agents（無 codex target，無共用衝突），Override/Detach 語意斷言全保留
- #5 drift scan：外部修改點 .gemini → .agents
- #6 target_remove：codex 失敗情境移至獨立 project root，gemini 真目錄改 .agents；prune/preserve 語意斷言全保留
- #7 ensure_required_fields：**程式修復**（非改測試）— parse 成功的 early-return 在 agents 為空時注入 source_agent；94209a4 的「agents=[] 合法」屬 parse 層語意，import-from-agent-dir 的標記語意恢復
- 驗證：cargo test --lib 304 passed / 0 failed（基線 297/7）；npm run check 通過；CLAUDE.md 驗證 gate 已補全套件要求
