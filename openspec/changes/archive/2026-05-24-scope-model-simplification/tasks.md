## 1. Baseline 與依賴順序前置

- [x] 1.1 建立健全度基線：跑 `npm run check` 與 `cargo test --manifest-path src-tauri/Cargo.toml --lib`，將 npm error 數（預期 0）與 cargo passing 數（預期 62）記入 `openspec/changes/scope-model-simplification/baseline.txt`。Verify: 該檔存在，記錄通過數與當前 warning 數作為下界。
- [x] 1.2 確認本機既有 `<project>/.felina/skills/*` 樣本現況並記入 baseline.txt 附註（本機在先前 (f) 重做時已清空；migration 已移除，此項僅作環境紀錄）。

## 2. 後端：移除 `SkillScope::Project` canonical 分支（對應 MODIFIED Requirement: Canonical Skill Storage）

- [x] 2.1 （對應 MODIFIED Requirement: Canonical Skill Storage）在 `src-tauri/src/commands/canonical_skills.rs` 把 `canonical_skills_dir_for_scope(scope, project_path)` 收成 `canonical_skills_dir()`，回傳 `paths::felina_global_skills_dir()`，並更新內部 caller（`canonical_skills_list` / `canonical_skills_read` / `canonical_skills_write` / `canonical_skills_delete` / `skill_targets_set` / `skill_prune_orphans_*`）。所有需要 project_path 的 canonical CRUD 簽名一併簡化。Verify: cargo build exit 0；無對應 SkillScope::Project canonical 分支殘留。
- [x] 2.2 [P] （對應 MODIFIED Requirement: Initial Skill Import）在 `src-tauri/src/commands/skill_import.rs` 把 `skill_import_apply` / `skill_import_scan` / `skill_import_scan_quick` 簽名拿掉 scope，寫入路徑固定 `~/.felina/skills/`；`skill_import_apply(project_path?)` 依 project_path 加對應 `SkillTarget`（`Some`→scope=project / `None`→scope=global）。Verify: cargo build exit 0；scan 結果仍能列出指定 project agent 目錄的 skill。
- [x] 2.3 [P] 在 `src-tauri/src/paths.rs` 移除 `felina_project_skills_dir`；加 `#[cfg(test)]` thread_local `felina_home` override 供測試把 `~/.felina/skills/` 重導到 tempdir。Verify: cargo build exit 0；無 dead-code warning；test suite 不退化。
- [x] 2.4 在 `src-tauri/src/commands/fan_out/mod.rs` 確認 `resolve_pair` 與 `SkillTarget.scope=project` push 行為不變，doc comment 標註「scope 僅指 push 目的地、不再隱含主檔位置」；`skill_sync_one/all` 簽名拿掉 scope。`skill_prune_orphans_scan` 改從 skill 自身 targets 反推要掃的 project（`OrphanFile` 加 `project` 欄位）。Verify: cargo build exit 0；fan_out / canonical 既有 cargo test 全部仍 pass。

## 3. 前端：取消 Skills 頁 Global/Project toggle 與 ProjectPicker（對應 MODIFIED Requirement: Registered Pages）

- [x] 3.1 在 `src/lib/components/skills/SkillsPage.tsx` 移除 `ScopeToggle` 與 scope state；header 只留 List/Summary view-mode toggle、Reload、New skill。Verify: `npm run check` exit 0；Skills 頁 header 無 Global/Project toggle。
- [x] 3.2 [P] 在 `src/lib/stores/skills-store.ts` 移除 `scope` state 與 `setScope` action；caller 全部更新。Verify: `npm run check` exit 0；無 unused export。
- [x] 3.3 在 `SkillImportWizard.tsx` 移除 import target scope 選擇；wizard 一律 import 到 global、目標 target 由來源（global agent dirs 或指定 project）決定。Verify: `npm run check` exit 0；wizard UI 無 scope 選擇器。
- [x] 3.4 [P] 在 `AddTargetDialog.tsx` / `SkillEditor.tsx` / `TargetEditor.tsx` 移除 canonical-scope prop（只留 target scope/project 與 push 目的地語意）。Verify: `npm run check` exit 0；行為與 (b) 落地版一致。
- [x] 3.5 移除 Skills 頁的 ProjectPicker；Skills 的 canonical 列表與 import scan 都走 global（per-project import 移到 Projects view）。`projectPath` 僅留作 TargetEditor 新增 project-scope target 的預設值與 not-found 指示。Verify: `npm run check` exit 0；Skills 頁無 project 選擇器。
- [x] 3.6 [P] `SkillList.tsx` 的 `sortRank` 把「無 target（`targets.length === 0`）」的 skill 一併浮到頂層（與 broken/dirty 同 rank），當「待設定」提醒（恢復 dirty 語意統一後失效的行為）。Verify: `npm run check` exit 0；新建未設 target 的 skill 出現在清單上層。

## 4. 前端：Projects top-level view（對應 ADDED Requirement: Projects Top-Level View + Managed Inventory View）

- [x] 4.1 （對應 MODIFIED Requirement: Registered Pages）`src/router.tsx` 新增 `/projects` lazy route；`navigation.ts`（`Page` type/`NAV_ITEMS`）、`Header.tsx`（`PAGE_TITLES`/`PAGE_DESCRIPTIONS`）、`Sidebar.tsx`（icon map）一致，nav 共六頁 `{skills, projects, settings, templates, tokens, memory}`，且 skills 的 label 由「Skills & Agents」改為「Skills」。Verify: `npm run check` exit 0；sidebar 與 Command Palette 同步列出六頁。
- [x] 4.2 [P] （對應 ADDED Requirement: Projects Top-Level View）`ProjectsPage.tsx` 頁面 shell（PageHeader「Projects」+ `grid-cols-[280px_minmax(0,1fr)]` 兩欄）；`selectedProjectPath` 預設 L1 cwd、無 L1 → 第一個；focus/visibility re-stat。Verify: `npm run check` exit 0；route 進得去、兩欄佈局。
- [x] 4.3 [P] （對應 MODIFIED Requirement: Known Projects Model）`ProjectsList.tsx` 左欄：`known_projects_list` 取 KnownProject[]，alphabetical normalized path 排序；path + 來源 chip（cwd/detected/saved）；`exists=false` 顯示「project not found」；選中 highlight；空清單 empty state。Verify: `npm run check` exit 0。
- [x] 4.4 （對應 ADDED Requirement: Managed Inventory View）`ManagedInventory.tsx` 右欄 union 邏輯：`skill_import_scan(project)` ∪ `canonical_skills_list` 中 target 指向此 project 的 skill；每行 managed 標籤 + per-agent chip×3（present iff scan 對應 agent 含此 skill）。exists=false 顯示「找不到該 project 資料夾」空表。Verify: `npm run check` exit 0。
- [x] 4.5 ManagedInventory row 動作（D2）：Unmanaged → 「Import to global」(`skill_import_apply`，**global 同名主檔時跳 ConfirmDialog 確認覆蓋**，不靜默蓋)；Managed → 點擊 navigate `/skills?select=<name>`。Verify: `npm run check` exit 0；Import 成功後該行變 Managed。
- [x] 4.6 [P] Skills 頁支援 `?select=<name>` deep-link（entries 載入後選中該 skill 並清除 param）。Verify: `npm run check` exit 0；`/skills?select=git` 進入時自動選中。
- [x] 4.7 `ProjectsList.tsx` 對 `exists=false` 且來源含 `saved`（L3）的條目提供移除鈕 → ConfirmDialog → `known_projects_remove` → 重整；純 detected/cwd 來源不給（避免重掃重現的誤導）。Verify: `npm run check` exit 0；smoke：刪掉某 saved project 資料夾後，左欄該條目可一鍵從清單移除。

## 5. 移除 migration 功能（scope 縮減：project-scope canonical 從未發布、無存量資料，遷移機器為不存在情境而建）

- [x] 5.1 [P] 後端移除 `src-tauri/src/commands/migration.rs`、`commands/mod.rs` 的 `pub mod migration;`、`lib.rs` `invoke_handler!` 的 `migrate_project_canonicals_scan/_apply` 兩條註冊。Verify: cargo build exit 0；無 dead-code / unresolved-import；無 migration 相關 symbol 殘留。
- [x] 5.2 前端移除 `src/lib/components/projects/MigrationPanel.tsx`；`ManagedInventory.tsx` 移除 legacy migration banner、`migration.scan()` 呼叫、`legacyCandidates`/`migrationOpen` state 與相關 import。Verify: `npm run check` exit 0；Projects 右欄不再出現 migration banner。
- [x] 5.3 [P] 移除 `src/lib/tauri/commands.ts` 的 `api.migration` wrapper 與 `src/lib/types/skills.ts` / `types/index.ts` 的 `MigrationCandidate`/`MigrationAction`/`MigrationResult` type 匯出。Verify: `npm run check` exit 0；無 unused type / dangling import。

## 6. 整合與最終驗證

- [x] 6.1 跑 `npm run check`（0 error）、`cargo build`（exit 0、無新 warning vs baseline 的 2 個 tokens/ warning）、`cargo test --manifest-path src-tauri/Cargo.toml --lib`（移除 migration 4 個測試後回到 baseline 62、且不退化）。Verify: 三項通過、cargo test = 62。
- [x] 6.2 [P] 跑 `spectra validate scope-model-simplification` 與 `spectra analyze scope-model-simplification`：Critical = 0、Warning = 0。Verify: validate ✓、analyze Clean。
- [x] 6.3 手動 smoke（使用者書面回報）：(a) sidebar 六頁、Skills 頁無 Global/Project toggle 也無 ProjectPicker；(b) Skills 頁新建 skill 出現在 `~/.felina/skills/<name>`，新建未設 target 的浮在清單上層；(c) Projects 頁左欄列 Known Projects、預設選 cwd、exists=false 顯示警示且 saved 條目可移除；(d) 選中 project → 右欄列出 union 行 + 納管標籤 + per-agent chip；(e) Unmanaged 行 Import to global（同名先確認）成功後變 Managed；(f) Managed 行點擊跳到 Skills 並選中；(g) Projects 右欄**不再**出現 migration banner，legacy `.felina/skills/` 不被讀也不被刪。Verify: 使用者書面回報 (a)–(g) 行為符合預期。
