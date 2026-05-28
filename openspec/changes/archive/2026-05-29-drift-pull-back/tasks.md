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

- [x] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs` 實作 `skill_pull_from_target` 函式，接收 `canonical_id` 與 `target_key`，讀取 target 端 skill 檔案內容並覆寫 canonical SKILL.md，更新 sidecar 的 `pushed_hash`（semantic_hash）、`lastSync.at`（當前時間戳）與 `dirty=false`。驗證：`cargo test` 涵蓋 happy path（內容覆寫正確 + sidecar 更新）、target 檔案不存在時回傳錯誤、canonical 目錄不存在時回傳錯誤 (Requirement: Pull from Drifted Target)。

- [x] 2.2 將 `skill_pull_from_target` 註冊為 Tauri IPC command：在 `src-tauri/src/commands/mod.rs` 匯出函式，在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 加入。驗證：`cargo build` 成功，command 可透過 invoke 呼叫 (Requirement: Pull from Drifted Target)。

- [x] [P] 2.3 在 `src/lib/tauri/commands.ts` 新增 `api.skillPull.fromTarget(canonicalId, targetKey)` wrapper，對應後端 `skill_pull_from_target`。驗證：`npm run check` 無型別錯誤 (Requirement: Pull from Drifted Target)。

## 3. 前端實作 (Frontend)

- [x] [P] 3.1 修改 `src/lib/components/skills/SkillList.tsx`，在每個 entry 右側根據 `driftMap` 判斷是否有任一 target 為 `Drifted`，若有則顯示 ⚠ icon（Lucide `AlertTriangle`，`text-warning`），附帶 tooltip 顯示 `skills.list.drifted` i18n key。驗證：`npm run check` 無錯誤 (Requirement: SkillList Drift Indicator)。

- [x] 3.2 新增 `src/lib/components/skills/PullConfirmDialog.tsx` 確認 dialog 元件，接收 `open`、`skillName`、`targetKey`、`busy`、`onConfirm`、`onCancel` props，顯示覆寫 canonical 的警告訊息。驗證：`npm run check` 無型別錯誤 (Requirement: Pull Confirmation)。

- [x] 3.3 修改 `src/lib/components/skills/TargetEditor.tsx`，在已有 drift badge 旁新增「Pull」按鈕，僅在該 target DriftStatus 為 `Drifted` 時顯示。點擊後開啟 PullConfirmDialog，確認後呼叫 `api.skillPull.fromTarget`，成功後呼叫 `loadEntries()` + `refreshDriftScan()`。驗證：`npm run check` 無錯誤，事件綁定正確 (Requirement: Pull Button in TargetEditor, Pull Confirmation)。

- [x] [P] 3.4 新增 i18n keys：`skills.pull.button`、`skills.pull.confirmTitle`、`skills.pull.confirmMessage`、`skills.pull.success`、`skills.pull.failed`、`skills.list.drifted`，分別在 `en.ts` 與 `zh-TW.ts`。驗證：`npm run check` 無錯誤（TranslationDict 型別會強制雙語對齊）。

## 4. 驗證與測試 (Verification)

- [x] 4.1 執行 `npm run tauri dev` 啟動應用，手動確認：(a) SkillList 有 drifted target 的 skill 顯示 ⚠ icon；(b) TargetEditor drift badge 旁出現 Pull 按鈕；(c) 點擊 Pull 後確認 dialog 正確顯示；(d) 確認後 canonical 內容更新、drift badge 消失。驗證：手動測試所有場景通過。
