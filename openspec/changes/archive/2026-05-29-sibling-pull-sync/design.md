## Context

`drift-pull-back` change 已實作 SKILL.md 的 pull-back 流程：`skill_pull_preview()` 預覽差異、`skill_pull_from_target()` 回寫 canonical SKILL.md body。但 sibling 檔案（script、templates 等）在 pull 時完全被忽略。`sibling-drift-detection`（已完成）提供了 `LastSyncEntry.sibling_hashes: Option<BTreeMap<String, String>>` 作為 baseline（`None` = legacy 跳過、`Some({})` = 無 sibling、`Some({...})` = 有記錄），以及 `compute_sibling_hashes` helper。本 change 在此基礎上擴展 pull 流程。

## Goals / Non-Goals

**Goals:**
- Pull 時將 agent 端的 sibling 變動（新增、修改、刪除）同步回 canonical 目錄。
- Pull preview 顯示 sibling 差異明細。
- 使用者可在 PullConfirmDialog 中看到 sibling 變動並確認。
- 衝突處理：當同一 sibling 兩端都有變動時，讓使用者選擇保留哪一端。

**Non-Goals:**
- 不做 sibling 的逐行 diff viewer。
- 不做自動 merge（二進位檔案無法 merge）。
- 不處理 push 端的孤兒清除。

## Decisions

### **Pull preview 擴展 sibling 差異**

`skill_pull_preview()` 回傳結構新增 `sibling_changes` 欄位：

```rust
struct SiblingChange {
    path: String,          // 正斜線相對路徑
    status: SiblingStatus, // Added | Modified | Deleted | Conflict
}
```

- `Added`：agent 端有、canonical 端沒有（且 `sibling_hashes` 中無記錄，或記錄中也沒有）。
- `Modified`：兩端都有但內容不同，且 canonical 端未變（canonical hash == pushed hash from `sibling_hashes`）。
- `Deleted`：`sibling_hashes` 中有記錄、agent 端刪除了。
- `Conflict`：兩端都有修改（canonical hash ≠ pushed hash，且 agent hash ≠ pushed hash）。

判定邏輯依賴 `sibling_hashes: Option<BTreeMap>`。當 `sibling_hashes` 為 `None`（legacy meta），`sibling_changes` 為空——pull 行為與現行 SKILL.md-only 一致。當為 `Some(map)` 時，使用 `compute_sibling_hashes` 分別算 canonical 端和 agent 端的當前 hash，再與 `map` 中記錄的 pushed hash 三方比對。

### **Pull 執行策略**

對每種 sibling status 的預設行為：
- `Added`：從 agent 端複製到 canonical。
- `Modified`：從 agent 端覆蓋 canonical。
- `Deleted`：從 canonical 刪除。
- `Conflict`：不自動處理，前端顯示衝突，使用者選擇「以 agent 端為準」或「以 canonical 端為準」或「跳過」。

### **PullConfirmDialog 擴展**

在現有的 SKILL.md diff 預覽下方，新增 sibling 變動區塊，列出每個 sibling 的路徑和狀態（icon + 文字）。衝突項目提供選擇 dropdown。

## Implementation Contract

- **Behavior**：使用者在 TargetEditor 點擊 Pull 後，preview 除了 SKILL.md diff 外，也列出 sibling 的新增/修改/刪除/衝突。確認 pull 後，sibling 按策略同步回 canonical 目錄，sync meta 更新。
- **Interface / data shape**：
  - `PullDiffPreview` struct 新增 `sibling_changes: Vec<SiblingChange>`。
  - `skill_pull_from_target()` 新增 `sibling_resolutions: Vec<SiblingResolution>` 參數，指定衝突項目的解決策略。
  - Pull 成功後更新 `lastSync.siblingHashes` 為 `Some(compute_sibling_hashes(canonical_skill_dir))`，反映 pull 後的 canonical 狀態。
  - 前端 `PullDiffPreview` type 對應擴展（在 `src/lib/types/skills.ts`）。
- **Failure modes**：
  - 複製 sibling 到 canonical 失敗（權限） → 回傳錯誤，不影響 SKILL.md 的 pull。
  - `sibling_hashes` 為 `None`（legacy meta） → `sibling_changes` 為空，pull 行為與現行一致。
  - `sibling_hashes` 為 `Some({})`（push 時無 sibling） → 如果 agent 端有 sibling，全部視為 `Added`。
- **Acceptance criteria**：
  - `cargo test`：pull preview 包含 sibling changes。
  - `cargo test`：pull 執行後 canonical 目錄包含 agent 端新增的 sibling。
  - `npm run check` 通過。
  - `npm run tauri dev` 手動驗證 PullConfirmDialog 顯示 sibling 差異。
- **Scope boundaries**：
  - In scope：pull preview 擴展、pull 執行擴展、PullConfirmDialog 擴展、衝突策略。
  - Out of scope：sibling diff viewer、push 孤兒清除、自動 merge。

## Risks / Trade-offs

- **[Risk] Pull sibling 可能覆蓋使用者在 canonical 端的手動修改** → Mitigation：衝突偵測（Conflict status）確保兩端都有修改時不靜默覆蓋。
- **[Risk] 大型二進位 sibling（如圖片）的複製效能** → Mitigation：skill sibling 通常是小型文字檔，不預期有大檔案。
