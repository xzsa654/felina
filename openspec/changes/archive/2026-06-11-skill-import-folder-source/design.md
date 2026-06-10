## Context

Skills page 的 import staging dialog 提供「Browse Files」入口，目前 dialog filter 寫死只接受 ZIP（`ImportStagingDialog.tsx` 內 `open({ filters: [{ name: "ZIP", extensions: ["zip"] }] })`）。後端 `skill_import_scan_zip` 把 ZIP 解壓到 OS temp 目錄後，掃描「含 `SKILL.md` 的 top-level 目錄」產生 `ImportCandidate[]`；後續 staging → conflict resolution → apply 整條 pipeline 只認 candidate 的 `source_path`，對來源格式無感。

可重用的現有元件：
- src-tauri/src/commands/skill_import.rs 的 `collect_zip_candidates_in`（解壓後的目錄掃描，本質與 ZIP 無關）與 `ImportCandidate` 型別
- src/lib/components/skills/import/staging-logic.ts 的 `createStagingItem` 衝突偵測
- src/lib/components/skills/import/SkillStagingCard.tsx 的 inline overwrite/rename UI
- src-tauri/src/commands/skill_package.rs 共用驗證+落盤層（格式無關，apply 階段已使用）

## Goals / Non-Goals

**Goals:**

- 使用者可在 import browser 直接選取磁碟上的資料夾匯入 skill，不必先壓成 ZIP
- 資料夾來源與 ZIP 來源走完全相同的 staging / 衝突解決 / apply 流程

**Non-Goals:**

- 不支援其他壓縮格式（tar.gz、7z）
- 不改動 Hub install（tar.gz）與 Skill Library 匯出（ZipWriter）
- 不改動 staging dialog 版面、拖放行為、衝突解決 UI
- 不做單一 picker 混選檔案與資料夾（Tauri 原生 dialog 的 `directory` 為布林二選一，做不到）

## Decisions

### Decision 1: 後端新增 **skill_import_scan_dir** command，重用既有目錄掃描邏輯

`collect_zip_candidates_in` 在 ZIP 解壓完成後做的事就是「掃任意目錄找含 SKILL.md 的子目錄」。新 command 直接以使用者選取的路徑為掃描根，重用（必要時改名共用）該函式，不另寫第二套 candidate 推導，避免 agent 推斷、衝突偵測兩套漂移。

替代方案：前端把資料夾壓成 ZIP 再走 scan_zip — 多一次無謂 IO 與 temp 寫入，否決。

### Decision 2: 資料夾來源**不複製到 temp**，source_path 直接指向原路徑

apply 階段本來就從 `source_path` 讀檔；本地目錄不需要 ZIP 那層解壓快照。若使用者在 staging 期間刪除來源目錄，apply 回傳明確錯誤 — 與既有專案掃描（`skill_import_scan`）的行為一致，可接受。

替代方案：複製到 temp 做快照隔離 — 增加 IO 與清理負擔，且與既有專案掃描行為不一致，否決。

### Decision 3: 掃描判定規則 — **選取目錄本身含 SKILL.md 即為單一 skill**，否則掃第一層子目錄

使用者最直覺的操作是直接選 `my-skill/` 資料夾本身；若只掃子目錄，這個 case 會回空清單，是最容易踩到的 UX 地雷。判定順序：
1. `<選取目錄>/SKILL.md` 存在 → 回傳單一 candidate（skill 名 = 目錄名）
2. 否則掃第一層子目錄，收集含 `SKILL.md` 者（與 ZIP 掃描一致）
3. 皆無 → 回傳空清單，前端顯示既有的「找不到 skill」狀態

### Decision 4: 前端 Browse 入口拆為 **Browse ZIP 與 Browse Folder 兩個按鈕**

Tauri `@tauri-apps/plugin-dialog` 的 `open()` 無法在同一 picker 混選檔案與目錄。雙按鈕語意最清楚；Folder 按鈕呼叫 `open({ directory: true })`，掃出的 candidates 與 ZIP 相同直接進右側 Staging pane。

替代方案：單按鈕 + 先彈出「ZIP 或資料夾？」二段選擇 — 多一次點擊且無資訊增益，否決。

## Implementation Contract

- **行為**：使用者點「Browse Folder」→ 原生目錄選取 dialog → 選定後該資料夾內的 skill（依 Decision 3 規則）以 candidate 形式直接出現在 Staging pane；同名衝突顯示既有 overwrite/rename UI；Import 後寫入 canonical `~/.felina/skills/`。既有 ZIP 流程行為完全不變。
- **介面**：新 Tauri command `skill_import_scan_dir(dir_path: String) -> Result<Vec<ImportCandidate>, String>`；前端 wrapper `api.skillImport.scanDir(dirPath: string): Promise<ImportCandidate[]>`。`ImportCandidate` 形狀不變。
- **失敗模式**：路徑不存在或不是目錄 → `Err` 字串錯誤，前端顯示在 dialog 既有 error 區；目錄內找不到任何 SKILL.md → `Ok([])`（非錯誤），Staging 無新增。apply 時來源已被刪除 → 既有 apply 錯誤路徑回報。
- **安全敏感標記**：本 command 讀取使用者任意選取的檔案系統路徑 — tasks 應包含 /spectra-audit 審查步驟（路徑遍歷不適用因無解壓，但需確認 symlink 與非目錄輸入的行為）。
- **UI-related 標記**：Browse 入口按鈕變更 — tasks 必須包含 /felina-ui-guidelines review 步驟，驗證階段把評估結論寫進 archive notes。
- **驗收**：
  - `cargo test --lib` 含新增單元測試：選取目錄本身含 SKILL.md、子目錄含 SKILL.md、空目錄、混合（部分子目錄無 SKILL.md 被略過）
  - `npm run check` 通過
  - 手動 `npm run tauri dev`：Browse Folder 選取含多 skill 的資料夾 → Staging 出現對應卡片 → Import 成功寫入 canonical
- **In Scope**：上述 command、wrapper、dialog 按鈕、i18n keys、單元測試
- **Out of Scope**：Non-Goals 所列全部；retained-for-reference 模組不動

## Risks / Trade-offs

- [使用者在 staging 期間刪除來源資料夾] → apply 回傳明確錯誤訊息，不靜默跳過；與既有專案掃描行為一致
- [選取超大資料夾（如整個 home）導致掃描慢] → 只掃第一層子目錄、不遞迴，成本上限為一層 readdir
- [無新增依賴] → 無 bundle size / 編譯時間影響
