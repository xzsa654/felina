## Why

目前 drift 偵測僅對 SKILL.md 做 semantic hash 比對。但 canonical skill 目錄下可能包含 bundled sibling 檔案（script、templates、references 等），push 時 `copy_bundled_siblings()` 會將這些檔案同步到 agent 端。然而，若 agent 端的 sibling 被修改或新增，Felina 不會偵測到任何差異，drift badge 仍顯示 clean — 使用者無從得知同步已失真。

## What Changes

- 擴展 `.felina-sync-meta.json` 的 `last_sync` 結構，為每個 target 記錄 sibling 檔案的 hash map（相對路徑 → SHA-256）。
- `check_drift()` 從僅比對 SKILL.md hash，擴展為同時比對 sibling hash map；任一 sibling 新增、刪除或內容變動皆視為 drifted。
- Push 時寫入完整的 sibling hash map 至 sync meta。
- 前端 drift badge 和 `SyncInfoBar` 反映 sibling 級別的 drift 狀態。
- `canonical_skills_list` 在 skill list 載入時偵測 canonical 端 sibling 變動，自動設 dirty + `siblingsDirty` 旗標，讓 push badge 出現。
- `build_preview_for_skill` 在 push preview 時比較 canonical sibling 與 `lastSync.siblingHashes`，sibling 有變動時將 operation 從 NoOp 改為 Overwrite，確保 commit 會執行 `copy_bundled_siblings`。
- `SyncInfoBar` 在 `siblingsDirty` 時顯示「附加檔案已變更，請推送以同步。」提示。
- 不改變 push/pull 的檔案同步行為（sibling push 仍為單向全覆蓋、pull 仍僅回寫 SKILL.md body）。

## Non-Goals

- 不實作 sibling 的 pull-back（由後續 `sibling-pull-sync` change 負責）。
- 不實作 push 時的 sibling 孤兒清除（由後續 `sibling-push-cleanup` change 負責）。
- 不對 sibling 做 semantic hash（直接用 raw SHA-256，因為 sibling 格式不固定）。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `drift-detection`: 擴展 drift 偵測範圍，從僅 SKILL.md 到包含 bundled sibling 檔案。

## Impact

- Affected specs: `drift-detection`（修改）
- Affected code:
  - Modified: `src-tauri/src/commands/canonical_skills.rs`（`LastSyncEntry.sibling_hashes: Option<BTreeMap>`、`has_canonical_sibling_changes` helper、`canonical_skills_list` dirty + `siblings_dirty` 設定、`CanonicalSkill.siblings_dirty` 欄位）
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`（`check_drift` 擴展 sibling 比對、`compute_sibling_hashes` + `check_sibling_drift` helper、push 流程寫入 sibling hashes、`build_preview_for_skill` canonical sibling 比較）
  - Modified: `src-tauri/src/commands/fan_out/anthropic.rs`、`codex.rs`、`gemini.rs`（test: `siblings_dirty` 欄位）
  - Modified: `src/lib/components/skills/SyncInfoBar.tsx`（`siblingsDirty` prop + 提示文案）
  - Modified: `src/lib/components/skills/SkillsPage.tsx`（傳遞 `siblingsDirty` 到 SyncInfoBar）
  - Modified: `src/lib/components/skills/SkillEditor.tsx`（`siblingsDirty` 欄位初始值）
  - Modified: `src/lib/types/skills.ts`（`CanonicalSkill.siblingsDirty` 欄位）
  - Modified: `src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`（`syncInfoBar.siblingsDirty` key）
- 無新增依賴（npm / Cargo）
- 風險：sync meta schema 從 `pushed_hash: string` 擴展為包含 sibling hash map（`Option<BTreeMap>`），`None` = legacy meta 不比對、`Some({})` = 無 sibling 但可偵測新增、`Some({...})` = 正常比對
