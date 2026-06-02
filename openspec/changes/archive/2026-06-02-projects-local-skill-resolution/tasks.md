## 1. Baseline

- [x] 1.1 執行 `npm run check` 與 `cd src-tauri && cargo check`，記錄現有 TypeScript / Rust error 數作為 baseline。驗證：保存兩份結果摘要供後續比對。

## 2. Backend: project-local skill operations（Rename project-local — folder + frontmatter, duplicate / traversal guard ＋ Discard project-local — folder delete, canonical untouched）

- [x] 2.1 新增 Tauri command `project_local_skill_rename(project_path: String, agent: AgentId, old_name: String, new_name: String) -> Result<(), String>` 於 `src-tauri/src/commands/skill_import.rs`：解析 `project_path` 對應 agent 的 skill 目錄（沿用 `resolve_pair` 或 `agent_paths_get`），rename `<dir>/<old_name>/` 為 `<dir>/<new_name>/`，讀取 `<new_dir>/SKILL.md` 解析 frontmatter 更新 `name` 欄位後寫回。驗證條件：`new_name` 非空、不含 `..`/`/`/`\`、`<dir>/<new_name>/` 不存在；任一條件失敗 → 回 Err 且不動 disk。Folder rename 成功但 frontmatter 寫入失敗 → 嘗試把 folder 改回原名（best-effort rollback），回 Err。涵蓋 `Project-Local Skill Rename` 的 happy path + traversal/collision/rollback。驗證：新增 `cargo test` 覆蓋 happy path、collision、traversal、empty name、frontmatter write failure rollback。
- [x] 2.2 新增 Tauri command `project_local_skill_delete(project_path: String, agent: AgentId, skill_name: String) -> Result<(), String>` 於 `src-tauri/src/commands/skill_import.rs`：解析 `project_path` 對應 agent skill 目錄，遞迴刪除 `<dir>/<skill_name>/`。驗證條件：`skill_name` 不含 `..`/`/`/`\`；directory 不存在時回 Ok（idempotent）；權限或 IO 失敗回 Err。不修改 canonical 或 sync-meta。涵蓋 `Project-Local Skill Discard`。驗證：新增 `cargo test` 覆蓋 happy path、missing directory（idempotent）、traversal、permission failure（用 mock 或標記為 `#[ignore]` 並文字說明）。
- [x] 2.3 註冊兩個新 command 到 `src-tauri/src/lib.rs` 的 `invoke_handler!` 巨集。驗證：`cargo check` 通過；前端透過 `invoke` 呼叫不會收到 "command not found"。

## 3. Frontend: types and command wrappers

- [x] 3.1 在 `src/lib/tauri/commands.ts` 新增 `api.projectLocalSkills.rename(projectPath, agent, oldName, newName)` 與 `api.projectLocalSkills.delete(projectPath, agent, skillName)` 兩個 wrapper，型別對齊後端簽章。驗證：`npm run check` 通過；wrapper 透過既有 `invoke` helper 呼叫，錯誤訊息 propagate 為 `Promise<void>` rejection。

## 4. Frontend: Same-Name Resolution Dialog 與 row 入口（Single-entry dialog, options vary by relationship ＋ Multi-source Overwrite uses existing drawer）

- [x] 4.1 [P] 在 `src/lib/components/projects/managed-inventory.ts` 加入 helper `resolutionOptionsFor(row: InventoryRow): ResolutionOption[]`：依 `row.relationship` 推導可用選項陣列（`canonicalGlobalOnly` 回傳 `[link, overwrite, rename, discard]`；`canonicalExistsUnlinked` 回傳 `[link, overwrite, rename]`；其他 relationship 回傳空陣列）。涵蓋 `Same-Name Resolution Dialog` 的 per-relationship 推導。驗證：新增 node:test 覆蓋兩種 relationship 各自的選項清單與順序、其他 relationship 無選項。
- [x] 4.2 `src/lib/components/projects/ManagedInventory.tsx` 衝突 row 主按鈕統一改為「選擇處理方式…」（i18n key `projects.inventory.resolutionEntry`），移除原本 row 上的 Link / Overwrite 兩按鈕；點擊後 open `SameNameResolutionDialog`（新元件 / 同檔內 inline 元件二擇一，視重用程度）。Dialog 列出 `resolutionOptionsFor(row)` 結果，每個選項一行 button + 短說明文字；open 時不呼叫任何 backend command。涵蓋 `Managed Inventory View` 修改後的 action 規則與 `Same-Name Resolution Dialog` 的 open-without-mutation。驗證：`npm run check` 通過；手動驗證 `canonicalGlobalOnly` row 開 dialog 顯示四選項、`canonicalExistsUnlinked` row 顯示三選項。
- [x] 4.3 `src/lib/components/projects/ManagedInventory.tsx` 將既有 Link confirmation dialog 與 Overwrite confirm dialog 的觸發改成由 Same-Name Resolution Dialog 路由：選 Link → 沿用既有 Link confirm；選 Overwrite → 沿用既有 Overwrite confirm（修改後含 hunks，見 task 7）。Single-source 直接走 confirm；multi-source 先走既有 multi-source drawer 再走 confirm。涵蓋 `Discovered Skill Link Confirmation` 修改後的多源路由與 `Multi-Source Overwrite Path`。驗證：手動驗證 single-source Link / Overwrite 不開 drawer；multi-source Link / Overwrite 都先開 drawer。

## 5. Frontend: Rename 流程

- [x] 5.1 [P] 新增 `RenameProjectLocalDialog` 元件（或 inline 於 `ManagedInventory.tsx` 的 ActionDialogs 內），參考既有 `RenameSkillDialog` 的輸入驗證邏輯（非空、`A-Z`/`a-z`/`0-9`/`_`/`-`、不以 `.` 開頭、不等於 `currentName`）。Dialog 顯示 oldName、輸入 newName、display agent 與 project；若 agent 為 Codex 或 Gemini 且 source path 含 `.agents/skills` 字串，顯示「此操作將同時影響 Codex 與 Gemini」warning。涵蓋 `Project-Local Skill Rename` 的 input validation 與 shared-dir warning。驗證：`npm run check` 通過；手動驗證 invalid input 顯示 inline error、valid input 啟用 confirm 按鈕。
- [x] 5.2 Rename confirm 呼叫 `api.projectLocalSkills.rename(projectPath, agent, oldName, newName)`，成功後 reload inventory 並 close dialog；失敗顯示後端錯誤訊息 inline。涵蓋 `Project-Local Skill Rename` 的 happy path 與錯誤回報。驗證：手動驗證 rename 後 row 從 inventory 消失（已改名為新 row 或 localOnly）；rename 失敗時 dialog 不關閉且顯示錯誤。

## 6. Frontend: Discard 流程

- [x] 6.1 [P] 新增 `DiscardProjectLocalDialog` 元件（或 inline），顯示 skill name、agent、project path、global fallback 路徑（例如 `~/.claude/skills/<name>/`），文案說明「Claude 將改用 Felina 全域版本」；若 source path 含 `.agents/skills`，加 shared-dir warning「此操作將同時影響 Codex 與 Gemini」。涵蓋 `Project-Local Skill Discard` 的文案要求。驗證：`npm run check` 通過；手動驗證 dialog 文字清楚說明 fallback。
- [x] 6.2 Discard confirm 呼叫 `api.projectLocalSkills.delete(projectPath, agent, skillName)`，成功後 reload inventory 並 close dialog；失敗顯示錯誤訊息 inline。涵蓋 `Project-Local Skill Discard` 的 happy path 與錯誤回報。驗證：手動驗證 discard 後 row 從 inventory 消失；canonical 不動（透過 Skills 頁確認）；directory 不存在時 idempotent 成功。

## 7. Frontend: Diff 方向中性化 + Overwrite hunks（Diff direction neutralized at backend, flipped at frontend ＋ Overwrite confirm dialog gains hunks）

- [x] 7.1 [P] 在 `src/lib/components/projects/ManagedInventory.tsx` 抽出 `ConflictDiffView` 內部元件（或 reuse 既有 Link dialog 的 diff render block）：接受 `hunks: DiffHunk[]`、`direction: "link" | "overwrite"` 兩個 props。`direction="link"` 時把每個 hunk line 的 `add`/`delete` 對調再 render；`direction="overwrite"` 時用後端原方向 render。Legend 文字依 direction 切換。涵蓋 `Conflict Diff Direction Convention`。驗證：新增 node:test 覆蓋 direction="link" 對 hunk 行的 kind swap（純函式 helper）；`npm run check` 通過。
- [x] 7.2 修改 Overwrite confirm dialog（現行用 `ConfirmDialog`）：改為含 inline hunks 的自訂 dialog，沿用 `ConflictDiffView` 元件 `direction="overwrite"`。`hunks` 為空時 fallback 顯示 `diffSummary` 文字。短訊息「寫入方向：此專案 → Felina 主檔。/ 副作用：...」保留為 dialog header 下方說明。涵蓋 `Overwrite Confirmation Inline Diff`。驗證：`npm run check` 通過；手動驗證 Overwrite dialog 顯示 hunks 與 legend「base = Felina 主檔 / incoming = 本專案」。
- [x] 7.3 修改既有 Link confirmation dialog 改用 `ConflictDiffView` 元件 `direction="link"`，移除目前 inline 寫的 hunks render block（保留 fallback 文字邏輯）。Legend 文字仍為「base = 本專案 / incoming = Felina 主檔」。驗證：`npm run check` 通過；手動驗證 Link dialog 的 `+` 紅綠對應與目前相反 — Felina 那邊變成綠色（incoming）。

## 8. i18n

- [x] [P] 8.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 的 `projects.inventory` 命名空間新增以下 key（en / zh-TW 結構對齊）：
  - `resolutionEntry`：「選擇處理方式…」/「Choose how to handle…」
  - `resolution.title`：「處理同名 Skill」/「Handle same-name skill」
  - `resolution.linkLabel` / `resolution.linkDescription`
  - `resolution.overwriteLabel` / `resolution.overwriteDescription`
  - `resolution.renameLabel` / `resolution.renameDescription`
  - `resolution.discardLabel` / `resolution.discardDescription`
  - `rename.title`、`rename.input`、`rename.confirm`、`rename.sharedAgentsWarning`、`rename.errorEmpty`、`rename.errorInvalid`、`rename.errorCollision`、`rename.errorSame`
  - `discard.title`、`discard.confirm`、`discard.fallbackNote`、`discard.sharedAgentsWarning`
  - `link.diffBase` / `link.diffIncoming`（既有 key 若不夠精準則更新文字，方向：本專案 base / Felina 主檔 incoming）
  - `overwriteConflictDialog.diffBase`：「Felina 主檔（base）」/「Felina master (base)」
  - `overwriteConflictDialog.diffIncoming`：「本專案（incoming）」/「This project (incoming)」
  
  驗證：`npm run check` 通過；grep 確認所有新元件使用的 i18n key 兩個檔都有定義。

## 9. Verification

- [x] 9.1 執行 `npm run check`，確認 TypeScript error 數 ≤ task 1.1 baseline。
- [x] 9.2 執行 `cd src-tauri && cargo test --lib` 與 `cargo check`，確認 Rust 測試通過且 error 數 ≤ baseline。
- [x] 9.3 執行相關 node:test（管理 inventory row 模型、`resolutionOptionsFor`、`ConflictDiffView` direction swap），確認全部通過。
- [x] 9.4 啟動 `npm run tauri dev` 手動驗證六情境：
  - (a) `canonicalGlobalOnly` row 點「選擇處理方式…」開 dialog 顯示四選項
  - (b) `canonicalExistsUnlinked` row 開 dialog 顯示三選項（無 Discard）
  - (c) Rename single-source 成功，row 從 inventory 消失
  - (d) Discard 成功後 row 從 inventory 消失、canonical 不動（到 Skills 頁確認）
  - (e) Multi-source row 的 Link / Overwrite 都先走 drawer 才到 confirm
  - (f) Link dialog 的 hunks legend 顯示 Felina incoming（綠 +）/ Overwrite dialog 顯示 Felina base（紅 −）
