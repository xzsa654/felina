## Why

目前沒有 canonical skill 的重新命名功能。使用者若要改名只能手動搬移目錄、修改 frontmatter、清理 agent-side 檔案——容易遺漏且 git history 斷裂。Felina 的 canonical storage（`~/.felina/skills/`）已由 `snapshot.rs` 管理為 git repo，可透過 `git2` 實現乾淨的 rename commit，保留版本歷史。

## What Changes

- 新增後端 Tauri command `canonical_skill_rename`，負責：
  1. 驗證新名稱合法性（不重複、無 path traversal）
  2. 透過 `git2` 在 canonical repo 中執行 rename（index remove old + fs::rename + index add new + commit）
  3. 更新 SKILL.md frontmatter 的 name 欄位
  4. 遍歷所有 target，刪除舊名稱的 agent-side 目錄（fs::remove_dir_all）
  5. 標記 dirty = true，清除所有 target 的 last_sync
- 新增前端 bridge wrapper
- SkillEditor header toolbar 新增「重新命名」按鈕（與 Delete / Save 同列），點擊彈出 dialog 輸入新名稱
- 新增 RenameSkillDialog 元件
- 新增 i18n keys（en + zh-TW）

## Non-Goals

- 不在 agent-side 使用 git2（避免影響使用者專案 repo 的 stage 狀態）
- 不自動觸發 push（rename 後標記 dirty，使用者手動或 Auto mode 觸發 push）
- 不支援批次 rename

## Capabilities

### New Capabilities

- `canonical-skill-rename`: canonical skill 重新命名功能，含 git2 版本追蹤、agent-side 清理、UI dialog

### Modified Capabilities

(none)

## Impact

- 無新增依賴（git2 已存在於 Cargo.toml）
- 無破壞性變更
- Affected code:
  - New: `src/lib/components/skills/RenameSkillDialog.tsx`
  - Modified: `src-tauri/src/commands/canonical_skills.rs`, `src-tauri/src/commands/snapshot.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri/commands.ts`, `src/lib/components/skills/SkillEditor.tsx`, `src/lib/components/skills/SkillsPage.tsx`, `src/lib/i18n/locales/en.ts`, `src/lib/i18n/locales/zh-TW.ts`
