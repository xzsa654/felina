## Why

目前 Felina 已能把 canonical skill fan-out 到多個 agent target，但寫入、覆寫、刪除、移除 target 與修復 missing project target 的流程缺少同一套安全確認模型。這會讓使用者無法在 commit 前看見會被改動的 agent-side 檔案，也可能在 target 檔案已被外部修改時被靜默覆寫。

## What Changes

- Push 前新增 dry-run preview，列出每個將被處理的 target path、create / overwrite / no-op / skipped / blocked-drift 狀態與彙總數量；UI 的主要摘要要用人可判讀的「需要注意 / 不會立即寫檔」語意，細項計數放在次要位置，必須由使用者確認後才執行寫入。
- Push 執行前加入 drift guard：當 target SKILL.md 目前 hash 與 last_sync.pushed_hash 不一致時，UI 必須提供 override / detach / cancel 決策，並清楚說明 Detach 會把 target mode 改成 detached、Cancel 不改 target 設定，預設不得靜默覆寫。
- Canonical skill delete 改為明確選擇 Cascade / Detach / Cancel：Cascade 只刪除目前 `enabled + tracked` 且可解析 target 的 agent-side skill 目錄後刪 canonical，disabled / detached / forked target 不受 Cascade 影響；當目前有 0 個 `enabled + tracked` target 時，Cascade 選項必須反灰不可按；Detach 只刪 canonical 並保留 agent-side 檔案。
- Per-target removal 改為明確選擇 Remove target only / Remove target and delete file / Cancel，刪檔只作用於該 target 解析出的 agent-side skill 目錄。
- Project not found target row 新增 in-place repoint，讓使用者可 Browse 到新的 project path，保留 agent、scope、enabled、mode，並讓新的 target 重新進入 pending push 狀態。

## Non-Goals

- 不實作 forked-target overlay、diff viewer 或 agent-side 內容 merge。
- 不改變 canonical skill 的全域 by-name identity，也不處理同名 skill namespace 策略。
- 不把 agent-side 檔案自動反向匯入 canonical；drift 只阻擋或要求決策。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- multi-agent-skills: 補上 target lifecycle safety、push preview、drift guard、delete/removal confirmation、missing project repoint 的需求契約。

## Impact

- Affected specs: multi-agent-skills
- Affected code:
  - New: none
  - Modified:
    - src-tauri/src/commands/fan_out/mod.rs
    - src-tauri/src/commands/canonical_skills.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri/commands.ts
    - src/lib/types/skills.ts
    - src/lib/components/skills/SkillsPage.tsx
    - src/lib/components/skills/TargetEditor.tsx
    - src/lib/components/skills/PendingPushBar.tsx
    - src/lib/components/shared/ConfirmDialog.tsx
    - src/lib/i18n/locales/en.ts
    - src/lib/i18n/locales/zh-TW.ts
  - Removed: none
- Dependencies: 不新增 npm 或 Cargo dependency。
- Risk: 這會改變 destructive / overwrite flow 的互動順序，但不改 canonical storage schema shape；既有 sync-meta version 2 可透過 last_sync key prune 和 dirty flag 支援 repoint。Cascade delete 與 target file delete 是破壞性檔案操作，實作階段必須納入安全 audit。
