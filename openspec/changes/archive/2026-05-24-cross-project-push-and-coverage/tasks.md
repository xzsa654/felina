## 1. Baseline + Tauri Dialog Plugin

- [x] 1.1 建立健全度基線：跑 `npm run check` 與 `cargo test --manifest-path src-tauri/Cargo.toml --lib`，記錄 npm error 數（預期 0）與 cargo passing 數作為下界（預期 61）。Verify: 基線記錄完成。
- [x] 1.2 [P] 確認 `tauri-plugin-dialog` 是否已安裝：檢查 `src-tauri/Cargo.toml` 是否含 `tauri-plugin-dialog` dependency 及 `src-tauri/src/lib.rs` 是否註冊 `.plugin(tauri_plugin_dialog::init())`。若未安裝，加入 dependency 並註冊 plugin。前端確認 `@tauri-apps/plugin-dialog` 已在 `package.json`（若無則 `npm install @tauri-apps/plugin-dialog`）。Verify: `cargo build` exit 0；`npm run check` 0 error。

## 2. Cross-project target 解鎖（對應決策「cross-project target：前端解鎖 + 後端已就緒」；MODIFIED Requirement: Per-Skill Target Editor）

- [x] 2.1 （對應 MODIFIED Requirement: Per-Skill Target Editor）在 `src/lib/components/skills/AddTargetDialog.tsx` 移除 `disabled={!isCurrent}` 限制：所有 Known Projects 項目均可選（移除 `" — cross-project: Phase 1.5 (b)"` 提示文字）。Verify: `npm run check` 0 error；AddTargetDialog 的 project 下拉中非當前 project 的 entry 可選、不再 disabled。
- [x] 2.2 [P] 手動驗證 cross-project push：新建 skill → 加 target 指向另一個 Known Project → Push → 確認 rendered SKILL.md 寫入目標 project 的 agent skill 目錄（例如 `<other-project>/.claude/skills/<skill-name>/SKILL.md`）。Verify: 檔案存在且內容為 rendered frontmatter + body。

## 3. Manual project path entry（對應決策「Manual project path entry：Tauri folder dialog + known_projects_add」；Requirement: Manual Project Path Entry）

- [x] 3.1 （對應 ADDED Requirement: Manual Project Path Entry）在 `src/lib/components/skills/AddTargetDialog.tsx` 新增「Browse...」按鈕：位於 project dropdown 旁。點擊呼叫 `open({ directory: true })` from `@tauri-apps/plugin-dialog`。選中後呼叫 `api.knownProjects.add(path)` 寫入 L3，然後 `api.knownProjects.list()` 刷新下拉清單並 `setSelectedProject(path)` 自動選中。取消時 no-op。Verify: `npm run check` 0 error；點擊 Browse 開啟 OS folder dialog、選中後路徑出現在下拉且自動選中；取消後無變化。

## 4. Coverage summary view-mode（對應決策「Coverage summary view-mode：SkillsPage 內 List / Summary toggle」；Requirement: Coverage Matrix View）

- [x] 4.1 （對應 ADDED Requirement: Coverage Matrix View）在 `src/lib/components/skills/SkillsPage.tsx` 新增 `viewMode` state（`"list" | "summary"`，預設 `"list"`）+ header 區 view-mode toggle（兩個 icon button：列表 / 表格圖示）。toggle 切換 `viewMode`。List mode 渲染現有佈局；Summary mode 渲染 `<CoverageMatrix />`。Verify: `npm run check` 0 error；toggle 可切換、Summary mode 掛載 CoverageMatrix 元件。
- [x] 4.2 [P] （對應 ADDED Requirement: Coverage Matrix View）在 `src/lib/components/skills/CoverageMatrix.tsx` 新建 coverage matrix 元件：接收 `entries: SkillListEntry[]`。從 entries 提取所有 skill（kind="ok"）及其 targets，計算去重的 column 組合（agent × scope × project）。渲染 CSS grid：行 = skill（name 排序），列 = target 組合。列 header 顯示 `agent / scope`（global）或 `agent / <last-path-segment>`（project）。Cell 根據 skill 的 targets 和 lastSync 顯示 sync state icon（✓ / ● / — / ○ / 空白）。無 skill 時顯示 empty state「No skills to display」。Verify: `npm run check` 0 error；matrix 正確渲染 skill × target grid、cell icon 對應 sync state。
- [x] 4.3 [P] 在 `src/lib/types/skills.ts` 或 `CoverageMatrix.tsx` 內定義 sync state 判定邏輯函式 `cellSyncState(skill, targetKey)`：對照 `skill.lastSync[key]` 存在性、`skill.dirty`、`target.enabled` 決定 cell 狀態。Verify: 函式邏輯覆蓋 5 種 state（synced / dirty / not-synced / disabled / no-target）。

## 5. Origin-project 降級（對應決策「Origin-project 消失時的降級」；Requirement: Origin-Project Degradation）

- [x] 5.1 （對應 ADDED Requirement: Origin-Project Degradation）在 `CoverageMatrix.tsx` 和 Sync info bar（`SkillsPage.tsx` 的 Sync info 區塊）中，對 project-scope target，檢查 `target.project` 是否仍在 `known_projects_list` 結果中。若不在，cell / Sync info 顯示 "project not found" 標示（tooltip 或淺紅色文字），而非 "Not synced"。Verify: `npm run check` 0 error；移除一個 Known Project 後，對應 target 顯示 "project not found"。

## 6. 整合與最終驗證

- [x] 6.1 跑 `npm run check`（0 error）與 `cargo build`（exit 0、無新 warning）。Verify: 兩項通過。
- [x] 6.2 跑 `cargo test --manifest-path src-tauri/Cargo.toml --lib`：確認 baseline 61 tests 不退化。Verify: 全部 passing。
- [x] 6.3 跑 `spectra validate cross-project-push-and-coverage` 與 `spectra analyze cross-project-push-and-coverage`：確認 Critical = 0、Warning = 0。Verify: validate valid、analyze Clean。

## 7. 手動 smoke（使用者書面回報）

- [x] 7.1 [P] 手動 smoke：`npm run tauri dev` 啟動；(a) AddTargetDialog 選非當前 project → 不再 disabled、可選；(b) Push cross-project target → 目標 project agent dir 出現 rendered SKILL.md；(c) Browse 按鈕 → OS folder dialog → 選中後路徑寫入 L3 並出現在下拉、自動選中；(d) Skills 頁 List / Summary toggle 可切換；(e) Summary mode 顯示 skill × target grid、cell sync state 正確、矩陣滿版、不殘留 Sync info bar；(f) 改名 / 刪除目標 project 資料夾 → Reload 或切回視窗 → 顯示 "project not found"、push 跳過。Verify: 使用者書面回報 (a)–(f) 行為符合預期。

## 8. Smoke 回饋修正 + Origin-Project Degradation 重設計（對應決策「跨平台路徑比對：統一 normalizeProjectPath，禁止無條件 casefold」+「Origin-project 消失時的降級」改用 `Path::exists()`）

- [x] 8.1 跨平台路徑正規化：新增 `src/lib/utils/path.ts` 的 `normalizeProjectPath`（對齊後端 `known_projects::normalize_path`：反斜線→正斜線、去尾斜線、僅 Windows casefold via `navigator.userAgent`）；`AddTargetDialog.tsx` / `CoverageMatrix.tsx` / `SkillsPage.tsx` 三處改用，移除無條件 `.toLowerCase()`。Verify: `npm run check` 0 error。
- [x] 8.2 AddTargetDialog select 對正 + Browse：新增 `matchOption` 把 `selectedProject` 對正到清單精確 `p.path`（修「下拉顯示 A 卻提示 exists、需切 B 再切回 A」的受控 select 失配）；Browse 後也以 `matchOption` 選中新增路徑。Verify: `npm run check` 0；project 下拉一開始顯示當前 project、跨 project 第一次即可選。
- [x] 8.3 CoverageMatrix 滿版：grid 改 `min-w-full` + `minmax(180px,1.5fr) repeat(N, minmax(80px,1fr))`（少欄填滿面板、多欄水平捲動）。Verify: `npm run check` 0；Summary 矩陣填滿寬度。
- [x] 8.4 Summary 模式隱藏 Sync info bar：`SkillsPage.tsx` 的 Sync info 區塊加 `viewMode === "list"` 條件。Verify: `npm run check` 0；切 Summary 不再殘留上一個 skill 的 Sync info。
- [x] 8.5 known-projects 快取過期修正：`SkillsPage.tsx` 把 `known_projects_list` 重載拆成獨立 effect、依賴 `entries`（加 target / push 後 `entries` 變動即重載）。Verify: `npm run check` 0；Browse 新增 project 並 push 後不再誤判 "project not found"。
- [x] 8.6 後端存在性偵測（對應 ADDED Requirement: Origin-Project Degradation，重設計）：`src-tauri/src/commands/known_projects.rs` 的 `KnownProject` struct 加 `exists: bool`，`known_projects_list` 組每筆時以 `std::path::Path::new(&path).exists()` 填入（不新增 command）；`src/lib/types/skills.ts` 的 `KnownProject` type 加 `exists: boolean`。新增 cargo test：對「清單含某路徑但磁碟不存在」回 `exists=false`、實際存在的暫存目錄回 `exists=true`。Verify: `cargo build` exit 0；新 test 通過、baseline tests 不退化。
- [x] 8.7 前端降級判定改用 `exists` + window focus 觸發（對應 ADDED Requirement: Origin-Project Degradation，重設計，取代 task 5.1 的清單成員判定）：`SkillsPage.tsx`（Sync info bar）與 `CoverageMatrix.tsx` 的 project-not-found 判定改為「在清單且 `exists===false`、或不在清單 → not found」；`SkillsPage.tsx` 的 known-projects 重載 effect 再加 `window` focus / `visibilitychange` 觸發（搭配既有 Reload + Skills 頁掛載 + entries 變動）。Verify: `npm run check` 0；改名 / 刪除目標 project 資料夾後 Reload 或切回視窗即顯示 "project not found"。
- [x] 8.8 重跑驗證：`npm run check`（0 error）、`cargo build`（exit 0、無新 warning）、`cargo test --manifest-path src-tauri/Cargo.toml --lib`（不退化 + 新 exists test 通過）、`spectra validate` + `analyze`（Critical = 0、Warning = 0）。Verify: 全部通過。
- [x] 8.9 （對應 ADDED Requirement: Origin-Project Degradation）TargetEditor row 補 "project not found" 標示：`TargetEditor.tsx` 加 `knownProjects` prop，project-scope target 以 `isProjectMissing` 判定，not-found 時於該 row 顯示紅色 `AlertTriangle + "project not found"` + tooltip 恢復指引（還原資料夾 / 刪除重指）；`SkillsPage.tsx` 兩處 `<TargetEditor>` 傳入 `knownProjects`。就地 repoint 不在本 change（記 (c) skill-sync-lifecycle）。Verify: `npm run check` 0 error；`spectra validate` + `analyze` Clean；目標 project 資料夾不存在時 TargetEditor 該 row 顯示 not-found 標示（smoke 併入 7.1）。
