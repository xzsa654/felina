## Why

Projects page 目前把「此 project 實際掃到哪些 skill 來源」、「Felina canonical master 是否已有 target」、「同一份 `.agents/skills` 檔案可由 Codex/Gemini 共用」混在同一個 row 欄位與同一個 Import 動作裡。從使用者角度看，這會造成兩個誤判：同名 canonical 已存在時被引導去 overwrite，而同一個 shared physical file 被呈現成像是多份來源檔。

這個 change 要把 Projects page 重新收斂成單一 project 的 skill inventory：清楚顯示本 project 的 detected sources、Felina 管理狀態、以及 multi-source import 的 attribution 選擇。

## What Changes

- Projects inventory row 改成兩個獨立語意軸：
  - Detected sources：只表示 selected project 實際掃到的 agent-native skill sources。
  - Felina targets：只表示同名 canonical master 的 relevant targets（global 或 selected project）。
- 修正 same-name canonical 行為：
  - canonical 已有 selected project target 時，row 才算 Managed。
  - canonical 只有 global target 時，row 顯示 local copy 與 Felina global 同名的 duplicate/resolve 狀態，不視為 Managed。
  - canonical 存在但沒有 selected project target 時，主要路徑改成 Link to Project，且 Link 前必須顯示 canonical/local 差異確認。
  - overwrite 保留為明確的次要選項，不再是 same-name canonical 的預設主流程。
- Multi-source drawer 改為 physical-source-first：
  - 同一個 physical `.agents/skills/<name>/SKILL.md` 被 Codex/Gemini 共同讀到時，UI 顯示一張 shared source card。
  - 使用者在 card 內選擇 attribution（Codex 或 Gemini）；選擇仍決定 `selectSource` 的 source index、匯入 target agent，以及 Codex `openai.yaml` merge side effect。
  - non-selected attribution 仍由現有後端保留為 disabled targets，方便日後在 target editor 啟用。
- UI 必須遵守 `$felina-ui-guidelines`：
  - 使用 list view、padding、hover 背景與 row-integrated chips。
  - 不使用傳統 `<table>`、硬格線、外掛式 warning/info bar。
  - 狀態與下一步動作必須融入 row 本身或 inline drawer。

## Non-Goals

- 不新增刪除 project-local skill 的 destructive flow；本 change 只標示 duplicate 並提供 link/import/overwrite。
- 不改變 agent path 設定模型或 `.agents/skills` shared-directory invariant。
- 不改變後端 import attribution side effects；Codex source 仍負責 `openai.yaml` merge，Gemini source 仍不產生 synthetic fields。
- 不新增第三方依賴。

## Capabilities

### New Capabilities

- 無。

### Modified Capabilities

- `projects-view`: 修改 Managed Inventory 的 row 語意、same-name canonical resolution、multi-source source selection presentation，以及 UI presentation contract。

## Impact

- Affected specs:
  - `openspec/specs/projects-view/spec.md`
- Affected code:
  - Modified: `src/lib/components/projects/managed-inventory.ts`
  - Modified: `src/lib/components/projects/ManagedInventory.tsx`
  - Modified: `src/lib/i18n/locales/en.ts`
  - Modified: `src/lib/i18n/locales/zh-TW.ts`
  - Added/modified tests under `tests/`
- APIs:
  - Reuse existing `skill_import_scan`, `skill_import_apply`, `canonical_skills_list`, and `skill_targets_set`.
  - No new Tauri command is planned unless implementation discovers `ImportCandidate.conflict.diffSummary` is insufficient for the required confirmation; if added, it must be a narrow preview-only command.
- Dependencies:
  - No npm or Cargo dependency changes.
- Compatibility:
  - Existing canonical skills and sync-meta schema remain compatible.
  - Existing shared `.agents/skills` behavior remains intentional and visible.
