## Why

Canonical skill 的 fan-out 目前只有兩種操作模式：push（canonical 覆寫 agent-side）與 pull（agent-side 覆寫 canonical）。當使用者需要為特定專案客製化某個通用 skill 時，只能選擇 detach（完全斷開連結）或 pull back（將專案修改覆寫回通用版）。`TargetMode::Forked` 與 `LastSyncEntry.base_snapshot` 已預留在 schema 中但尚未啟用，Phase 1 需要讓 fork 可用並提供預覽能力。

## What Changes

- 啟用 `TargetMode::Forked`：target 從 Auto/Manual 切換為 Forked 時，記錄 `base_snapshot`（fork 當下 canonical SKILL.md 的 SHA-256），Forked target 不再被 push 覆寫
- 新增後端 command `skill_fork_read_agent_content`：讀取指定 forked target 的 agent-side SKILL.md 內容
- 新增後端 command `skill_fork_diff_preview`：計算 canonical vs forked 的 unified diff hunks，複用現有 pull-diff 邏輯
- TargetPopover 新增「Preview Fork」按鈕（僅 Forked mode 顯示），點擊後開啟 ForkPreviewDialog
- ForkPreviewDialog（新 modal）：顯示 agent-side 內容（MarkdownPreview + raw tab）及 vs canonical 的 unified diff
- Target chip 狀態擴充：forked-clean / forked-edited(Δ) / canonical-ahead(⚠) / diverged(⚠⚠)
- Mode selector 新增 Forked 選項；從 Forked 切回 Auto/Manual 時顯示 destructive confirmation dialog

## Non-Goals

- 3-way merge / merge back to canonical（Phase 2）
- Side-by-side diff view（Phase 2，依實際 merge UX 需求再評估）
- Sibling files 的 fork 追蹤（Phase 2）
- Fork 層級的 conflict resolution UI

## Capabilities

### New Capabilities

- `skill-fork-preview`: Fork 模式切換、agent-side 內容讀取、fork diff 預覽、fork 狀態分類與 UI 呈現

### Modified Capabilities

- `drift-detection`: drift scan 需辨識 Forked target 的四種子狀態（clean/edited/canonical-ahead/diverged），而非將 forked 視為「無 drift」
- `sync-info-ui`: target chip 與 popover 需呈現 fork 狀態 badge 與 Preview Fork 入口

## Impact

- 受影響 specs：`drift-detection`、`sync-info-ui`（需 delta spec）；新增 `skill-fork-preview` spec
- 受影響程式碼：
  - Modified: `src-tauri/src/commands/canonical_skills.rs`（fork 切換邏輯、base_snapshot 寫入）、`src-tauri/src/commands/fan_out/mod.rs`（新增 read/diff commands）、`src-tauri/src/commands/mod.rs`（註冊新 commands）、`src-tauri/src/lib.rs`（invoke_handler 註冊）、`src/lib/tauri/commands.ts`（前端 invoke wrappers）、`src/lib/components/skills/TargetPopover.tsx`（Preview Fork 按鈕）、`src/lib/components/skills/sync-status-utils.ts`（fork 狀態分類）、`src/lib/types.ts` 或 `src/lib/types/skills.ts`（型別擴充）、`src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`
  - New: `src/lib/components/skills/ForkPreviewDialog.tsx`
  - Removed: 無
- 無新增 npm / Cargo 依賴
- 無破壞性變更：Forked mode 已存在於 enum，現有 push/pull 邏輯已跳過 Forked target
- 風險：drift scan 邏輯修改可能影響現有 Auto/Manual target 的 drift 判定，需確保不引入 regression
