## 1. Baseline

- [x] 1.1 跑 `npm run check` 與 `cargo test --lib`（src-tauri/）記錄現有 errors / warnings 基線，驗證階段比較差異，明確區分本 change 新引入 vs pre-existing。完成條件：基線結果記錄於 change 工作筆記（dirty 數、error 清單）

## 2. 後端：Import skills from folder

- [x] 2.1 在 src-tauri/src/commands/skill_import.rs 新增 Tauri command `skill_import_scan_dir(dir_path: String) -> Result<Vec<ImportCandidate>, String>`，依 design「Decision 1: 後端新增 **skill_import_scan_dir** command，重用既有目錄掃描邏輯」與「Decision 3: 掃描判定規則 — **選取目錄本身含 SKILL.md 即為單一 skill**，否則掃第一層子目錄」實作：(a) 選取目錄本身含 SKILL.md → 回傳單一 candidate（名稱 = 目錄名）；(b) 否則掃第一層子目錄收集含 SKILL.md 者、不遞迴；(c) 皆無 → `Ok(vec![])`；(d) 路徑不存在或非目錄 → `Err` 字串。依「Decision 2: 資料夾來源**不複製到 temp**，source_path 直接指向原路徑」不做 temp 複製。與 ZIP 掃描共用 candidate 收集邏輯（重用/抽取 `collect_zip_candidates_in`），不寫第二套推導。完成條件：cargo 單元測試覆蓋 (a)(b)(c)(d) 四情境 + 混合目錄（部分子目錄無 SKILL.md 被略過），`cargo test --lib` 通過
- [x] 2.2 在 src-tauri/src/lib.rs 的 invoke_handler 註冊 `skill_import_scan_dir`，使前端可呼叫。完成條件：`cargo build` 在 src-tauri/ 通過，且 invoke_handler 巨集內包含該 command

## 3. 前端：Browse Folder 入口

- [x] 3.1 [P] 在 src/lib/tauri/commands.ts 的 `api.skillImport` 新增 `scanDir(dirPath: string): Promise<ImportCandidate[]>` wrapper（invoke `skill_import_scan_dir`）。完成條件：`npm run check` 通過
- [x] 3.2 在 src/lib/components/skills/import/ImportStagingDialog.tsx 依 design「Decision 4: 前端 Browse 入口拆為 **Browse ZIP 與 Browse Folder 兩個按鈕**」改造：既有按鈕改為 Browse ZIP（行為不變），新增 Browse Folder 按鈕呼叫 `open({ directory: true })` → `api.skillImport.scanDir` → 掃出的 candidates 直接進右側 Staging pane（與 ZIP 相同的去重與 `createStagingItem` 路徑），空清單時 Staging 不變且不顯示錯誤，`Err` 時顯示於既有 error 區。完成條件：`npm run check` 通過；手動驗證見 5.2
- [x] 3.3 [P] 在 src/lib/i18n/locales/en.ts 與 zh-TW.ts 新增 Browse ZIP / Browse Folder 按鈕文案 keys（skills.* namespace），元件內以 `t(locale, key)` 取用、不硬編碼。完成條件：`npm run check` 通過（TranslationDict 結構對齊）

## 4. 安全審查

- [x] 4.1 跑 /spectra-audit 審查本 change 的後端改動（`skill_import_scan_dir` 讀取使用者任意選取路徑）：確認 symlink 目錄、非目錄輸入、權限不足時的行為皆回傳明確錯誤或安全略過，無路徑遍歷疑慮（無解壓步驟）。完成條件：audit 結論記錄於 change 工作筆記，發現的問題已修復或明確標記接受

## 5. 驗證

- [x] 5.1 跑 /felina-ui-guidelines 評估本 change 的 UI 改動（import dialog 雙 Browse 按鈕），輸出命中的 guideline 與 deviation 清單，結論寫入 archive notes。完成條件：評估報告產出（未跑此 task 不可進入 /spectra-archive）
- [x] 5.2 `npm run tauri dev` 手動驗證「Import skills from folder」端到端行為：(a) Browse Folder 選取直接含 SKILL.md 的目錄 → Staging 出現單一卡片、名稱 = 目錄名；(b) 選取含多個 skill 子目錄的母目錄 → 每個含 SKILL.md 的子目錄各一張卡片、無 SKILL.md 的子目錄被略過；(c) 選取無任何 skill 的目錄 → Staging 不變、無錯誤；(d) 與既有 canonical 同名 → 出現 overwrite/rename 衝突 UI；(e) Import 後 skill 寫入 ~/.felina/skills/ 且不含來源的 .felina-sync-meta.json；(f) 既有 Browse ZIP 流程行為不變（「Import skills from ZIP」回歸）。完成條件：(a)–(f) 全數通過並記錄
- [x] 5.3 最終靜態檢查：`npm run check` 通過、`cargo test --lib` 通過、與 1.1 基線比對無本 change 新引入的 error / warning。完成條件：比對結果記錄
