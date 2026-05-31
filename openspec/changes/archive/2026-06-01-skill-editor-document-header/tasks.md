## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings 數量，作為本 change 前後比較基準。驗證：記錄輸出結果。

## 2. Document Header 重構（Design: Document Header 結構; Resizable Skills Workspace requirement）

- [x] 2.1 實作 Resizable Skills Workspace — Document Header 重構（Task scope: Document Header 重構; i18n 新增 keys）：將現有 Properties 區塊（h3 "Properties" + Name input + Description textarea）替換為文件標題版面。既有 skill 的 Name 渲染為 `text-2xl font-bold` 不可編輯文字；新建模式的 Name 為無邊框可編輯 input（`text-2xl`、`border-transparent focus:border-accent`）。Description 改為無外框 textarea（`text-sm text-text-secondary`、`border-transparent focus:border-accent`）。Action Bar（Cancel/Rename/Delete/Save）從獨立 toolbar 移到 Name 行右側，以 `flex items-center justify-between` 排列。移除原本的 `border-b border-border pb-3` toolbar div 和 "Editing {name}" / "Creating new" 文字。驗證：`npm run check` 通過，既有 skill 顯示大字體 Name + 右側按鈕，新建模式 Name 可編輯。

## 3. 分頁骨架（Design: 分頁骨架; Resizable Skills Workspace requirement — Tab switching）

- [x] 3.1 實作分頁骨架（Task scope: 分頁骨架）：在 Document Header 下方新增 Content / Settings 分頁列，使用底線型分頁（`border-b-2 border-accent`）。利用現有 `activeTab` state 管理切換。Content 分頁放現有 Body 區塊（edit/preview 切換 + textarea/MarkdownPreview）。Settings 分頁放現有 Advanced 區塊內容（AgentFieldsEditor + extras key-value rows），移除 Advanced 摺疊按鈕（ChevronDown/ChevronRight），改為預設全展開。若 `advancedOpen` state 和 ChevronDown/ChevronRight import 不再被其他地方使用則一併移除。驗證：`npm run check` 通過，分頁切換正常顯示對應內容。

## 4. Sticky Header + 可捲動內容（Design: Sticky Header; Resizable Skills Workspace requirement — Sticky header）

- [x] 4.1 實作 Sticky Header + Scroll（Task scope: Sticky Header + Scroll）：將 Document Header + 分頁列包裹在 `sticky top-0 z-10 bg-bg-primary` 容器中。下方 Content / Settings 區域設為 `flex-1 overflow-y-auto`。外層 div 改為 `flex flex-col h-full`。需確認 SkillsPage 的 Panel 容器支援此捲動結構（Panel 需有明確高度約束）。驗證：`npm run tauri dev` 手動確認——內容超過可視區域時，Document Header 和分頁列固定在頂部，僅下方內容捲動。

## 5. Broken Raw Mode 分頁隱藏（Design: Broken Raw Mode; Resizable Skills Workspace requirement — Broken raw mode）

- [x] 5.1 驗證 Broken Raw Mode（Task scope: Broken Raw Mode）：確認 `brokenRaw` 分支的提前 return 不渲染新的 Document Header 和分頁列。保留現有紅色 Action Bar（rawTitle + Save 按鈕）和滿版 Raw Textarea。不需要額外修改——只需驗證重構後的 brokenRaw 路徑未被影響。驗證：手動建立一個 YAML 格式錯誤的 SKILL.md，確認進入 raw mode 時只顯示紅色 Action Bar + textarea，不出現 Document Header 或分頁。

## 6. Dirty State 標示（Design: Dirty State 標示; Resizable Skills Workspace requirement — Dirty indicator）

- [x] 6.1 實作 Dirty State 標示（Task scope: Dirty State）：新增 `isDirty` useMemo，比較 name/description/body/extras/agentFields 與 skill props 的原始值。在 Name 大字體標題旁渲染 `*` 號（`<span className="text-accent ml-1">*</span>`），僅在 `isDirty && !isNew` 時顯示。驗證：`npm run check` 通過；修改 Description 或 Body 後 `*` 出現，Save 後 `*` 消失。

## 7. i18n

- [x] [P] 7.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 新增 `skills.editor.tabContent`（"Content" / "內容"）和 `skills.editor.tabSettings`（"Settings" / "設定"）。驗證：`npm run check` 通過（TranslationDict 結構對齊）。

## 8. 驗證

- [x] 8.1 執行 `npm run check`，確認 TypeScript errors 數量與 baseline 相比無新增。驗證：零 error。
- [x] 8.2 `npm run tauri dev` 手動驗證：(1) 既有 skill 顯示 Document Header（大字體 Name + Description + Action Bar 右側）；(2) 新建 skill 模式 Name 可編輯、Cancel 按鈕可見；(3) Content / Settings 分頁切換正常；(4) 捲動時 Header 和分頁列 sticky 固定；(5) Broken YAML skill 進入 raw mode 時不顯示 Document Header 和分頁；(6) 修改欄位後 Name 旁出現 `*`，Save 後消失。驗證：六項行為皆符合預期。
