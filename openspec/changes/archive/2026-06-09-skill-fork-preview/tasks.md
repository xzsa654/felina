## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings 數量作為 baseline，驗證：記錄 baseline 數字供後續比對

## 2. 後端：Fork Mode Activation 與 base_snapshot

- [x] 2.1 實作 Fork 切換寫入 base_snapshot（Fork Mode Activation）：在 `src-tauri/src/commands/canonical_skills.rs` 的 `skill_targets_set` 中，當 target mode 從 Auto/Manual 切換為 Forked 時，計算當下 canonical SKILL.md 的 SHA-256 並寫入 `last_sync[target_key].base_snapshot`；若該 target 無 last_sync entry 則建立（pushed_hash = canonical hash, at = 當下時間）。驗證：`cargo test --lib` 新增測試 `fork_activation_records_base_snapshot` 與 `fork_activation_creates_last_sync_entry` 通過
- [x] [P] 2.2 新增 skill_fork_read_agent_content command（Fork Agent Content Reading）：在 `src-tauri/src/commands/fan_out/mod.rs` 實作，接受 canonical_id 與 target_key，回傳 `ForkAgentContent { body, raw }`。target 非 Forked 時回傳 error，agent-side 檔案不存在時回傳 error。在 `src-tauri/src/commands/mod.rs` 與 `src-tauri/src/lib.rs` 的 invoke_handler 註冊。驗證：`cargo test --lib` 新增測試 `fork_read_agent_content_success`、`fork_read_rejects_non_forked`、`fork_read_missing_file` 通過
- [x] [P] 2.3 新增 skill_fork_diff_preview command（Fork Diff Preview + Fork Status Classification）：在 `src-tauri/src/commands/fan_out/mod.rs` 實作，回傳 `ForkDiffPreview { canonical_body, forked_body, base_body, has_base, hunks, fork_status }`。fork_status 為 ForkStatus enum（clean/edited/canonicalAhead/diverged），依據 canonical hash vs base_snapshot 及 forked hash vs pushed_hash 判定。base_snapshot 缺失時 has_base=false 並降級為 two-way diff，fork_status 預設為 edited。在 invoke_handler 註冊。驗證：`cargo test --lib` 新增測試覆蓋四種 fork status 與 missing base_snapshot fallback
- [x] [P] 2.4 確認 Forked Target Push Exclusion：現有 push 邏輯已跳過 Forked mode，新增 `cargo test --lib` 測試 `push_skips_forked_target` 明確驗證此行為。驗證：測試通過

## 3. 前端：型別與 invoke wrappers

- [x] 3.1 在 `src/lib/types.ts` 或 `src/lib/types/skills.ts` 新增 `ForkAgentContent`、`ForkDiffPreview`、`ForkStatus` 型別定義，UIState 型別擴充 forked。在 `src/lib/tauri/commands.ts` 新增 `skillFork.readAgentContent` 與 `skillFork.diffPreview` invoke wrappers。驗證：`npm run check` 通過，無新增 type errors

## 4. 前端：Target chip Fork Status Chip Display、Unfork Confirmation、Sync Info Status Grouping

- [x] [P] 4.1 實作 Fork Status Chip Display 與 Target chip fork 狀態擴充：在 `src/lib/components/skills/sync-status-utils.ts` 擴充 SyncStatus 新增 forked-clean / forked-edited / forked-ahead / forked-diverged 四種狀態，擴充 STATUS_CONFIG 使用語意色（info/warning），擴充 classifyTarget 在 mode===forked 時 early return 對應狀態。同時滿足 Sync Info Status Grouping 對 forked chip 的呈現需求。isTargetDisabled 不納入 forked（Forked 是 enabled 狀態）。驗證：`npm run check` 通過；新增 `tests/sync-status-utils.test.ts` 測試 forked 狀態分類邏輯
- [x] [P] 4.2 實作前端 mode selector 加入 Forked 選項與 Unfork Confirmation：在 `src/lib/components/skills/TargetPopover.tsx` 的 mode selector 加入 Forked 選項。toUIState/applyUIState 處理 forked。從 Forked 切回 Auto/Manual 時顯示 confirmation dialog 警告下次 push 會覆寫 agent-side 修改，取消則維持 Forked。驗證：`npm run check` 通過

## 5. 前端：ForkPreviewDialog modal 設計（Fork Preview Dialog）

- [x] 5.1 實作 ForkPreviewDialog modal 設計：新增 `src/lib/components/skills/ForkPreviewDialog.tsx`，使用現有 Modal 元件（size lg）。Header 顯示 skill name、target key、fork status badge。Tab bar 含 Preview（MarkdownPreview 渲染 forked body）、Raw（monospace 顯示完整 agent-side 內容）、Diff（unified diff hunks，複用 PullConfirmDialog 的 hunk 渲染樣式）。無 base_snapshot 時 Diff tab 顯示提示 banner。Footer 僅 Close 按鈕。驗證：`npm run check` 通過
- [x] 5.2 實作 Preview Fork 按鈕入口：在 TargetPopover 中，當 target.mode === forked 時在 status 區塊顯示 Preview Fork 按鈕（與現有 Pull 按鈕同級）。點擊後呼叫 `skillFork.diffPreview` 取得資料並開啟 ForkPreviewDialog。驗證：`npm run check` 通過

## 6. i18n

- [x] [P] 6.1 新增 i18n keys：在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 新增 skills.fork.* 與 skills.targets.forked 等 i18n keys（previewButton、dialogTitle、tabPreview、tabRaw、tabDiff、noBase、statusClean、statusEdited、statusAhead、statusDiverged、unforkConfirmTitle、unforkConfirmBody）。驗證：`npm run check` 通過（TypeScript TranslationDict 型別對齊，缺 key 會 compile error）

## 7. Drift Scan 整合

- [x] 7.1 在後端 drift scan 邏輯中（Batch Drift Scan API），Forked target 改為回傳 fork_status 分類而非視為「無 drift」。Forked target 不觸發 pull-back suggestion。驗證：`cargo test --lib` 新增測試 `drift_scan_classifies_forked_target` 通過

## 8. 驗證

- [x] 8.1 `cargo build` 在 `src-tauri/` 通過。驗證：build 無 error
- [x] 8.2 `npm run check` 通過，與 baseline 比較無新增 errors。驗證：error count <= baseline
- [x] 8.3 `npm run tauri dev` 手動驗證：(a) 建立 skill + project target，切換 mode 為 Forked，確認 chip 顯示 fork icon + info 色；(b) 在 agent-side 修改 SKILL.md，重新開啟 app 確認 chip 變為 forked-edited；(c) 點擊 Preview Fork 按鈕，確認 ForkPreviewDialog 開啟，三個 tab 正常顯示；(d) 修改 canonical 後確認 chip 變為 forked-diverged；(e) 從 Forked 切回 Auto，確認出現 confirmation dialog，取消後維持 Forked。驗證：五項行為全部通過
- [x] 8.4 執行 `/felina-ui-guidelines` 評估本 change 的 UI 改動，輸出命中的 guideline 與 deviation 清單。驗證：評估完成，結論記錄於 archive notes
- [x] 8.5 執行 `/spectra-audit` 審查本 change 的安全面向（agent-side 檔案讀取路徑安全性）。驗證：無 critical finding
