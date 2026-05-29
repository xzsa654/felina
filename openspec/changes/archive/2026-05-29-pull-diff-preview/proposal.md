## Why

目前 `skill_pull_from_target` 會直接用 target 端內容覆蓋 canonical SKILL.md，使用者在 pull 前無法得知 canonical 與 target 之間的具體差異。`PullConfirmDialog` 只顯示靜態警告文字，沒有任何 diff 資訊。

`local-versioning-and-snapshot-layer` 已完成，每次 push 後 `base_snapshot` 會記錄 commit hash，`get_snapshot_content` 可從 git object store 取回上次 push 時的 canonical 內容。我們現在有足夠的基礎建設來實作 pull 前的 diff preview。

## What Changes

- 新增後端 IPC command `skill_pull_preview`：取三份內容（base snapshot / 現在 canonical / target 端），產生結構化 diff data 回傳前端。
- 擴充 `PullConfirmDialog`：從純文字警告升級為 inline diff viewer，顯示新增/刪除/修改行，使用者看完 diff 後才決定是否執行 pull。
- 若 `base_snapshot` 為 `None`（舊 skill 未曾 push），退化為 two-way diff（canonical vs target），不阻斷操作。

## Non-Goals

- 不實作 3-way merge 自動合併（留待 `forked-target-overlay`）。
- 不實作 side-by-side diff viewer（空間有限，用 inline diff）。
- 不改變 pull 的最終行為——確認後仍是整份覆蓋 canonical。
- 不啟用 `TargetMode::Forked`。

## Capabilities

### New Capabilities

- `pull-diff-preview`: 定義 pull 前的 diff preview 流程、diff data 結構、以及使用者確認互動。

### Modified Capabilities

- `drift-pull-back`: 修改 pull 操作流程，在覆蓋前先經過 diff preview 確認步驟。

## Impact

- Affected specs: `pull-diff-preview`（新增）、`drift-pull-back`（修改）
- Affected code:
  - New: 後端 diff preview IPC command（在 `src-tauri/src/commands/fan_out/mod.rs` 內新增函式）
  - Modified: `src/lib/components/skills/PullConfirmDialog.tsx`（擴充為 diff viewer）
  - Modified: `src/lib/components/skills/TargetEditor.tsx`（pull 流程改為先 preview 再 confirm）
  - Modified: `src/lib/tauri/commands.ts`（新增 invoke wrapper）
  - Modified: `src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`（diff preview 相關文案）
