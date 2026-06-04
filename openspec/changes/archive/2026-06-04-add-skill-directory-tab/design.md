## Context

目前 Felina 的 Skill 編輯介面僅專注於 `SKILL.md` 的前置資料 (Frontmatter) 與內容，但實際上使用者的 Skill 可能是包含多個檔案（例如 `scripts/`、`tests/`）的完整目錄結構。為了提供完整的上下文，我們決定在 UI 中加入唯讀的檔案系統檢視。這個設計將擴展前後端的合約，提供前端讀取 canonical skill 目錄下檔案與結構的能力。

## Goals / Non-Goals

**Goals:**

- 實作新的 Tauri 指令，遞迴掃描特定 Skill 的目錄結構。
- 排除不需要顯示的內部檔案（例如 `SKILL.md` 本身、`.felina-sync-meta.json`）。
- 在 `SkillEditor.tsx` 中新增一個符合 `felina-ui-guidelines` 的無邊框、文件中心化風格的「目錄」分頁。

**Non-Goals:**

- **不實作檔案編輯器**：這是一個唯讀視圖，不允許使用者在 Felina 內修改、刪除或新增這些額外檔案。
- **不監聽檔案變更**：目前不實作 fs watcher 即時更新結構，只需要在每次切換回該分頁時重新獲取即可。

## Decisions

### 1. 後端指令實作與回傳結構

我們將在 `src-tauri/src/commands/canonical_skills.rs` 中新增一個 `get_skill_directory_tree` 函數。
它會回傳一個扁平的檔案列表或樹狀結構。考慮到 Rust 端與前端處理的簡便性，回傳樹狀結構 `TreeNode { name: String, path: String, is_dir: bool, children: Option<Vec<TreeNode>> }` 最符合 React 遞迴渲染的需求。

### 2. 檔案排除策略

必須明確過濾掉 `SKILL.md`（因為已經在另一頁面呈現）與 `.felina-sync-meta.json`（純系統設定，使用者不需關心）。其他所有的檔案與資料夾都應呈現。

### 3. 前端介面佈局

遵循 `felina-ui-guidelines`：
- 不使用 HTML `<table>` 或死板框線。
- 每一列採用 Flex 佈局，包含適當的 padding 與 `hover:bg-bg-secondary/20` 來引導視覺。
- 使用 `lucide-react` 的 `Folder` 與 `FileText` / `FileCode` 圖示來區分檔案類型，色彩保持柔和。

## Implementation Contract

- **Behavior**: 使用者在編輯 Skill 時，可切換至「目錄」分頁，看到除了主檔外的所有附屬檔案清單。此清單為唯讀。
- **Interface / data shape**:
  - 新增指令 `get_skill_directory_tree(canonical_id: String) -> Result<Vec<SkillFileNode>, String>`
  - `SkillFileNode` 結構包含: `name` (String), `is_dir` (bool), `size_bytes` (Option<u64>), `children` (Option<Vec<SkillFileNode>>)。
- **Failure modes**: 若傳入的 `canonical_id` 對應的目錄不存在或無權限讀取，指令應回傳適當的錯誤訊息（型別 String），前端需捕捉並顯示「無法讀取目錄」。
- **Acceptance criteria**:
  - 成功編譯且可由 `npm run check` 與 `cargo check` 通過。
  - 在有附屬檔案的 Skill 中，能正確顯示分頁與檔案清單。
  - `SKILL.md` 與 `.felina-sync-meta.json` 必須不在清單中出現。
- **Scope boundaries**:
  - **In scope**: 後端讀取並過濾目錄、前端分頁切換與清單渲染。
  - **Out of scope**: 點擊檔案開啟預覽、新增/刪除檔案、監聽外部檔案系統變動。

## Risks / Trade-offs

- [Risk] 讀取非常大且深的目錄可能會造成後端效能問題或傳輸過大 JSON。
  → Mitigation: 可以限制遞迴深度（例如最多 3 層），或者限制回傳的檔案總數，但考量到 Skill 目錄通常很小，目前先採用無限制讀取，若未來有需求再加入分頁或深度限制。
