## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings 數量，作為本 change 前後比較基準。驗證：記錄輸出結果。

## 2. 後端 snapshot.rs 擴展（Design: snapshot.rs 擴展; Task scope: snapshot.rs 擴展）

- [x] 2.1 實作 Rename canonical skill 的 git2 層：在 `src-tauri/src/commands/snapshot.rs` 新增 `pub fn rename_skill(old_name: &str, new_name: &str) -> Result<String, String>`，封裝 git2 rename 操作：遍歷 `old_name/` 下所有檔案呼叫 `index.remove_path`，執行 `fs::rename(old_dir, new_dir)`，遍歷 `new_name/` 下所有檔案呼叫 `index.add_path`，commit message 為 `rename: {old_name} → {new_name}`，回傳 40-char hex commit hash。驗證：新增 `snapshot::tests::rename_skill_creates_commit_with_both_names` 測試，`cargo test -p felina --lib snapshot` 通過。

## 3. 後端 Tauri command（Design: 後端 command 簽名 + Rename 流程（在 canonical_skills.rs 實作）; Task scope: 後端 command）

- [x] 3.1 實作 Rename canonical skill 後端 command：在 `src-tauri/src/commands/canonical_skills.rs` 新增 `RenameResult` struct（欄位：`old_name`、`new_name`、`commit_hash`、`targets_cleaned: u32`、`targets_failed: Vec<String>`）和 `#[tauri::command] canonical_skill_rename(old_name: String, new_name: String) -> Result<RenameResult, String>`。實作流程：(1) 驗證新名稱（非空、無 path traversal、不重複）；(2) 呼叫 `snapshot::rename_skill` 執行 git2 rename；(3) 讀取 `new_name/SKILL.md` 更新 frontmatter name 欄位並寫回；(4) 讀取 sync-meta targets，遍歷每個 target resolve 舊名稱 agent-side 路徑並 `fs::remove_dir_all`，記錄成功/失敗數；(5) 設定 `dirty = true`，清除所有 `last_sync`。驗證：新增測試 `rename_succeeds_and_updates_frontmatter`、`rename_rejects_duplicate_name`、`rename_rejects_path_traversal`、`rename_rejects_empty_name`，`cargo test -p felina --lib canonical_skills` 通過。
- [x] 3.2 在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊 `canonical_skill_rename`。驗證：`cargo build -p felina` 通過。

## 4. 前端 Bridge 與 Types（Design: 前端 bridge）

- [x] [P] 4.1 在 `src/lib/types/skills.ts` 新增 `RenameResult` interface（欄位與後端 `RenameResult` 對齊：`oldName`、`newName`、`commitHash`、`targetsCleaned`、`targetsFailed`）。在 `src/lib/types/index.ts` 新增 re-export。驗證：`npm run check` 通過。
- [x] [P] 4.2 在 `src/lib/tauri/commands.ts` 的 `canonicalSkills` 區塊新增 `rename: (oldName: string, newName: string) => invoke<RenameResult>("canonical_skill_rename", { oldName, newName })`。驗證：`npm run check` 通過。

## 5. 前端 RenameSkillDialog 元件（Design: 前端 UI; Task scope: 前端 UI）

- [x] 5.1 實作 Rename skill UI dialog：新增 `src/lib/components/skills/RenameSkillDialog.tsx`，props 為 `open: boolean`、`currentName: string`、`onConfirm: (newName: string) => void`、`onCancel: () => void`。包含文字輸入框，即時驗證邏輯：空值 disabled、與 currentName 相同 disabled、含 `..`/`/`/`\` 顯示錯誤訊息。確認按鈕呼叫 `onConfirm(newName)`。驗證：`npm run check` 通過。

## 6. 前端 SkillEditor 整合（Design: 前端 UI）

- [x] 6.1 整合 Rename skill UI 到 SkillEditor：在 `src/lib/components/skills/SkillEditor.tsx` 的 toolbar 區域（`!isNew` 條件下，Delete 按鈕左側）新增 Rename 按鈕（Lucide `Pencil` icon），點擊開啟 RenameSkillDialog。新增 `onRename?: (newName: string) => void` prop。按鈕僅在 `!isNew && onRename` 時渲染。驗證：`npm run check` 通過。
- [x] 6.2 在 `src/lib/components/skills/SkillsPage.tsx` 傳遞 `onRename` callback 給 SkillEditor：呼叫 `api.canonicalSkills.rename(currentName, newName)`，成功後 `loadEntries()` 刷新列表並將 `selectedSkill` 設為新名稱；失敗則將 error 顯示在 SkillEditor 的 error state。驗證：`npm run check` 通過。

## 7. i18n

- [x] [P] 7.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 新增 `skills.editor.rename`、`skills.editor.renameTitle`、`skills.renameDialog.title`、`skills.renameDialog.placeholder`、`skills.renameDialog.confirm`、`skills.renameDialog.cancel`、`skills.renameDialog.errorEmpty`、`skills.renameDialog.errorSame`、`skills.renameDialog.errorInvalid` 共 9 個 keys。驗證：`npm run check` 通過（TranslationDict 結構對齊）。

## 8. 驗證

- [x] 8.1 執行 `npm run check`，確認 TypeScript errors 數量與 baseline 相比無新增。驗證：零 error。
- [x] 8.2 執行 `cargo test --lib -p felina`，確認所有測試通過（含新增的 rename 相關測試）。驗證：全通過（除 pre-existing `active_source_can_roll_back_to_legacy_parser_rows` 失敗）。
- [x] 8.3 `npm run tauri dev` 手動驗證：(1) 既有 skill 的 SkillEditor toolbar 顯示 Rename 按鈕（在 Delete 左側）；(2) 新建 skill 模式不顯示 Rename 按鈕；(3) 點擊 Rename 開啟 dialog，輸入驗證正常（空值、相同名稱、非法字元）；(4) rename 成功後列表刷新且新名稱被選中；(5) rename 後 dirty 標記出現，Push 後 agent-side 目錄使用新名稱。驗證：五項行為皆符合預期。
