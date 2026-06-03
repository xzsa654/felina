## Context

目前的外部 ZIP 匯入是透過後端 `skill_library.rs` 中的 `skill_library_import` 指令直接解壓縮到 `~/.felina/skills/` (canonical目錄)。這跳過了前端 `ImportStagingDialog` 既有的「Staging 機制」，導致：
1. 無 UI 反饋：前端匯入完後，Discovered 清單不會更新，因為 `scan()` 只會掃描已知的工作目錄。
2. 安全與防護漏洞：直接覆寫既有檔案，且可能帶入惡意的或不相容的 `.felina-sync-meta.json` 狀態，也缺乏 schema 驗證。

## Goals / Non-Goals

**Goals:**
- 將 ZIP 匯入流程整合進現有的 `ImportStagingDialog` staging 流程。
- 防堵外部匯入帶來的 sync-meta 污染與靜默覆寫問題。

**Non-Goals:**
- 不改變既有的衝突解決（Conflict resolution）與套用（Apply）的資料結構。
- 不修改匯出 (Export) 流程。

## Decisions

### Decision 1: 新增 `skill_import_scan_zip` Tauri 指令
**Rationale**: 將 ZIP 解壓縮與掃描邏輯封裝在後端，解壓到系統暫存目錄（如 `std::env::temp_dir()` 下建立隨機名稱的子目錄）。然後對該暫存目錄執行與現有 `scan()` 相同的 `SKILL.md` 掃描，回傳 `ImportCandidate` 陣列給前端。
這樣前端拿到 `ImportCandidate` 後，只需加入到 staging 狀態即可，後續的 Apply 流程（包含複製到 canonical 與清理重建 metadata）完全沿用既有邏輯。
**Alternatives**: 在前端透過 WASM 解壓縮，然後將檔案逐一寫入。缺點是增加 frontend 負擔與可能需要引入新的 zip 函式庫，而 Rust 已經有 `zip` crate。

### Decision 2: 廢棄並移除 `skill_library_import`
**Rationale**: 舊有的直寫 canonical 流程已經不符合應用程式的設計規範，應予以移除，避免未來有其他呼叫端誤用。原本的 `ImportStagingDialog` 也會全面改用 `skill_import_scan_zip`。

**Scope correction (apply 階段)**: Propose 階段的 Impact 漏列 `SkillLibrarySection.tsx` — 它的 Import 按鈕也呼叫 `api.skillLibrary.import`,直接呼應「避免其他呼叫端誤用」rationale,屬於必須一併移除的範圍。一併拔掉 Import 按鈕、`handleImport` handler、`open` dialog import,以及 en/zh-TW 內三個孤兒 i18n key (`import`、`importSuccess`、`importError`)。Felina Settings 內 Export 與 Reset 保留;ZIP 匯入收斂為 SkillsPage 的 Import dialog 單一入口。

### Decision 3: ZIP 候選直送 Staging,不進 Discovered
**Rationale**: 使用者主動透過 Browse Files 選 ZIP = 明確匯入意圖,沒有「先看看再決定」的步驟。把 ZIP candidates 灌進左邊 Discovered 會強迫使用者再拖一次才能進入 staging 流程,額外操作沒有任何資訊收穫。同名衝突由 `SkillStagingCard` 內建的 overwrite / rename UI 處理,跟 agent-dir 掃描來的 candidate 走完全相同的衝突解決路徑,不需要差別待遇。
**Alternatives**: (a) 全進 Discovered,使用者拖到 Staging — 多一次無意義操作。(b) 無衝突進 Staging、有衝突進 Discovered — 行為分歧,使用者要記兩條規則。
**Implementation note**: `handleBrowseFiles` 收到 `zipCandidates` 後用 `createStagingItem` 包成 `StagingItem` 直接 setStaging,以 `sourcePath` Set 去重避免重複按 Browse 重複加入。

## Implementation Contract

- **Behavior**: 
  - 呼叫 `skill_import_scan_zip(path)` 時，系統會在 OS 暫存目錄解壓縮該 ZIP。
  - 掃描解壓縮後的內容，尋找合法的 `SKILL.md`，並回傳 `Vec<ImportCandidate>`。
  - 前端 `ImportStagingDialog` 在拿到結果後，更新 UI 上的 Discovered 清單，不會再有「匯入後無感」的狀況。
- **Interface / data shape**:
  - `pub async fn skill_import_scan_zip(zip_path: String) -> Result<Vec<ImportCandidate>, String>`
- **Failure modes**: 
  - 若 ZIP 無效或解壓縮失敗，回傳明確的 `Err(String)`。
  - 若 ZIP 內無任何 `SKILL.md`，回傳空陣列 `[]`。
- **Acceptance criteria**: 
  - 測試：透過 UI 選擇 ZIP 匯入，可以成功將內容列在 Discovered 區塊，並且不會直接寫入 `~/.felina/skills/`，必須點擊 Import 且無衝突才能真正寫入。
- **Scope boundaries**: 
  - **In Scope**: `skill_import.rs` 增加掃描 ZIP 邏輯，`ImportStagingDialog.tsx` 修改呼叫端。
  - **Out of Scope**: 其他既有掃描邏輯的修改。

## Risks / Trade-offs

- **[Risk] 暫存目錄未清理導致佔用空間** → **Mitigation**: 暫存目錄會在作業系統的 Temp 區建立。短期內依賴 OS 的 Temp 目錄生命週期機制以保持簡單。
