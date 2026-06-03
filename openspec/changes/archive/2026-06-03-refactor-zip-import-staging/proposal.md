## Why

目前的 ZIP 匯入（`skill_library_import`）直接將檔案解壓縮到 `~/.felina/skills/`，繞過了前端的衝突比對（staging）機制。這造成可能靜默覆蓋同名 skill、夾帶錯誤的 `.felina-sync-meta.json` 狀態，且前端 UI 無法提供即時的匯入結果反饋。

## What Changes

- 新增後端指令 `scan_zip`，將 ZIP 解壓至系統暫存目錄，並對該目錄進行掃描，回傳 `ImportCandidate` 列表。
- 廢棄並移除原本直接寫入 canonical 的 `skill_library_import` 後端指令。
- 前端 `ImportStagingDialog` 改呼叫 `scan_zip`，並將回傳的候選名單加入 staging workflow 的 `Discovered` 區域。
- **BREAKING**: 外部工具若依賴 `skill_library_import` 的 IPC API 將會失效。

## Non-Goals



## Capabilities

### New Capabilities



### Modified Capabilities

- `skill-library-management`: ZIP import should extract to a temp directory and return import candidates, rather than writing directly to the canonical directory.

## Impact

- Affected specs: `skill-library-management`
- Affected code:
  - Modified: `src/lib/components/skills/import/ImportStagingDialog.tsx`
  - Modified: `src/lib/components/settings/SkillLibrarySection.tsx` — scope extension: 移除 Felina Settings 內直接呼叫 `skill_library_import` 的 Import 按鈕,改由 SkillsPage 的 Import dialog 為唯一入口（對齊 Decision 2 rationale）
  - Modified: `src/lib/tauri/commands.ts`
  - Modified: `src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts` — 移除 `felinaSettings.skillLibrary.{import,importSuccess,importError}` 三個孤兒 key 並調整 description
  - Modified: `src-tauri/src/commands/skill_import.rs`
  - Modified: `src-tauri/src/commands/skill_library.rs`
  - Modified: `src-tauri/src/lib.rs` — register `skill_import_scan_zip`、移除 `skill_library_import` 註冊
