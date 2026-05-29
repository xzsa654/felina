## Context

`copy_bundled_siblings()` 在 push 時遞迴複製 canonical 目錄下的所有非 SKILL.md 檔案到 agent 端，但不處理「canonical 端已刪除但 agent 端仍存在」的檔案。`sibling-drift-detection`（已完成）在 sync meta 中記錄了 `LastSyncEntry.sibling_hashes: Option<BTreeMap<String, String>>`（`None` = legacy 跳過、`Some(map)` = pushed baseline），提供了判斷孤兒的 baseline。`compute_sibling_hashes` helper 可直接複用。

## Goals / Non-Goals

**Goals:**
- Push 時自動清除 agent 端的孤兒 sibling（canonical 端已移除的檔案）。
- Push preview 顯示將被清除的 sibling 清單。
- 僅清除可追溯的孤兒（在 pushed baseline 中有記錄但 canonical 端已不存在的檔案）。

**Non-Goals:**
- 不清除 agent 端使用者手動新增的檔案（不在 baseline 中的不動）。
- 不做互動式確認（清除行為包含在 push preview 中，使用者確認 push 即同意清除）。

## Decisions

### **孤兒判定邏輯**

孤兒 = 存在於 `sibling_hashes`（上次 pushed baseline）中，但 canonical 目錄已不包含該檔案。
非孤兒 = agent 端有但 baseline 中沒有的檔案（使用者在 agent 端手動新增的，不動）。

這確保只刪除「Felina 之前推過去、但 canonical 已移除」的檔案，不影響使用者在 agent 端的自主新增。

### **清除時機**

在 `copy_bundled_siblings()` 完成後、寫入新的 `sibling_hashes` 之前執行清除。流程：
1. 讀取舊的 `sibling_hashes`（上次 pushed baseline）
2. 列出 canonical 端現有 sibling
3. 差集 = 舊 baseline 中有但 canonical 端沒有的 → 刪除 agent 端對應檔案
4. 寫入新的 `sibling_hashes`（反映 canonical 端現狀）

### **Push preview 擴展**

在 `SyncPreview` 回傳結構中新增 `orphan_siblings: Vec<String>`，列出將被清除的 sibling 路徑。前端 `SyncPreviewDialog` 在差異明細中顯示。

## Implementation Contract

- **Behavior**：push 時，若 canonical 端已刪除某些先前推過的 sibling，agent 端對應的檔案會被自動清除。Push preview 會事先列出將被清除的檔案。
- **Interface / data shape**：
  - `SyncPreview` struct 新增 `orphan_siblings: Vec<String>`。
  - 前端 `SkillSyncPreview` type 對應擴展。
- **Failure modes**：
  - 刪除 agent 端 sibling 失敗（權限） → log warning，不中斷 push。
  - `sibling_hashes` 為 `None`（legacy meta） → orphan list 為空，不清除任何檔案。
  - `sibling_hashes` 為 `Some({})`（push 時無 sibling） → orphan list 為空（沒有 baseline 記錄可刪除）。
  - 清除後空目錄 → 不自動刪除空目錄（避免意外刪除 agent 的目錄結構）。
- **Acceptance criteria**：
  - `cargo test`：push 後 agent 端不再包含 canonical 已移除的 sibling。
  - `cargo test`：agent 端使用者手動新增的檔案不受影響。
  - `cargo test`：舊 meta 無 sibling_hashes 時不刪除任何檔案。
  - `npm run check` 通過。
  - `npm run tauri dev` 手動驗證 push preview 顯示 orphan siblings。
- **Scope boundaries**：
  - In scope：push 時孤兒清除、push preview 擴展、SyncPreviewDialog 顯示。
  - Out of scope：pull sibling、drift UI 變動、空目錄清除。

## Risks / Trade-offs

- **[Risk] 誤刪使用者想保留的檔案** → Mitigation：僅刪除在 pushed baseline 中有記錄的檔案，agent 端自主新增的不動。且 push preview 事先顯示清單。
