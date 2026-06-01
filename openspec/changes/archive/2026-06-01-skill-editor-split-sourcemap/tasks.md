## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline。驗證：npm run check 結果記錄

## 2. Source Map Renderer

- [x] 2.1 在 MarkdownPreview.tsx 中建立自訂 marked renderer，對所有 block-level token（heading、paragraph、code、list、table、blockquote、hr）的輸出 HTML 根元素注入 data-source-line 屬性，值為 token 的 1-based 起始行號（Source Map Line Attribution 需求）。行為：Preview 和 Split 模式下，rendered HTML 的 block 元素皆帶 data-source-line 屬性。驗證：npm run check 通過
- [x] 2.2 為自訂 renderer 的 data-source-line 注入邏輯撰寫 node:test 單元測試（tests/markdown-source-map.test.ts），驗證 heading/paragraph/code/list/table 各 token 類型皆正確注入行號。驗證：node --test tests/markdown-source-map.test.ts 全數通過

## 3. Split 捲動同步改造

- [x] 3.1 SkillEditor.tsx 的 Split 捲動同步邏輯從比例映射改為 source map 查找：editor onScroll 時取得 topmost visible line，在 preview 側查找 nearest data-source-line DOM 元素並 scrollIntoView。保留 requestAnimationFrame + syncingScroll flag 防迴圈（Split View Source Map Scroll Sync 需求）。行為：editor 捲動時 preview 同步到對應區塊位置而非等比例位置。驗證：npm run check 通過
- [x] 3.2 實作 preview → editor 反向同步：preview onScroll 時取得 topmost visible data-source-line 元素的行號，將 editor 捲動到對應行。行為：雙向捲動同步皆透過 source map 實現。驗證：npm run check 通過

## 4. 驗證

- [x] 4.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 4.2 執行 node --test tests/markdown-source-map.test.ts 確認單元測試全數通過。驗證：exit code 0
- [x] 4.3 npm run tauri dev 手動驗證以下行為：(a) Split 模式下 preview HTML 元素帶 data-source-line 屬性（DevTools 檢查）、(b) editor 捲動時 preview 同步到對應區塊、(c) preview 捲動時 editor 反向同步、(d) 快速捲動無迴圈震盪、(e) 短 Markdown + 長 HTML 表格場景下同步精確度優於比例映射。驗證：逐項目視確認
