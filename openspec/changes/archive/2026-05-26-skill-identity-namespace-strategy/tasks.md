## 1. Baseline 與型別契約

- [x] 1.1 跑 baseline `npm run check` 並記錄現有 TypeScript 狀態，完成條件是後續驗證可區分本 change 新增錯誤與既有狀態。
- [x] 1.2 [P] 後端：移除 `ImportResolution::KeepCanonical` variant，確認 `skill_import_apply` 不再 match `KeepCanonical`（addresses **ImportResolution semantic cleanup**）；`DeferredMultiSource` 新增 `candidates: Vec<ImportCandidate>` 欄位，讓 grouped row 攜帶完整 per-source 資訊（addresses **Multi-source import unlocks with source selection**）。驗證：`cargo test commands::skill_import --lib` 通過，既有 tests 不因 variant 移除而 fail。
- [x] 1.3 [P] 前端：`src/lib/types/skills.ts` 移除 `KeepCanonical` variant、新增 `SelectSource { sourceIndex: number, newName?: string }`；`src/lib/tauri/commands.ts` wrapper 同步。驗證：`npm run check` 通過。

## 2. Backend multi-source apply 與 disabled target 建立

- [x] 2.1 新增 `ImportResolution::SelectSource { source_index: usize }` variant。`skill_import_apply` 對 deferred candidate 不再 skip：match `SelectSource` 時從 `DeferredMultiSource.candidates[source_index]` 取出選定來源，呼叫 `write_canonical_from_source` 寫入 canonical（addresses **Multi-source import unlocks with source selection**、spec requirement "Initial Skill Import"、spec scenario "Multi-source skill is importable with source selection"）。驗證：Rust test fixture 建立 2-source grouped candidate，apply SelectSource(0) 後 canonical SKILL.md 內容等於 source 0。
- [x] 2.2 SelectSource apply 後，對每個未選中的 source 建立 disabled target（`enabled: false`, `mode: tracked`），agent 與 scope 從 source 的 `source_agent` 與 scan scope 推導（addresses **Non-selected sources become disabled targets**、spec scenario "Non-selected sources become disabled targets"）。驗證：Rust test 確認 sync-meta 包含 N-1 個 disabled targets，且 `skill_prune_orphans_scan` 不把對應 agent-side file 標為 orphan。
- [x] 2.3 `group_by_name` 改為保留完整 per-source `ImportCandidate` list 在 `DeferredMultiSource.candidates`，而非只保留 representative row。驗證：Rust test 確認 3-source skill 的 deferred row 含 3 個 candidates，各自 source_agent 與 body_preview 正確。

## 3. Backend disabled target 查看內容

- [x] 3.1 新增 Tauri command `skill_target_read_content(skill_name: String, target_key: String) -> Result<String, String>`。使用 fan-out 模組的 `resolve_pair` + `agent_paths_get` 解析 target 的 agent-side skill directory，讀取 `<resolved>/<skill_name>/SKILL.md` 回傳 raw 內容（addresses **Disabled target content viewing**、spec scenario "Disabled target content is viewable in-app"）。file 不存在或 path 無法解析時回傳 error string（spec scenario "Disabled target content view handles missing file"）。驗證：Rust tests 覆蓋正常讀取與 file-not-found 兩條路徑。
- [x] 3.2 在 `src-tauri/src/commands/mod.rs` 與 `src-tauri/src/lib.rs` 註冊 `skill_target_read_content` command。驗證：`cargo build` 在 `src-tauri/` 通過，無 missing invoke handler。

## 4. Frontend import wizard multi-source UI

- [x] 4.1 `src/lib/tauri/commands.ts` 新增 `skillTargetReadContent` wrapper。驗證：`npm run check` 通過。
- [x] 4.2 Import wizard（`SkillsPage.tsx` 或相關 import UI 元件）：multi-source（deferred）row 從灰掉不可操作改為可展開的 accordion，展開後列出各 source 的 agent label + body preview，以 radio 選擇一個當 canonical（addresses **Import wizard multi-source diff preview**、spec scenario "Multi-source skill is importable with source selection"）。選定後 row 收起，顯示「以 <agent> 為來源」摘要文字。未選定時 Import 按鈕不可點。驗證：`npm run check` 通過。
- [x] 4.3 [P] i18n：`en.ts` / `zh-TW.ts` 新增 multi-source 相關 keys（accordion 展開提示、source 選擇 label、disabled target 查看按鈕 tooltip、file-not-found 訊息）。驗證：`npm run check` 通過，TranslationDict 結構對齊。
- [x] 4.4 修正 multi-source + canonical conflict 決策層：選來源後仍必須明確 Skip / OverwriteCanonical / Rename，不可直接覆蓋既有 canonical；Rename 會用 selected source 寫入新 canonical identity。驗證：`cargo test commands::skill_import --lib` 與 `npm run check` 通過。
- [x] 4.5 Multi-source canonical conflict warning：grouped import row 若 canonical 已存在，顯示與單一來源 collision 相同語意的 inline warning bar；未選 source 時提示先選來源再比較或選 Overwrite/Rename，選定或切換 source 後顯示該 source 對 canonical 的 diff summary。驗證：`npm run check` 通過，且 `npm run tauri dev` 手動確認 anthropic/codex source 切換時 warning 內容同步更新。

## 5. Frontend disabled target 查看內容

- [x] 5.1 `TargetEditor.tsx` target row 常駐 Eye icon 按鈕「查看內容」。點擊後 invoke `skillTargetReadContent`，成功時以 modal 顯示 raw content（monospace, 唯讀），失敗時 modal 顯示 error message（addresses **Disabled target content viewing**）。Modal 重用 ConfirmDialog modal pattern（`fixed inset-0 z-50` + backdrop）。驗證：`npm run check` 通過。

## 6. 驗證

- [x] 6.1 `cargo test --lib` 全 pass，覆蓋 multi-source apply、disabled target 建立、target read content、KeepCanonical 移除。驗證：命令退出碼 0。
- [x] 6.2 `npm run check` 無新增 TypeScript 錯誤。驗證：與 1.1 baseline 對照。
- [x] 6.3 `spectra analyze skill-identity-namespace-strategy --json` 與 `spectra validate skill-identity-namespace-strategy`，完成條件是沒有 Critical/Warning findings 且 change 驗證通過。
- [x] 6.4 `npm run tauri dev` 手動驗證：(a) 建立測試 fixture：在 `~/.claude/skills/` 和 `~/.agents/skills/` 各放一個同名但不同內容的 skill；(b) 開啟 import wizard，確認 multi-source row 可展開、body preview 正確顯示、選擇一個來源後可匯入；(c) canonical 已存在時確認選來源前 warning bar 顯示 canonical path 並提示先選來源，選擇 anthropic/codex source 後 warning 顯示該 source 的 diff summary，切換 source 時 warning 內容同步更新；(d) canonical 已存在時確認選來源後仍需明確 Skip / Overwrite / Rename，且不會直接覆蓋；(e) 匯入後確認 canonical 內容為選定來源、sync-meta 含 disabled target；(f) 在 TargetEditor 任一 target row 點「查看內容」確認 modal 顯示 agent-side SKILL.md raw content；(g) 對 file-not-found target 點「查看內容」確認顯示錯誤訊息。
