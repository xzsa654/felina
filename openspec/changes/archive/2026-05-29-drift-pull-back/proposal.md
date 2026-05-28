## Why

當 agent 端的 skill 檔案被修改（例如 Claude Code 自動編輯 `.claude/skills/` 下的檔案），Felina 的 drift detection 能偵測到變更，但使用者沒有快速的方式將 agent 端的修改拉回 canonical。目前唯一的途徑是透過 Import 流程，步驟過多且不直覺。

此外，SkillList 目前無法顯示哪些 skill 存在 drifted target，使用者必須逐一點選 skill 才能在 TargetEditor 看到 drift badge。

## What Changes

- SkillList 每行 entry 增加 drift indicator，一眼辨識哪些 skill 有 target 端變更。
- Target 處於 Drifted 狀態時，在該 target 行旁顯示「Pull」按鈕。
- Pull 為一次性操作：讀取 agent target 端的 skill 檔案內容，覆寫回 Felina canonical SKILL.md。
- 後端新增讀取 target 端 skill 檔案內容的 command。
- Pull 完成後自動更新 sidecar 的 pushed_hash 與 lastSync，使 drift 狀態歸零。

## Non-Goals

- 不實作 diff preview（未來可加，本次先做最簡單的直接覆寫）。
- 不實作 detached / forked mode（屬於 `forked-target-overlay` 的 scope）。
- 不處理多 target 同時 drifted 的合併問題（使用者從單一 target pull，不做 multi-source merge）。
- 不改變現有 push 方向的同步邏輯。

## Capabilities

### New Capabilities

- `drift-pull-back`: 規範從 drifted agent target 拉回內容到 canonical 的操作流程與 UI。

### Modified Capabilities

- `drift-detection`: 在 SkillList 層級增加 drift 狀態呈現。

## Impact

- Affected specs: `drift-pull-back` (new), `drift-detection` (modified)
- Affected code:
  - New: `src/lib/components/skills/PullConfirmDialog.tsx`
  - Modified: `src-tauri/src/commands/fan_out/mod.rs` (新增 read_target_content + pull_to_canonical command)
  - Modified: `src-tauri/src/commands/mod.rs` (註冊新 command)
  - Modified: `src-tauri/src/lib.rs` (invoke_handler 新增)
  - Modified: `src/lib/tauri/commands.ts` (新增 pull API wrapper)
  - Modified: `src/lib/components/skills/SkillList.tsx` (drift indicator)
  - Modified: `src/lib/components/skills/TargetEditor.tsx` (Pull 按鈕)
  - Modified: `src/lib/stores/skills-store.ts` (pull action)
  - Modified: `src/lib/i18n/locales/en.ts` (pull 相關 keys)
  - Modified: `src/lib/i18n/locales/zh-TW.ts` (pull 相關 keys)
