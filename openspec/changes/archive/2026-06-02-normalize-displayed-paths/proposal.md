## Problem

在 Windows 上開啟 Felina，多個 Skills 頁面的 UI 區塊會出現原始 backslash `\` 路徑分隔字元，與其他經過正規化（forward slash）的路徑混雜：

- `SkillImportWizard` 多來源選擇列、conflict canonical path 顯示
- `ImportStagingDialog` / `SkillStagingCard` 的 sourcePath 列
- `SkillEditor` broken canonical 路徑、`SkillList` broken row 的 path 顯示
- `TargetPopover` 的 tooltip `title={target.project}`

這違反 Felina 跨平台一致顯示的約定，使用者在同一畫面看到 `c:/myproject/pershing/felina/.claude/skills/foo\SKILL.md` 這種前半 forward slash、後半 backslash 的混雜字串。

## Root Cause

後端三個 Tauri command 在輸出 path String 時呼叫 `Path::to_string_lossy()`，在 Windows 上會保留 `\` 分隔字元：

- `skill_import_scan` → 每個 `ImportCandidate.source_path` 與 `ConflictInfo.canonical_path`
- `canonical_skills_list` → broken entry 的 `path`
- `skill_sync_one` / `skill_sync_all` → `SyncResult.target_path`（push 結果 dialog 顯示）
- `skill_sync_preview` / `skill_sync_all_preview` → `SkillSyncPreview.target_dir` / `skill_dir` / `skill_md_path`
- `skill_target_dir_resolve` → `TargetDirInfo.path`
- `canonical_skill_delete` → `CanonicalSkillDeleteResult.canonical_path`
- `delete_skill_dir_result` → `DeletePathResult.path`

（前端 `brokenRaw.path` 由 `SkillListEntry`（broken kind）的 `path` 組出，已由 `canonical_skills_list` normalize 涵蓋；`canonical_skills_read_raw` 本身只回傳 raw content 字串，無 `path` 欄位需處理。）

前端某些渲染點有做 `.replace(/\/g, "/")`（例如 `TargetChips`、`CoverageMatrix`、`ManagedInventory`），某些沒做（即上述 import / staging / broken / tooltip 區塊）。結果是「有些地方乾淨、有些地方還 raw」的不一致狀態。

`known_projects::normalize_path` 已對 KnownProject.path 做了正規化（`\` → `/` + 去尾斜線 + Windows casefold），所以 `KnownProject.path` 永遠是乾淨的；但 casefold 對 display path 不適用 — 使用者期待看到原樣大小寫的路徑（`C:/MyProject/...` 而非 `c:/myproject/...`）。

## Proposed Solution

**1. 新增後端 helper `normalize_display_path`**
新增一個專供顯示用的 normalize 函式，與 `known_projects::normalize_path` 區隔：

- 替換 `\` 為 `/`
- 去尾斜線
- **保留大小寫**（不做 casefold）— 與 identity 用的 `normalize_path` 不同

放在新檔 `src-tauri/src/paths_display.rs` 或加進現有 `paths.rs`，作為 `pub(crate)` helper 給多個 command 共用。

**2. 將後端三個 command 出口 path field 套用 `normalize_display_path`**
- `skill_import.rs::skill_import_scan` 在 push `ImportCandidate` 前 normalize `source_path`、`conflict.canonical_path`
- `canonical_skills.rs::canonical_skills_list` 對 broken entry 的 `path` 欄位做 normalize
- `canonical_skills.rs::canonical_skill_delete` 對 `canonical_path` 做 normalize；`delete_skill_dir_result` 對輸出 `path` 做 normalize
- `fan_out/mod.rs` 對 `SyncResult.target_path`（4 處 push、preview）、`SkillSyncPreview.{target_dir, skill_dir, skill_md_path}`（3 group）、以及 `skill_target_dir_resolve` 回傳 `TargetDirInfo.path` 做 normalize

**3. 前端可選擇移除重複 normalize**
`TargetChips:24`、`CoverageMatrix:96`、`TargetPopover:223`、`managed-inventory.ts` 內的 `.replace(/\/g, "/")` 因後端已 normalize 而成 no-op，但保留也無害（defence-in-depth）。本次保留，避免改動範圍擴散。

## Non-Goals

- 不改 `known_projects::normalize_path` 行為（identity match 需要 casefold）
- 不對 Tauri command 輸入路徑做 normalize（只動輸出顯示用）
- 不修改前端任何渲染邏輯（後端統一後前端不用動）
- 不處理 UNC / WSL `\wsl$\Ubuntu\...` 路徑（另開 Open Question）
- 不導入 path canonicalization（`..` segment 解析） — audit 過後沒看到任何後端產生帶 `..` 的路徑

## Success Criteria

- 在 Windows 上開啟 SkillImportWizard / ImportStagingDialog / SkillStagingCard / SkillEditor broken view / SkillList broken row / TargetPopover tooltip，**沒有任何路徑文字含 `\` 分隔字元**
- 路徑文字保留原樣大小寫（`C:/MyProject/...` 不會變 `c:/myproject/...`）
- 後端三個 command 的單元測試新增覆蓋 normalize 對輸出 path field 的效果
- `KnownProject.path` 行為不變（仍 casefolded）— 既有 `known_projects` 測試全通過
- `npm run check` 與 `cargo check` 無新增 error

## Impact

- Affected code:
  - Modified:
    - `src-tauri/src/commands/skill_import.rs`
    - `src-tauri/src/commands/canonical_skills.rs`
    - `src-tauri/src/commands/fan_out/mod.rs`
    - `src-tauri/src/paths.rs`
  - New: (none)
  - Removed: (none)
