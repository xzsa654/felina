## Problem

部分含 sibling files 的 skill 會反覆顯示 drift，即使 canonical skill 目錄與 agent-side skill 目錄的 sibling 檔案內容已完全一致。這會讓使用者看到錯誤的 drift warning，並誤以為 agent 端有外部修改。

## Root Cause

目前 `skill_drift_scan` 的 sibling 判定只比較「last_sync 記錄的 `sibling_hashes`」與「agent-side 目前 sibling hashes」。當 canonical 與 agent-side 已經同步，但 `sibling_hashes` baseline 因歷史操作或未刷新而停在舊值時，系統仍會把它判定為 agent-side drift。

## Proposed Solution

- 將 batch drift scan 的 sibling 判定改為三方比較：recorded baseline、canonical sibling hashes、agent-side sibling hashes。
- 當 agent-side sibling hashes 與 canonical sibling hashes 相同時，即使 recorded baseline 舊了，也不回報 `Drifted`。
- 保留真正 agent-side 修改、刪除、或新增 sibling file 的 drift 判定。
- 以 Rust 單元測試覆蓋 stale baseline 場景，確保 canonical 與 agent-side 一致時不誤報 drift。

## Non-Goals

- 不新增前端 UI、IPC 回傳型別、或使用者手動 repair action。
- 不主動掃描並批次重寫既有 `.felina-sync-meta.json`。
- 不改變 CRLF/LF normalization 規則；本 change 只處理 recorded baseline stale 導致的 false drift。
- 不調整 `SKILL.md` 主檔 semantic hash 判定。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `drift-detection`: batch drift scan 的 sibling drift requirement 新增 stale baseline 判定規則。

## Impact

- Affected code:
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`
  - New: none
  - Removed: none
- Affected specs: `drift-detection`
- Dependencies: no new npm or Cargo dependencies.
- Backward compatibility: existing sync metadata remains readable; no migration is required.
- Breaking changes: none.
- Cross-change dependencies: none.
