## Why

使用者最常見的操作模式是「在 Felina 編輯 skill → 推送到 agent target」。目前每次修改後都必須手動觸發 Push（dirty badge → Push 按鈕 → Preview → Confirm），對於高頻修改場景過於繁瑣。需要提供 auto sync 模式，讓 canonical save 後自動推送到指定的 target，降低同步摩擦。

## What Changes

- `TargetMode` 新增 `auto` 值，與 `manual`（原 `tracked`）並列。Sidecar 讀到舊值 `tracked` 視為 `manual`（永久 alias，不做 migration）。
- `enabled: boolean` 保留不動，`disabled` 仍是 `enabled=false`。
- 後端 `canonical_skills_write` 完成後，自動對該 skill 的所有 `auto + enabled` target 執行 push（複用現有 `skill_sync_one` 邏輯，跳過 preview/confirm）。
- `canonical_skills_write_raw`（raw repair save）和 `skill_pull_from_target`（pull 改了 canonical body）完成後同樣觸發 auto push。
- TargetEditor UI 的 toggle 從 `Tracked / Disabled` 改為 `Auto / Manual / Disabled`。`detached` / `forked` 維持反灰。

## Non-Goals

- 不實作 detached / forked mode（屬 `forked-target-overlay` scope）。
- 不改變 manual push 的 preview/confirm 流程。
- 不實作 file watcher 監聽 canonical 目錄變更 — auto push 僅在 Felina 自身的 write command 後觸發，不監聽外部編輯。
- 不實作 auto pull（pull 永遠是手動觸發）。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: TargetMode 新增 `auto` 值，save 後自動 push 行為。

## Impact

- Affected specs: `multi-agent-skills` (modified)
- Affected code:
  - Modified: `src-tauri/src/commands/canonical_skills.rs` (TargetMode enum 新增 `Auto`、sidecar `tracked` → `manual` alias)
  - Modified: `src-tauri/src/commands/fan_out/mod.rs` (auto push 邏輯：write 完成後呼叫 sync、pull 完成後呼叫 sync)
  - Modified: `src/lib/types/skills.ts` (TargetMode type 新增 `auto`)
  - Modified: `src/lib/components/skills/TargetEditor.tsx` (UI toggle 改為 Auto / Manual / Disabled)
  - Modified: `src/lib/i18n/locales/en.ts` (auto mode 相關 keys)
  - Modified: `src/lib/i18n/locales/zh-TW.ts` (auto mode 相關 keys)
