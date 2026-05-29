## Context

目前 `check_drift()` 僅對 agent 端的 SKILL.md 做 semantic hash 比對，而 `copy_bundled_siblings()` 在 push 時會遞迴複製 canonical 目錄下除 SKILL.md 和 `.felina-sync-meta.json` 以外的所有檔案。然而 sync meta 的 `last_sync` 只記錄 `pushed_hash`（單一 SKILL.md hash），不追蹤 sibling 檔案狀態。agent 端的 sibling 被修改、新增或刪除時，drift scan 無法偵測。

## Goals / Non-Goals

**Goals:**
- Drift 偵測涵蓋 bundled sibling 檔案（script、templates、references 等）。
- Push 時自動記錄所有 sibling 的 hash 到 sync meta。
- 前端 drift badge 能區分 SKILL.md drift 和 sibling drift。
- 與既有 sync meta（無 sibling hash map）向後相容。

**Non-Goals:**
- 不改變 pull 行為（sibling pull-back 由 `sibling-pull-sync` 負責）。
- 不清除 agent 端的孤兒 sibling（由 `sibling-push-cleanup` 負責）。
- 不對 sibling 做 semantic hash 正規化（sibling 格式不固定，用 raw SHA-256）。
- 不新增 UI 讓使用者逐檔檢視 sibling 差異。

## Decisions

### **Sync meta 擴展 sibling hash map**

在 `.felina-sync-meta.json` 的每個 target 的 `last_sync` 物件中新增 `sibling_hashes` 欄位：

```json
{
  "last_sync": {
    "pushed_hash": "abc123...",
    "at": "2026-05-29T10:00:00Z",
    "sibling_hashes": {
      "script/run.py": "def456...",
      "templates/prompt.txt": "789abc..."
    }
  }
}
```

- Key 是相對於 skill 目錄的正斜線路徑（跨平台一致）。
- Value 是檔案內容的 raw SHA-256 hex string。
- 既有 meta 缺少 `sibling_hashes` 時，反序列化為空 map（`#[serde(default)]`），不報錯。

替代方案：獨立的 sibling manifest 檔案 → 拒絕，因為增加一個額外檔案的管理成本且 sync meta 已是 per-target 狀態的集中點。

### **check_drift 擴展為目錄級別**

`check_drift()` 現有流程（mtime fast-path → semantic hash 比對）不變，新增第二階段：

1. 讀取 agent 端 skill 目錄下所有非 SKILL.md、非 sidecar 檔案，計算每個檔案的 raw SHA-256。
2. 與 `sibling_hashes` 比對：新增 / 刪除 / 內容變動皆視為 drifted。
3. 若 SKILL.md 為 synced 但 sibling 有差異，整體狀態仍為 drifted。

mtime fast-path：sibling 不套用 mtime 優化（sibling 數量通常少，且目錄 mtime 不可靠），直接 hash 比對。

替代方案：目錄級 mtime 判斷 → 拒絕，因為不同 OS 對目錄 mtime 語意不一致。

### **DriftStatus 維持不變**

`DriftStatus` enum（synced / drifted / missing）不新增 variant。Sibling drift 合併進 `drifted` — 前端不需要區分 SKILL.md drift 和 sibling drift 來決定 badge 狀態。若未來需要細分，可在回傳結構中附加 detail 欄位，但本 change 不做。

### **Push 流程寫入 sibling hashes**

在 `skill_sync_one()` 中，`copy_bundled_siblings()` 完成後，遍歷已複製的 sibling 檔案計算 hash map，寫入 sync meta 的 `sibling_hashes`。這確保 push 後的 drift scan 有正確的 baseline。

### **sibling_hashes 使用 Option\<BTreeMap\> 區分 legacy 與空 map**

`LastSyncEntry.sibling_hashes` 型別為 `Option<BTreeMap<String, String>>`：
- `None` = legacy meta（欄位不存在）→ 跳過 sibling 比對，避免舊 push 的 skill 誤報。
- `Some({})` = push 時確實沒有 sibling → agent 端新增檔案應偵測為 drift。
- `Some({...})` = push 時有 sibling → 正常比對。

序列化使用 `#[serde(default, skip_serializing_if = "Option::is_none")]`，legacy meta 反序列化為 `None`，新 push 寫入 `Some(map)`。

替代方案：用 `#[serde(default)]` + 空 BTreeMap → 拒絕，因為無法區分 legacy 與「push 時無 sibling」，導致 agent 端新增檔案無法偵測。

### **Canonical 端 sibling 變動偵測**

`canonical_skills_list` 在載入 skill list 時，計算 canonical 目錄的 sibling hashes 並與 `lastSync` 中每個 target 的 `siblingHashes` 比較。若任一 target 的記錄與 canonical 不同，設 `dirty = true` 和 `siblings_dirty = true`。這讓 push badge 在使用者外部新增/修改/刪除 canonical sibling 時自動出現。

### **Push preview 考慮 sibling 變動**

`build_preview_for_skill` 在決定 operation 時，除了比較 SKILL.md hash，也比較 canonical sibling hashes 與 `lastSync.siblingHashes`。SKILL.md 沒變但 sibling 有差異時，operation 改為 Overwrite（而非 NoOp），確保 commit 時執行 `copy_bundled_siblings`。

### **SyncInfoBar siblingsDirty 提示**

`CanonicalSkill` 新增 `siblings_dirty` 欄位，前端 `SyncInfoBar` 接收 `siblingsDirty` prop，在 true 時顯示「附加檔案已變更，請推送以同步。」提示，讓使用者知道 dirty 是 sibling 觸發而非 SKILL.md 變動。

## Implementation Contract

- **Behavior**：
  - Agent 端偵測：push 任一 skill 後，`skill_drift_scan` 能偵測 agent 端 sibling 的新增、刪除或內容修改，並回傳 drifted 狀態。
  - Canonical 端偵測：`canonical_skills_list` 在載入時偵測 canonical sibling 變動，設 dirty + siblingsDirty。
  - Push preview：SKILL.md 沒變但 sibling 有差異時，operation 為 Overwrite，確保 sibling 被複製。
  - 既有無 sibling 的 skill 行為不變。
- **Interface / data shape**：
  - `LastSyncEntry.sibling_hashes: Option<BTreeMap<String, String>>`（Rust）/ `siblingHashes?: Record<string, string>`（JSON），key 為正斜線相對路徑。
  - `CanonicalSkill.siblings_dirty: bool`（Rust）/ `siblingsDirty: boolean`（TS）。
  - `check_drift()` 新增第四個參數 `sibling_hashes: &Option<BTreeMap<String, String>>`。
  - `skill_drift_scan` IPC command 回傳結構不變（`DriftStatus` enum 不變）。
- **Failure modes**：
  - agent 端 sibling 目錄不存在 → 視為所有 sibling 被刪除 → drifted。
  - 讀取 sibling 檔案失敗（權限等） → 該檔案不計入 hash map，導致 map 不匹配 → drifted。
  - 既有 sync meta 無 `sibling_hashes`（`None`）→ 跳過 sibling 比對，不誤報。
- **Acceptance criteria**：
  - 6 個 Rust 單元測試：sibling 修改/刪除/agent 新增（有記錄）/agent 新增（空 map）/有記錄+新增/legacy meta。
  - `npm run check` 通過。
  - `npm run tauri dev` 手動驗證 drift badge 和 SyncInfoBar siblingsDirty 提示。
- **Scope boundaries**：
  - In scope：agent 端 drift 偵測、canonical 端 dirty 偵測、push 時寫入 hash map、push preview sibling 比較、前端 badge + SyncInfoBar 提示。
  - Out of scope：pull sibling 回 canonical、push 時刪除孤兒 sibling、sibling 差異的逐檔 UI。

## Risks / Trade-offs

- **[Risk] Sibling 數量多時 drift scan 變慢** → Mitigation：sibling 通常少（< 10 檔），且 hash 計算在 rayon 平行執行。若未來有大量 sibling 的 skill，可加入 mtime 預篩。
- **[Risk] 既有 meta 升級時的假陽性** → Mitigation：`Option<BTreeMap>` 區分 `None`（legacy）與 `Some({})`（無 sibling），legacy 不比對。只有本次 push 後才開始追蹤。
