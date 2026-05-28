## Context

Felina 的 drift detection（`drift-detection-and-conflict-ui` change 完成）已能偵測 agent target 端的 skill 檔案是否與 canonical 不一致。目前 push 是唯一的同步方向（canonical → target），缺少反向操作。使用者在 agent 端直接修改 skill 後，想將改動拉回 canonical 只能走 Import 流程（多步驟、需選擇來源）。

現有基礎：
- `check_drift()` in `src-tauri/src/commands/fan_out/mod.rs` 已能讀取 target 端檔案、計算 hash 並比對
- `skill_drift_scan` IPC command 回傳每個 skill 的每個 target 的 `DriftStatus`
- 前端 `skills-store.ts` 已有 `driftMap: Record<string, Record<string, DriftStatus>>`
- `TargetEditor.tsx` 已有 per-target drift badge（⚠ Drifted）

## Goals / Non-Goals

**Goals:**

- 提供一次性 Pull 操作：從指定的 drifted target 讀取內容，覆寫 canonical SKILL.md
- 在 SkillList 顯示 skill 層級的 drift indicator
- Pull 完成後同步更新 sidecar metadata（pushed_hash + lastSync.at），使 drift 狀態歸零

**Non-Goals:**

- Diff preview（未來增強，本次直接覆寫）
- 多 target merge（使用者選擇單一 target pull）
- Detached / forked mode 實作
- 改變 push 方向邏輯

## Decisions

### 後端：新增 `skill_pull_from_target` command

在 `fan_out/mod.rs` 新增函式，接收 `canonical_id: String` 和 `target_key: String`：
1. 解析 target_key 取得 agent、scope、project path
2. 透過 `agent_paths` 解析 target 端 skill 檔案的絕對路徑
3. 讀取 target 端檔案內容（`fs::read_to_string`）
4. 覆寫 canonical SKILL.md（`~/.felina/skills/<canonical_id>/SKILL.md`）
5. 計算新的 `semantic_hash` 並更新 sidecar 的 `lastSync[target_key].pushed_hash` 與 `.at`
6. 清除 dirty flag（pull 後 canonical 與 target 一致）
7. 回傳成功或錯誤

選擇在現有 `fan_out/mod.rs` 擴充而非新增模組，因為 pull 是 push 的逆操作，共用 target path resolution 與 sidecar 讀寫邏輯。

### 前端：SkillList drift indicator

從 `skills-store` 的 `driftMap` 判斷每個 skill 是否有任何 target 處於 `Drifted` 狀態。若有，在 SkillList entry 旁顯示 ⚠ icon（`text-warning`）。不顯示哪些 target drifted — 細節留給 TargetEditor。

### 前端：TargetEditor Pull 按鈕

在 `TargetEditor.tsx` 已有的 drift badge 旁新增「Pull」按鈕，僅在該 target 為 `Drifted` 時啟用。點擊後跳出確認 dialog（`PullConfirmDialog.tsx`），警告此操作會覆寫 canonical。確認後呼叫後端 `skill_pull_from_target`，完成後刷新 entries + drift scan。

### Sidecar 更新策略

Pull 完成後，被 pull 的 target 的 sidecar entry 更新為新 hash + 當前時間。其他 target 的 sidecar 不動 — 它們的 drift 狀態可能與 pull 前不同（canonical 改了），下次 drift scan 會自然反映。

## Implementation Contract

**Backend IPC command:**
- Command name: `skill_pull_from_target`
- Parameters: `canonical_id: String`, `target_key: String`
- Return: `Result<(), String>`
- Behavior: 讀取 target 端 skill 檔案 → 覆寫 canonical SKILL.md → 更新 sidecar pushed_hash + at + dirty=false
- Failure modes:
  - Target 檔案不存在 → 回傳錯誤訊息含路徑
  - Canonical 目錄不存在 → 回傳錯誤
  - 讀寫權限不足 → 回傳 OS 層錯誤
- Acceptance: `cargo test` 涵蓋 happy path + target missing + canonical missing

**Frontend — SkillList indicator:**
- 每個 entry 右側顯示 ⚠ icon，條件：`driftMap[canonicalId]` 中任一 target 為 `Drifted`
- 不顯示 → 無 drifted target
- Acceptance: `npm run check` clean；手動確認有 drifted target 時 icon 出現

**Frontend — Pull 按鈕:**
- 位置：TargetEditor 每個 target row，drift badge 旁
- 顯示條件：該 target 的 DriftStatus 為 `Drifted`
- 點擊 → PullConfirmDialog（確認覆寫 canonical）
- 確認後呼叫 `api.skillPull.fromTarget(canonicalId, targetKey)` → 成功後 `loadEntries()` + `refreshDriftScan()`
- Acceptance: `npm run check` clean；手動確認 pull 後 canonical 內容更新、drift badge 消失

**i18n keys:**
- `skills.pull.button` — Pull 按鈕文字
- `skills.pull.confirmTitle` — 確認 dialog 標題
- `skills.pull.confirmMessage` — 確認 dialog 訊息（含 canonical 會被覆寫的警告）
- `skills.pull.success` — 成功提示
- `skills.pull.failed` — 失敗提示
- `skills.list.drifted` — SkillList drift indicator tooltip

## Risks / Trade-offs

- **[覆寫風險]** Pull 直接覆寫 canonical，沒有 undo。→ 緩解：PullConfirmDialog 明確警告；未來 `local-versioning-and-snapshot-layer` 上線後可提供 rollback。
- **[多 target 不一致]** Pull 後其他 target 可能變成 drifted（因為 canonical 改了但那些 target 沒更新）。→ 接受：這是正確行為，使用者可再 push 同步。
- **[安全敏感]** 讀寫使用者檔案系統（canonical + target paths）。→ 路徑解析沿用現有 `agent_paths` + `canonical_skills` 邏輯，不引入新的 path construction。
