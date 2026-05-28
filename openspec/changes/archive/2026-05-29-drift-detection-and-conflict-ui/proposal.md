## Why

目前 Felina 只在使用者按 Push 時（preview 階段）才偵測 agent-side drift。如果 agent 端的 SKILL.md 被外部工具、agent CLI、或使用者手動修改，Felina 在下次 push 前完全不知道。使用者可能誤以為所有 target 都是同步的，但實際上 agent 端已經偏離。這會導致錯誤覆蓋或誤判 synced 狀態。

## What Changes

- 從現有 `build_preview_for_skill()` 抽出純 hash 比對邏輯為獨立 `check_drift` 函式，不做 render、不寫入，只回傳 drift 狀態。
- 新增 `skill_drift_scan` IPC command，批次掃描所有 skill 的所有 enabled tracked target，回傳 per-skill per-target drift 狀態。
- 前端在 app 啟動、window refocus、手動 reload 時觸發 drift scan。
- CoverageMatrix 新增 `drifted` 狀態指示器（現有五種 synced/dirty/not-synced/disabled/no-target 之外的第六種）。
- TargetEditor 顯示 per-target drift 狀態。

## Non-Goals

- 不改動現有 push preview 流程（仍走完整 render + operation 分類）。
- 不改動 SyncPreviewDialog 的 BlockedDrift 解決 UI。
- 不做 file watcher（用事件觸發，非持續監聽）。
- 不實作 drift 自動解決（三向 diff + 覆蓋/拉回/解綁屬於後續迭代）。

## Capabilities

### New Capabilities

- `drift-detection`: 獨立的 target 端 drift 偵測能力，含 backend scan API、前端觸發邏輯、UI drift 狀態顯示。

### Modified Capabilities

- `multi-agent-skills`: fan-out 模組抽出 `check_drift` 共用函式，preview 和 drift scan 共用。
- `coverage-matrix`: CoverageMatrix 新增 drifted 狀態。

## Impact

- Affected specs: drift-detection (new), multi-agent-skills, coverage-matrix
- Affected code:
  - Modified: src-tauri/src/commands/fan_out/mod.rs
  - Modified: src-tauri/src/commands/mod.rs
  - Modified: src-tauri/src/lib.rs
  - Modified: src/lib/components/skills/CoverageMatrix.tsx
  - Modified: src/lib/components/skills/TargetEditor.tsx
  - Modified: src/lib/components/skills/SkillsPage.tsx
  - Modified: src/lib/stores/skills-store.ts
  - Modified: src/lib/tauri/commands.ts
  - Modified: src/lib/types/skills.ts
  - Modified: src/lib/types/index.ts
  - Modified: src/lib/i18n/locales/en.ts
  - Modified: src/lib/i18n/locales/zh-TW.ts
  - New: none expected (reuse existing modules)
  - Removed: none
- Dependencies: no new npm or Cargo dependency expected.
