## Why

目前 push 使用 `copy_bundled_siblings()` 將 canonical 的 sibling 檔案複製到 agent 端，但只做「加」不做「刪」。若使用者在 canonical 端刪除了某個 sibling（例如 `script/old.py`），agent 端的副本會永久殘留，造成孤兒檔案。`sibling-drift-detection` 提供了 pushed sibling hash map 作為 baseline，本 change 利用此 baseline 在 push 時清除 agent 端的孤兒 sibling。

## What Changes

- Push 流程中，`copy_bundled_siblings()` 完成後，比對 canonical 現有 sibling 與上次 pushed 的 `sibling_hashes`，刪除 agent 端存在但 canonical 端已移除的 sibling 檔案。
- Push preview 顯示將被清除的孤兒 sibling 清單。
- 清除後更新 sync meta 的 `sibling_hashes`。

## Non-Goals

- 不處理 agent 端使用者手動新增的檔案（那些不在 pushed baseline 中的檔案不會被刪除）。
- 不做 sibling 的 pull-back（由 `sibling-pull-sync` 負責）。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: 擴展 push 流程，在同步 sibling 後清除 canonical 端已移除的孤兒 sibling。

## Impact

- Affected specs: `multi-agent-skills`（修改）
- Affected code:
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`（push 流程新增孤兒清除、push preview 擴展）
  - Modified: `src/lib/components/skills/SyncPreviewDialog.tsx`（顯示將清除的 sibling）
  - Modified: `src/lib/types/skills.ts`（push preview 型別擴展）
  - Modified: `src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`（孤兒清除相關 key）
- 無新增依賴
- 跨 change 依賴：依賴 `sibling-drift-detection`（已完成）的 `LastSyncEntry.sibling_hashes: Option<BTreeMap<String, String>>`（`None` = legacy 跳過、`Some(map)` = 有 baseline）及 `compute_sibling_hashes` helper
