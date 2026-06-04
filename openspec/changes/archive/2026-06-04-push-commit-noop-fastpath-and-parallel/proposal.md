## Summary

Push commit 路徑（`skill_sync_commit` / `skill_sync_all_commit`）在 NoOp row 仍執行 `try_snapshot`（git commit）與 `compute_sibling_hashes`（遞迴 SHA-256），且多 skill Push All 是 serial for loop；本 change 跳過 NoOp 的兩件貴事並為 Push All 加入 inter-skill 並行化。

## Motivation

`skill_sync_commit`（`src-tauri/src/commands/fan_out/mod.rs` 的 `SkillSyncPreviewOperation::NoOp` 分支）即使 target 內容未變也執行三件事：

1. `try_snapshot` → `commit_skill_changes`：對 canonical skill 目錄做一次 git commit（若無 diff 則是空操作，但仍開 git2 repo + traverse index）。
2. `compute_sibling_hashes`：遞迴走訪 target 目錄所有非 SKILL.md 檔案並計算 SHA-256。
3. 寫回 `last_sync` entry 含更新的 `at`、`base_snapshot`、`sibling_hashes`。

當 `pushed_hash` 已等於 `meta.last_sync[key].pushed_hash` 時，上述 (1) 與 (2) 為純浪費 — canonical 沒變（snapshot 一定同）、sibling 也沒變（hash 一定同）。只有 `at` 時間戳需要前推以維持 `check_drift` 的 mtime fast-path。

`skill_sync_all_commit` 的外層 `for entry in entries` 是 serial blocking；不同 skill 各自獨立（獨立 canonical dir、獨立 sync-meta），可安全並行。

**等待公式**：單 skill push = 1 skill × M targets × (snapshot + sibling-hash)；Push All = N skills × M targets，雙 serial loop 線性疊加。使用者體感：按 Push 後等待數秒無回應。

## Proposed Solution

1. **NoOp fast-path**：在 `SkillSyncPreviewOperation::NoOp` 分支，比對 `item.rendered_hash`（或 `current_hash`）與 `meta.last_sync[key].pushed_hash`；若相同，跳過 `try_snapshot` 與 `compute_sibling_hashes`，僅更新 `at` 欄位為 `attempted_at`，保留既有 `base_snapshot` 與 `sibling_hashes`。
2. **Inter-skill 並行化**：`skill_sync_all_commit` 的 `for entry in entries` 改為 `rayon::iter::IntoParallelIterator` 或 `std::thread::scope` 並行，上限 8 條（或 `num_cpus::get()`）。前提：`try_snapshot` / `commit_skill_changes` 使用的 git2 repo 是 per-skill `~/.felina/skills/<name>/` 而非共用 repo — 已確認各 skill 有獨立 canonical dir，git2 操作不互相 lock。
3. **Inter-target 維持序列**：同一 skill 內的 `for item in preview.items` 不並行，因為 `meta` 是 `&mut` 共享，inter-target 並行會 race。

## Non-Goals

- 不改變前端 `refreshDriftScan()` 的觸發模式（debounce 為獨立 follow-up）。
- 不改變 `write_target` / `Create` / `Overwrite` 的既有行為。
- 不改變 `check_drift` 的 mtime fast-path 邏輯。
- 不新增前端 IPC request/response shape 或新的 Tauri command。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: Push commit 路徑的 NoOp 分支跳過無用 snapshot 與 sibling hash 計算，Push All 改為 inter-skill 並行。

## Impact

- Affected specs: `multi-agent-skills`
- Affected code:
  - Modified:
    - `src-tauri/src/commands/fan_out/mod.rs`
  - New: none expected
  - Removed: none
- Dependencies: 若選 `rayon` 並行方案，新增 `rayon` Cargo dependency；若選 `std::thread::scope` 則無新依賴。
- Breaking changes: 無。
- Backward compatibility: NoOp 的外部可觀察行為不變（`SyncResult` 相同），僅內部 `base_snapshot` 與 `sibling_hashes` 在 hash 未變時保留舊值而非重算。
