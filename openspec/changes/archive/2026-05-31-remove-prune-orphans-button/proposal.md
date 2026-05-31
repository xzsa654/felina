## Why

TargetEditor 上的「清除孤立檔案」按鈕功能與現有流程重疊——使用者刪除 target 時已有「移除 target 並刪除檔案」選項可達成相同效果。保留此按鈕增加不必要的 UI 表面積與後端維護成本。

## What Changes

- 移除 TargetEditor 上的「清除孤立檔案」按鈕及其相關 UI（scan 觸發、ConfirmDialog、狀態管理）
- 移除後端 `skill_prune_orphans_scan` 與 `skill_prune_orphans_apply` 兩個 Tauri command
- 移除前端 bridge 的 `skillPrune` wrapper 與 `OrphanFile` type
- 移除 i18n 中 `pruneOrphans`、`noOrphans`、prune confirm dialog 相關 keys
- 移除後端 `OrphanFile` struct 及相關單元測試
- Push 時的 orphan sibling 自動清理（`fan_out/mod.rs`）**不受影響**，保留不動

## Non-Goals

- 不移除 push 時的 orphan sibling 自動清理機制（`cleanup_orphan_siblings`）
- 不修改刪除 target 時「一併刪除檔案」的既有流程
- 不新增任何替代 UI

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: 移除 Explicit Orphan Prune requirement，修改 Explicit Target Removal Policy 移除對 orphan prune 的引用

## Impact

- 無新增依賴
- 無檔案結構變動
- 無破壞性變更（移除的功能已被其他流程完全覆蓋）
- 無跨 change 依賴
- Affected code:
  - Modified: `src/lib/components/skills/TargetEditor.tsx`, `src/lib/tauri/commands.ts`, `src/lib/types/index.ts`, `src/lib/types/skills.ts`, `src/lib/i18n/locales/en.ts`, `src/lib/i18n/locales/zh-TW.ts`, `src-tauri/src/commands/canonical_skills.rs`, `src-tauri/src/lib.rs`
  - Removed: (無獨立檔案移除，皆為既有檔案內的區塊刪除)
