<!--
Each task description MUST state:
- the behavior or contract being delivered (what is observably true when the
  task is complete), and
- the verification target that proves completion (test, CLI invocation,
  analyzer check, manual assertion, or content review).

File paths are supporting context for locating the work, never the task
itself. "Edit file X" is not a valid task — it is missing both behavior and
verification.
-->

## 1. 準備階段 (Preparation)

- [x] 1.1 執行 `npm run check` 並記錄現有 TypeScript errors / warnings，建立開發基準，驗證時以此對比確保未引入新錯誤。

## 2. 後端實作 (Backend)

- [x] 2.1 在 `src-tauri/src/commands/canonical_skills.rs` 修改 `TargetMode` enum，新增 `Auto` variant，並設定 serde：`Manual` 序列化為 `"manual"`、`Auto` 序列化為 `"auto"`、反序列化時 `"tracked"` alias 為 `Manual`。驗證：`cargo test` 涵蓋 `"tracked"` JSON 反序列化為 `Manual`、`"auto"` 反序列化為 `Auto`、`Manual` 序列化為 `"manual"` (Requirement: Sidecar Backward Compatibility)。

- [x] 2.2 在 `src-tauri/src/commands/fan_out/mod.rs` 實作 `auto_push_if_needed(canonical_id: &str)` helper，讀取 sidecar targets，過濾 `enabled=true && mode=Auto`，對每個符合條件的 target 執行 render + write + sidecar update。回傳 `Vec<SyncResult>`。驗證：`cargo test` 涵蓋 auto target 被推送、manual target 不被推送、無 auto target 時回傳空 Vec (Requirement: Fan-Out Sync — Auto push after canonical save)。

- [x] 2.3 在 `canonical_skills_write`、`canonical_skills_write_raw`、`skill_pull_from_target` 三個 command 成功後呼叫 `auto_push_if_needed`。Auto push 失敗不 block 原操作，錯誤資訊附在回傳結果中。驗證：`cargo test` 確認 save 成功 + auto push 失敗時 save 不被 rollback (Requirement: Fan-Out Sync — Auto push after canonical save, Auto push after pull)。

## 3. 前端實作 (Frontend)

- [x] [P] 3.1 在 `src/lib/types/skills.ts` 修改 `TargetMode` type，新增 `"auto"` 和 `"manual"` 值，保留 `"tracked"` 作為相容讀取值。驗證：`npm run check` 無型別錯誤。

- [x] [P] 3.2 在 `src/lib/components/skills/TargetEditor.tsx` 修改 `UIState` 為 `"auto" | "manual" | "disabled"`，更新 `toUIState`、`applyUIState`、`STATE_KEYS`、`STATES`。Toggle 按鈕組從 2 個變 3 個。驗證：`npm run check` 無錯誤 (Requirement: Skill Target Configuration — Target mode includes auto option)。

- [x] [P] 3.3 新增 i18n keys：`skills.targets.auto`、`skills.targets.autoTitle`、`skills.targets.manual`、`skills.targets.manualTitle`，分別在 `en.ts` 與 `zh-TW.ts`。原有的 `skills.targets.tracked` 和 `skills.targets.trackedTitle` 改為指向 manual 的顯示文字。驗證：`npm run check` 無錯誤。

## 4. 驗證與測試 (Verification)

- [x] 4.1 執行 `npm run tauri dev` 啟動應用，手動確認：(a) TargetEditor 顯示 Auto / Manual / Disabled 三個按鈕；(b) 切換 target 到 Auto 後，在 editor 修改 skill 並 save，target 端檔案自動更新且 dirty badge 消失；(c) Manual target 不受 auto push 影響，save 後仍顯示 dirty。驗證：手動測試所有場景通過。
