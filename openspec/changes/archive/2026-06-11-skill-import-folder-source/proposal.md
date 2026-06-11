## Why

Skills page 的 import browser「Browse Files」目前只允許選取 ZIP 壓縮檔（dialog filter 寫死 `extensions: ["zip"]`）。使用者手上常見的是磁碟上現成的 skill 資料夾（例如從 repo clone 下來、或他人直接複製的目錄），現況必須先手動壓成 ZIP 才能匯入，多一道無謂工序。

匯入 pipeline（candidate → staging → conflict resolution → apply）本身只認 `source_path`、對來源格式無感，ZIP 解壓僅是前處理；放寬為「也可直接選資料夾」是低成本擴充。

## What Changes

- 後端新增 Tauri command `skill_import_scan_dir(path)`：掃描使用者選取的資料夾並回傳 `ImportCandidate[]`，重用既有的目錄掃描邏輯（與 ZIP 解壓後的掃描行為一致），不複製到 temp，`source_path` 直接指向原路徑
- 掃描判定規則：所選目錄本身含 `SKILL.md` → 視為單一 skill candidate；否則掃第一層子目錄、收集含 `SKILL.md` 者；皆無 → 回傳空清單
- 前端 `ImportStagingDialog` 的單一「Browse Files」入口拆為兩個：「Browse ZIP」與「Browse Folder」（Tauri 原生 dialog 無法在同一 picker 混選檔案與目錄）
- 資料夾來源掃出的 candidates 與 ZIP 相同，直接進右側 Staging pane，同名衝突沿用既有 inline overwrite/rename 機制
- 新增對應 i18n keys（en / zh-TW）

## Non-Goals

- 不新增其他壓縮格式支援（tar.gz、7z 等）— 需要新解碼器，目前無需求
- 不改動 Hub install（tar.gz 路徑）與 Skill Library 匯出（ZipWriter）— 確認過與本入口完全獨立
- 不改動 staging dialog 的版面、拖放行為、衝突解決 UI
- 不支援在同一 picker 同時選 ZIP 與資料夾（原生 dialog 限制，已採雙按鈕方案）

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skill-library-management`: 「Import skills from ZIP」requirement 擴充為「Import skills from ZIP or folder」— 新增資料夾來源的掃描 command 與選取入口，掃描判定規則（含 SKILL.md 即單一 skill、否則掃第一層子目錄）對兩種來源一致

## Impact

- Affected specs: `skill-library-management`
- Affected code:
  - New: (none — 新 command 加在既有模組內)
  - Modified:
    - src-tauri/src/commands/skill_import.rs（新增 `skill_import_scan_dir`，與 ZIP 掃描共用 candidate 收集邏輯）
    - src-tauri/src/lib.rs（invoke_handler 註冊新 command）
    - src/lib/tauri/commands.ts（新增 `scanDir` wrapper）
    - src/lib/components/skills/import/ImportStagingDialog.tsx（Browse 入口拆為 ZIP / Folder 兩個）
    - src/lib/i18n/locales/en.ts、src/lib/i18n/locales/zh-TW.ts（新按鈕文案 keys）
  - Removed: (none)
- 依賴：無新增 npm / Cargo 依賴
- 風險：無破壞性變更；既有 ZIP 匯入行為不變，backward compatible；無跨 change 依賴
