## Why

`sibling-drift-detection` 完成後，Felina 能偵測到 agent 端 sibling 的變動，但使用者無法將 agent 端新增或修改的 sibling 拉回 canonical 目錄。目前 pull 只回寫 SKILL.md body，agent 端新增的 `script/xx.py` 或修改的 `templates/prompt.txt` 會永遠留在 agent 端，無法回流到 canonical source of truth。

## What Changes

- 擴展 `skill_pull_from_target()` 使其除了 SKILL.md body 外，也將 agent 端的 sibling 檔案同步回 canonical 目錄。
- 擴展 `skill_pull_preview()` 使 pull preview 顯示 sibling 的差異（新增、修改、刪除）。
- 前端 `PullConfirmDialog` 顯示 sibling 差異明細，讓使用者在確認前看到完整變動。
- 當 canonical 端和 agent 端的同一 sibling 檔案內容不同時，提供衝突處理策略選擇（以 agent 端為準 / 以 canonical 端為準 / 跳過）。

## Non-Goals

- 不處理 push 時的 sibling 孤兒清除（由 `sibling-push-cleanup` 負責）。
- 不實作 sibling 的 diff viewer（僅顯示檔案清單和狀態，不逐行比對）。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `drift-pull-back`: 擴展 pull 流程，從僅回寫 SKILL.md body 到包含 sibling 檔案同步。

## Impact

- Affected specs: `drift-pull-back`（修改）
- Affected code:
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`（`skill_pull_from_target`、`skill_pull_preview`）
  - Modified: `src/lib/components/skills/PullConfirmDialog.tsx`（顯示 sibling 差異）
  - Modified: `src/lib/tauri/commands.ts`（pull preview 回傳結構擴展）
  - Modified: `src/lib/types/skills.ts`（pull preview 型別擴展）
  - Modified: `src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`（sibling pull 相關 key）
- 無新增依賴
- 跨 change 依賴：依賴 `sibling-drift-detection`（已完成）的 sync meta `sibling_hashes: Option<BTreeMap<String, String>>` 欄位（`None` = legacy 跳過、`Some({})` = 無 sibling、`Some({...})` = 有記錄）及 `compute_sibling_hashes` helper
- Modified: `src/lib/types/skills.ts`（pull preview 型別擴展，非 `src/lib/types.ts`）
