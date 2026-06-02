## Why

Projects inventory 的同名衝突 row（`canonicalGlobalOnly`「全域重名」/ `canonicalExistsUnlinked`「待連結」）目前只能 Link 或 Overwrite。當 project local 與 Felina 主檔同名但其實是不同 skill 時，這兩條路都會弄丟一邊內容；使用者也無法在「同名但 Felina 全域已備援」的情境主動清掉 project 那份冗餘副本。

同時 Multi-source 情境（同名 skill 在多個 agent 目錄都掃到，例如 `.claude/skills/foo` 與 `.agents/skills/foo`）目前只能在 canonical 不存在時 import；canonical 存在時連 Overwrite 都不顯示。Link confirmation dialog 顯示的 diff 方向也與「連結後 Felina 將成為 incoming」的語意相反。

## What Changes

- Projects inventory 衝突 row 的主按鈕改為「選擇處理方式…」，點開「處理同名 dialog」列出可選路徑。
- 處理同名 dialog 提供四條路徑，依 relationship 動態顯示：
  - `canonicalGlobalOnly`：Link / Overwrite / Rename / Discard（四選項）
  - `canonicalExistsUnlinked`：Link / Overwrite / Rename（無 Discard，因為無 global fallback）
- 新增 **Rename project-local skill**：folder rename + SKILL.md frontmatter `name` 同步更新；duplicate name 檢查；path traversal 防護；`.agents/skills` 共用目錄一次改名等同 Codex + Gemini 同步改名。
- 新增 **Discard project-local skill**：刪 `<project>/<agent>/<skill>/` folder；canonical 與 sync-meta 不動。
- Multi-source + canonical 存在時，row 開放 Overwrite：drawer 選 source 後走既有 Overwrite confirm（與 Multi-source + localOnly 的 Import 流程對稱）。
- Diff 方向中性化：後端 `ConflictInfo.hunks` 改為固定 old=project source / new=canonical；前端 Link / Overwrite dialog 各自依語境反轉 add/delete render 與 legend 文字。
- Overwrite confirm dialog 也顯示 hunks（不再只是文字 message）。
- 對應 i18n key 新增（en / zh-TW）：處理同名 dialog title、四條路徑按鈕、Rename / Discard confirm、Overwrite hunks legend。

## Non-Goals

- 不對已 Link row 提供「從此專案移除 skill」流程（那是「我不要這個 skill」而非「同名衝突」，本 change 不混合）。
- 不改 canonical sync-meta schema。
- 不改 `.agents/skills` shared-directory invariant。
- 不改 agent path 設定模型。
- 不改 i18n key 名（`importToGlobal` 等正名屬獨立工程）。
- 不重命名 canonical 主檔（既有 `canonical_skill_rename` 不在本 change 動）。
- 不新增第三方依賴。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `projects-view`: 衝突 row 的解析 UI 與 Multi-source Overwrite 對齊；Diff 方向定義。

## Impact

- Affected specs:
  - openspec/specs/projects-view/spec.md
- Affected code:
  - Modified: src/lib/components/projects/ManagedInventory.tsx
  - Modified: src/lib/components/projects/managed-inventory.ts
  - Modified: src/lib/i18n/locales/en.ts
  - Modified: src/lib/i18n/locales/zh-TW.ts
  - Modified: src-tauri/src/commands/skill_import.rs
  - Modified: src-tauri/src/lib.rs
  - Modified: src/lib/tauri/commands.ts
  - Modified: src/lib/types/skills.ts
  - New: tests/projects-local-skill-resolution.test.ts
- APIs:
  - 新增 Tauri command `project_local_skill_rename(project_path, agent, old_name, new_name)`
  - 新增 Tauri command `project_local_skill_delete(project_path, agent, skill_name)`
  - `ConflictInfo.hunks` 方向變更（old=source, new=canonical），影響 Link / Overwrite dialog 顯示但 schema 不變。
- Dependencies:
  - 無 npm / Cargo 依賴變動。
- Compatibility:
  - 既有 canonical skills、sync-meta、`.agents/skills` 共用 invariant 保持相容。
  - Diff 方向變更後，Link dialog 的 `+` 與 `-` 視覺意義會改變（從「project 是 incoming」改為「Felina 是 incoming」）— 對使用者是語意修正不是 break。
