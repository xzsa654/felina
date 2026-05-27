## 1. Baseline 與 contract types

- [x] 1.1 跑 baseline `npm run check` 並記錄現有 TypeScript 狀態，確認後續驗證可區分本 change 新增錯誤；驗證方式：保存命令輸出重點到 apply 記錄並在最終驗證重跑同一命令比較。
- [x] 1.2 實作前後端共享的 preview / drift / delete policy / target removal policy 資料契約（addresses Decision: Push preview command returns a non-mutating write plan），讓 `src/lib/types/skills.ts`、`src/lib/tauri/commands.ts` 與 Rust serde structs 對齊；驗證方式：`npm run check` 能通過 type checking，Rust command tests 能 compile。

## 2. Backend preview 與 drift commit

- [x] 2.1 實作 `skill_sync_preview` 與 `skill_sync_all_preview` 的 **Push Preview and Drift Guard** non-mutating plan（addresses Decision: Push preview command returns a non-mutating write plan），回傳 create / overwrite / no-op / skipped / blocked-drift / overwrite-unknown 與 path summary，且不建立、寫入、刪除任何檔案；驗證方式：Rust tests 以 temp skill/target fixture 檢查 preview 後 filesystem 與 sync-meta 未改變。
- [x] 2.2 實作 `skill_sync_commit` 與 `skill_sync_all_commit` 的 **Push Preview and Drift Guard** drift resolution（addresses Decision: Drift resolution is explicit per target before writes），commit 前重新計算 preview，未決議 drift 或 overwrite-unknown 時拒絕寫入，override 會寫入並更新 `last_sync`，detach 只更新 target mode；驗證方式：Rust tests 覆蓋 blocked、override、detach、stale preview recompute 四種結果。
- [x] 2.3 更新 Tauri command registration，讓 preview/commit commands 由 `src-tauri/src/commands/mod.rs` 與 `src-tauri/src/lib.rs` 對前端可呼叫；驗證方式：`cargo test` 或 `cargo build` 在 `src-tauri/` 不出現 missing invoke handler / unresolved symbol。

## 3. Backend delete 與 target removal

- [x] 3.1 實作 **Explicit Canonical Delete Policy** backend 行為（addresses Decision: Destructive skill delete uses Cascade Detach Cancel policy），`cascade` 只刪 current target list 解析出的 agent-side skill directory 並回報 deleted/failed paths，`detach` 只刪 canonical directory，`cancel` 不改檔案；驗證方式：Rust filesystem tests 檢查三種 policy 的 canonical 與 agent-side 檔案結果。
- [x] 3.2 實作 **Explicit Target Removal Policy** backend 行為（addresses Decision: Target removal uses the same detach versus delete semantics），Remove target only 只移除 target row 並 prune 舊 `last_sync`，Remove target and delete file 只在刪除該 target directory 成功後移除 row，Cancel 不改 sync-meta；驗證方式：Rust tests 檢查 retained target、removed target、deleted path、failure keeps target row。
- [x] 3.3 實作 **Missing Project Target Repoint** backend/target-set 行為（addresses Decision: Missing project target repoint updates only project path and target key），repoint 只改 project path、保留 agent/scope/enabled/mode、prune 舊 target key、mark dirty、不刪 old path；驗證方式：Rust tests 或 command-level tests 檢查 sync-meta target、last_sync、dirty flag 與 old path 檔案狀態。

## 4. Frontend flows

- [x] 4.1 更新 `PendingPushBar.tsx` 與 per-skill push UI 使用 preview-first 流程呈現 **Push Preview and Drift Guard**（addresses Decision: UI consistency and component reuse），使用 `ConfirmDialog` 或同風格 modal 收集 override / detach / cancel 決策，不使用 `window.confirm`；驗證方式：`npm run check` 通過且手動 smoke 可看到 preview 在寫檔前出現。
- [x] 4.2 更新 `SkillsPage.tsx` delete flow 呈現 **Explicit Canonical Delete Policy** Cascade / Detach / Cancel（addresses Decision: UI consistency and component reuse），確認畫面列出會影響的 target count/path summary 並呼叫 policy-aware command；驗證方式：手動 smoke 檢查三種選項對 canonical 與 agent-side 檔案結果符合 spec。
- [x] 4.3 更新 `TargetEditor.tsx` row removal flow 呈現 **Explicit Target Removal Policy**，Remove target only / Remove target and delete file / Cancel 都走明確 command result，失敗時保留 row 並顯示錯誤；驗證方式：手動 smoke 檢查只刪指定 target directory，不影響其他 agent target。
- [x] 4.4 更新 `TargetEditor.tsx` missing project row 的 **Missing Project Target Repoint** action（addresses Decision: Missing project target repoint updates only project path and target key），使用現有 path helper/選路徑流程更新 project path 且不做 ad hoc lowercase；驗證方式：手動 smoke 檢查 project-not-found target 可 repoint、dirty indicator 出現、old path 未被刪除。
- [x] 4.5 補齊 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 的 skills namespace 文案（addresses Decision: UI consistency and component reuse），不翻譯 path、skill name、agent id、timestamp、backend error；驗證方式：`npm run check` 透過 TranslationDict 確認 en/zh-TW key 結構一致。

## 5. Verification 與 audit

- [x] 5.1 跑 relevant Rust tests 與 `cargo build` in `src-tauri/`，確認新增/修改 Rust commands、serde types、filesystem safety behavior 可編譯且測試通過；驗證方式：命令退出碼為 0，若有既有失敗需列出與 baseline 差異。
- [x] 5.2 跑 final `npm run check`，確認前端 wrappers、React UI、i18n types 無 TypeScript 錯誤；驗證方式：命令退出碼為 0，若有既有錯誤需與 1.1 baseline 對照。
- [x] 5.3 跑 `npm run tauri dev` 手動驗證 push preview non-mutating、drift override/detach/cancel、canonical delete Cascade/Detach/Cancel、target removal keep/delete/cancel、missing project repoint 五條流程；驗證方式：記錄每條流程的 observable file result 與 UI result。
- [x] 5.4 跑 `/spectra-audit skill-target-lifecycle-safety` 審查 filesystem write/delete、path resolution、drift override、cascade delete 與 target removal 的安全邊界；驗證方式：audit 無 Critical/Warning 未處理項，或在 change 中補修並重跑相關驗證。

## 6. Smoke feedback 調整

- [x] 6.1 調整 **Push Preview and Drift Guard** UI 文案，讓主要摘要以「需要注意的 target 數量、檔案確認前不會變更」呈現，operation counts 改為次要 detail，並在 Detach / Cancel 決策旁明確說明 Detach 會把 target mode 改為 `detached`、Cancel 不改 target 設定；驗證方式：`npm run check` 通過，且手動 smoke 看到 drift preview 不再只顯示 `Create 0, overwrite 0, no-op 0, drift 1, unknown 0` 這種工程化主文案。
- [x] 6.2 調整 **Explicit Canonical Delete Policy** backend 與 UI，讓 Cascade delete 只計入並刪除 `enabled + tracked` target，disabled / detached / forked target 不被刪除也不列入 Cascade delete count，保留單一 target removal 的 Remove target and delete file 明確刪檔語意；驗證方式：Rust filesystem test 覆蓋 enabled tracked 被刪、disabled/detached 保留，`npm run check` 通過，手動 smoke 檢查 delete dialog 的 target count/path summary 符合實際刪除範圍。
- [x] 6.3 優化 **Explicit Canonical Delete Policy** delete dialog 操作，當 `enabled + tracked` target count 為 0 時將 Cascade button 反灰不可按，讓使用者只能選 Detach 或 Cancel；驗證方式：`npm run check` 通過，手動 smoke 檢查 0 個 eligible target 的刪除對話框中 Cascade 無法點擊。
