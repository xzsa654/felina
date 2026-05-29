## 1. 準備與基線

- [x] 1.1 執行 `cargo check` 和 `npm run check` 紀錄現有錯誤作為基準。
- [x] 1.2 在 `src-tauri/Cargo.toml` 新增 `similar = "2"` 依賴。驗證：`cargo check` 成功。

## 2. 後端 Diff Preview IPC

- [x] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs` 定義 Diff data 結構（`PullDiffPreview`、`DiffHunk`、`DiffLine` structs，含 Serialize），並實作 `skill_pull_preview(canonical_id, target_key) -> Result<PullDiffPreview, String>`。使用 Diff 演算法（`similar::TextDiff` 行級文字 diff），讀取 base（透過 `snapshot::get_snapshot_content`）、canonical body、target body 產生 unified diff hunks。實作 Pull 流程兩步中的第一步（preview）。`base_snapshot` 為 None 時退化為 two-way diff（base_snapshot 為 None 的退化）。對應 Pull Diff Preview requirement。驗證：撰寫單元測試，確認 three-way 和 two-way 場景皆回傳正確 hunks。
- [x] 2.2 在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊 `skill_pull_preview`。驗證：`cargo check` 通過。
- [x] 2.3 在 `src/lib/tauri/commands.ts` 新增 `skillPullPreview` invoke wrapper，定義對應 TypeScript types（`PullDiffPreview`、`DiffHunk`、`DiffLine`）。驗證：`npm run check` 通過。

## 3. 前端 Diff Viewer

- [x] 3.1 修改 `src/lib/components/skills/PullConfirmDialog.tsx`：實作前端渲染 inline unified diff，接收 `PullDiffPreview` data prop，渲染刪除行（`bg-danger-dim` + `-` 前綴）、新增行（`bg-success-dim` + `+` 前綴）、上下文行（無背景）。`has_base` 為 false 時頂部顯示提示。內容相同時顯示「內容相同」訊息。Dialog 寬度改為 `max-w-2xl`，diff 區域 `max-h-[60vh]` 可捲動。對應 Pull Confirmation with Diff Display requirement。驗證：`npm run check` 通過。
- [x] 3.2 修改 `src/lib/components/skills/TargetEditor.tsx`：pull 按鈕觸發流程從直接開 confirm dialog 改為先呼叫 `skillPullPreview`，成功後將 diff data 傳入 `PullConfirmDialog`；失敗時 toast 顯示錯誤。對應 Pull from Drifted Target modified scenario。驗證：`npm run check` 通過。
- [x] [P] 3.3 在 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts` 新增 diff preview 相關 i18n keys（`skills.pull.diffTitle`、`skills.pull.noBase`、`skills.pull.identical`）。驗證：`npm run check` 通過。

## 4. 驗證與封裝

- [x] 4.1 執行 `cargo test --lib` 確認無 regression。
- [x] 4.2 執行 `npm run check` 確認無 TypeScript 錯誤。
- [x] 4.3 手動驗證：`npm run tauri dev`，修改 target 端 SKILL.md 後點 Pull 按鈕，確認 diff dialog 正確顯示差異，確認後 canonical 被覆蓋。
