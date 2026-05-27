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

## 1. 準備階段

- [x] 1.1 執行 `npm run check` 並記錄現有 TypeScript errors / warnings，建立開發基準，驗證時以此對比確保未引入新錯誤。

## 2. 元件抽取與整合

- [x] [P] 2.1 檢查並重構現有的 Markdown 渲染元件（如 Memory 頁面使用的元件），將其提取至 `src/lib/components/shared/`，確保其可作為共用元件。驗證：`npm run check` 通過且 Memory 頁面能正常編譯渲染 (Requirement: Skill Markdown Preview)。
- [x] [P] 2.2 在 `src/lib/components/skills/SkillEditor.tsx` 中加入 "Edit" 與 "Preview" 切換的狀態與按鈕。當切換為 Preview 時，使用 Markdown 共用元件渲染內容。驗證：`npm run check` 無錯誤 (Requirement: Skill Markdown Preview)。
- [x] 2.3 修改 Sync Target 檢視對話框（如 `TargetPreviewModal.tsx` 或對應元件），預設使用 Markdown 元件渲染內容，並提供 Raw source 的切換。驗證：`npm run check` 無錯誤 (Requirement: Skill Markdown Preview)。

## 3. 驗證與測試

- [x] 3.1 執行 `npm run tauri dev` 啟動應用，手動確認 Skill Editor 可正常切換預覽模式並正確渲染 Markdown 樣式；手動確認 Sync Target 檢視 modal 預設呈現預覽畫面且可切換原始碼。驗證：手動測試操作符合所有場景 (Requirement: Skill Markdown Preview)。
