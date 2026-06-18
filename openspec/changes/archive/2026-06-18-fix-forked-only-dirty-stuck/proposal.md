## Problem

兩個相關但不同的缺陷，都讓 `dirty` flag 卡在 `true` 無法清除：

**Problem A（防止新增無意義 dirty）**：Forked-only skill（所有 enabled targets 皆為 Forked 或 Detached 模式）在 canonical 端修改後 `dirty` flag 永久卡在 `true`。使用者看到該 skill 標示為「未同步」，但無論怎麼操作都無法清除——因為 push preview 和 push commit 都跳過 forked targets，沒有任何路徑會翻回 `dirty = false`。

**Problem B（清除既有卡住的 dirty）**：即使有 pushable（Auto/Manual）target，當 push preview 的所有 items 都解析為 NoOp 或 Skipped（例如：一個 Manual target 內容無變化 → NoOp，加上一個 Forked target → Skipped），既有的 `dirty = true` 仍無法清除。使用者反覆 re-push 也消不掉。

## Root Cause

**Problem A**：`dirty = true` 的設定點（`canonical_skills.rs` 的 `skill_target_repoint` 和 `canonical_skill_rename`）無條件設定 `dirty = true`，不考慮 targets 是否有 pushable（Auto/Manual）。而 push 流程的三個入口都跳過 forked-only：`skill_sync_all_preview` 過濾掉無 Auto/Manual target 的 skill（前端不顯示）；`skill_sync_one` 跳過 Forked targets；`auto_push_if_needed` 無 Auto target 時直接 return。

**Problem B**：dirty 的回收（翻回 `false`）只發生在 `skill_sync_commit`——它在 commit 結束時依 Auto/Manual target 是否都有 `last_sync` 來重算 `meta.dirty`。但前端在 push preview 全為 NoOp/Skipped（無任何 Create/Overwrite/BlockedDrift/OverwriteUnknown 待寫項）時，判定「無事可做」而不呼叫 `skill_sync_commit`，因此 dirty 永遠不會被重算。`skill_sync_preview` 與 `build_preview_for_skill` 目前是純讀取，不會修正已穩定（in-sync）skill 的 stale dirty。

## Proposed Solution

**Problem A**：在設定 `dirty = true` 前，檢查是否存在 pushable target（`enabled && mode == Auto || Manual`）。若所有 enabled targets 都是 Forked/Detached，不設 `dirty = true`。抽取共用 helper `has_pushable_target(targets: &[SkillTarget]) -> bool`。修改 `skill_target_repoint` 與 `canonical_skill_rename` 的 dirty 設定點。

**Problem B**：在 preview 生成路徑加入 dirty 自我修復。`build_preview_for_skill` 計算完所有 items 後，若該 skill 目前 `meta.dirty == true` 且所有 items 的 operation 都是 NoOp 或 Skipped（即無任何待寫項），代表 rendered 輸出與已 push 的狀態一致、無可同步內容，將 `meta.dirty` 寫回 `false` 並持久化 sync-meta。這同時涵蓋 forked + unchanged-manual 的情況，以及任何「canonical 改了但 rendered 輸出碰巧與已 push 相同」的場景。

## Non-Goals

- 不改 dirty 的儲存結構（仍然 per-skill boolean）
- 不處理 forked-target-overlay（3-way merge 功能，屬另一個 backlog item）
- 不改 `skill_sync_commit` 既有的 dirty 回收邏輯（依 Auto/Manual `last_sync` 重算的部分維持不變）
- 不在有待寫項（Create/Overwrite/BlockedDrift/OverwriteUnknown）時改動 dirty——那些情況本來就該維持 dirty 直到實際 commit

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `drift-detection`: dirty flag 設定邏輯排除 forked-only skill 的無意義 dirty 標記

## Impact

- Affected specs: `drift-detection`
- Affected code:
  - Modified: `src-tauri/src/commands/canonical_skills.rs`
  - New: none
  - Removed: none
- Dependencies: no new npm or Cargo dependencies
- Backward compatibility: existing sync metadata remains readable; no migration
- Breaking changes: none
