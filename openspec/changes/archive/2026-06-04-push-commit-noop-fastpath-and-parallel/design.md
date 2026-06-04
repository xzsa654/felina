## Context

`skill_sync_commit`（`src-tauri/src/commands/fan_out/mod.rs`）是 Push 的核心函式，逐 target 遍歷 preview items 並依 operation type 分派。`SkillSyncPreviewOperation::NoOp` 分支目前執行 `try_snapshot`（git2 commit）、`compute_sibling_hashes`（遞迴 SHA-256）、寫回 `last_sync` entry — 三件事的目的是把 `at` 時間戳與 snapshot 前推。當 `pushed_hash` 未變時，snapshot 必然相同、sibling hashes 必然相同，只有 `at` 需要更新。

`skill_sync_all_commit` 列出所有 canonical skills 後 serial 呼叫 `skill_sync_commit`。各 skill 擁有獨立 canonical dir 與獨立 sync-meta，無共享 mutable state。

可重用的現有元件與邏輯：

- `try_snapshot` / `commit_skill_changes`（`snapshot.rs`）：per-skill git2 commit，NoOp fast-path 不呼叫、但 write path 不變。
- `compute_sibling_hashes`：遞迴 walk + SHA-256，NoOp fast-path 不呼叫、但 write path 不變。
- `check_drift` 的 mtime fast-path：讀 `entry.at` 與 agent-side SKILL.md 的 mtime 比較。NoOp fast-path 需保證 `at` 仍被更新，否則 mtime fast-path 會退化為讀檔 hash。

本變更不涉及 UI，但 Push All 的回應時間是使用者可感知的體驗改善。

## Goals / Non-Goals

**Goals:**

- NoOp + hash 未變時跳過 `try_snapshot` 與 `compute_sibling_hashes`。
- `at` 時間戳仍前推至 `attempted_at`，維持 `check_drift` mtime fast-path。
- Push All 對多 skill 做 inter-skill 並行，縮短等待時間。
- 不改變 `SyncResult` 對外格式。

**Non-Goals:**

- 不改變 `write_target`（Create / Overwrite / drift resolution）路徑。
- 不改變 inter-target 遍歷順序（同 skill 內維持 serial）。
- 不改變前端 `refreshDriftScan()` 觸發頻率。
- 不新增前端 IPC shape。

## Decisions

**NoOp fast-path: skip snapshot and sibling hash when pushed_hash unchanged**

在 `SkillSyncPreviewOperation::NoOp` 分支，取 `item.rendered_hash` 或 `item.current_hash`，與 `meta.last_sync[item.target_key].pushed_hash` 比較。若相同，執行 fast-path：

- 跳過 `try_snapshot`。
- 跳過 `compute_sibling_hashes`。
- 更新 `at` 為 `attempted_at`。
- 保留既有 `base_snapshot` 與 `sibling_hashes` 不動。

若 hash 不同（例如 canonical 有新 sibling、或 rendered template 變動但 agent-side 巧合一樣），走完整路徑（與目前行為相同）。

替代方案：完全不進入 NoOp 分支的 last_sync 更新。不採用，因為不更新 `at` 會讓 `check_drift` 的 mtime fast-path 失效 — 使用者只要 touch 過 SKILL.md（未改內容）就會落入慢路徑。

**Inter-skill 並行化: std::thread::scope over rayon**

`skill_sync_all_commit` 改用 `std::thread::scope` + 手動 chunking，不引入 `rayon` 依賴。並行度上限 8 或 `std::thread::available_parallelism`（取較小值）。每條 thread 獨立呼叫 `skill_sync_commit`，結果 collect 回 `Vec<SyncResult>`。

選 `std::thread::scope` 而非 `rayon`：Push All 是低頻操作（使用者手動觸發），不需 work-stealing scheduler 的開銷；`std::thread::scope` 零依賴、lifetime 安全。

替代方案：`tokio::spawn_blocking`。不採用，因為 `skill_sync_commit` 是純 synchronous blocking I/O（git2 + fs），且 Tauri command handler 已在 blocking thread pool；嵌套 spawn_blocking 增加複雜度無收益。

**Inter-target 維持序列**

同一 skill 內的 `for item in preview.items` 不並行。原因：`meta` 是 `&mut SyncMetaV2`，多 target 並行寫同一個 meta 會 race。且單 skill 的 target 數通常 ≤ 6（3 agents × global/project），並行收益不值得 Arc/Mutex 開銷。

## Implementation Contract

**In Scope**

- `fan_out/mod.rs` 的 `SkillSyncPreviewOperation::NoOp` 分支加入 hash 比對 fast-path。
- `fan_out/mod.rs` 的 `skill_sync_all_commit` 改為 `std::thread::scope` 並行。
- Rust unit tests 覆蓋 NoOp fast-path（hash match → 不呼叫 snapshot / sibling hash）與 hash mismatch（走完整路徑）。

**Out of Scope**

- 前端 `refreshDriftScan()` debounce。
- `write_target` 路徑的任何變更。
- 新增 Tauri command 或 IPC shape。
- `check_drift` 邏輯變更。

**Observable Behavior**

- Push 單 skill 對全 NoOp targets 時，不產生新的 git commit（`try_snapshot` 未被呼叫）。
- Push 單 skill 後，`meta.last_sync[key].at` 仍更新為 `attempted_at`。
- Push 單 skill 後，`meta.last_sync[key].base_snapshot` 與 `sibling_hashes` 保留原值。
- Push All 對 N 個 dirty skills 時，wall-clock 時間應接近單 skill 時間（而非 N 倍）。
- `SyncResult` 對前端的格式不變。

**Interfaces / Data Shape**

- `SkillSyncCommitRequest`、`SkillSyncAllCommitRequest`、`SyncResult` 維持不變。
- `LastSyncEntry` 維持不變。
- `SyncMetaV2` 維持不變。

**Failure Modes**

- 若 `meta.last_sync` 無對應 key（首次 push 後直接 NoOp），走完整路徑（hash 比對無 baseline → 不 short-circuit）。
- `std::thread::scope` 內 thread panic → scope 自動 propagate panic，上層 Tauri command 回 error string。

**Acceptance Criteria**

- Rust unit test 證明 NoOp + hash match 後 `base_snapshot` 與 `sibling_hashes` 保留原值、`at` 已更新。
- Rust unit test 證明 NoOp + hash mismatch 後 `base_snapshot` 與 `sibling_hashes` 為新值。
- `cargo test --lib` 與 `cargo build` 通過。
- `npm run check` 通過（前端無變更，確認無回歸）。

## Risks / Trade-offs

- [Risk] NoOp fast-path 保留舊 `sibling_hashes` — 若使用者在 agent-side 新增 sibling 後未改 SKILL.md 內容，sibling drift 不會被 NoOp 更新。→ 下一次 dirty push（Create/Overwrite）會重算完整 sibling hashes。NoOp 語意本就是「無變更」。
- [Risk] `std::thread::scope` 並行 `skill_sync_commit` — 各 skill 的 snapshot.rs 開 per-skill git2 repo，無共享 repo lock。但若未來改為共用 repo，會 lock 競爭。→ 以 test 鎖定 per-skill 獨立性，未來架構變更需重新評估。
- [Trade-off] 不用 `rayon` — 犧牲 work-stealing 的均勻排程，換取零外部依賴。Push All 的 skill 數量通常 < 50，粗粒度 chunking 足夠。

## Migration Plan

- 無資料 migration。
- 部署後立即生效。
- Rollback 只需 revert `fan_out/mod.rs` 的兩段修改。
