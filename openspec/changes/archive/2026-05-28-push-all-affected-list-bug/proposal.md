## Why

當使用者只修改一個 skill 後按下 Push all，確認對話框目前會列出所有 canonical skills。這會讓使用者誤以為所有 skills 都會被操作，也讓確認內容與 pending-push banner 顯示的 dirty count 不一致。

## What Changes

- Push all preview SHALL include only dirty, pushable skills.
- Push all confirmation dialog SHALL list only the skills that the Push all action will actually operate on.
- Skills that are clean, broken, or have no pushable targets SHALL NOT appear in the Push all preview dialog.
- Push all commit SHALL continue to operate only on the previewed affected skills.

## Non-Goals

- 不改變 per-skill Push 行為。
- 不新增 target-side drift auto detection。
- 不重設 sync preview operation classification。
- 不改變 dirty flag 的儲存 schema。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: Pending-push sync state 的 Push all preview/confirmation SHALL only include affected dirty skills.

## Impact

- Affected specs: `multi-agent-skills`
- Affected code:
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`
  - Modified: `src/lib/components/skills/PendingPushBar.tsx`
  - Modified: `src/lib/components/skills/SyncPreviewDialog.tsx`
  - Modified: `src/lib/i18n/locales/en.ts`
  - Modified: `src/lib/i18n/locales/zh-TW.ts`
  - New: none
  - Removed: none
- Dependencies: no new npm or Cargo dependency.
