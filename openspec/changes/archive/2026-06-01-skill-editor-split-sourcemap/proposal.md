## Summary

將 Split 檢視的同步捲動從目前的比例同步（Phase 1）升級為 Source Map 區塊級精確同步（Phase 2），實現類似 VSCode / Obsidian 的行級對應捲動體驗。

## Motivation

Phase 1 的比例同步（scrollTop 百分比映射）在 editor 與 preview 內容高度差異大時（例如短 Markdown 展開為長 HTML 表格、或大量程式碼區塊），對應位置會明顯偏移。Source Map 方案利用 marked parser 的 token 行號資訊，在渲染 HTML 時注入 data-source-line 屬性，實現區塊級精確同步。

## Proposed Solution

1. 自訂 marked renderer，在每個 block-level token（heading、paragraph、code、list、table、blockquote、hr）的輸出 HTML 根元素注入 `data-source-line="N"` 屬性，N 為該 token 在原始 Markdown 中的起始行號
2. Editor 捲動時，根據可見區域的行號範圍，在 preview 側查找最近的 `[data-source-line]` DOM 元素，使用 scrollIntoView 或 scrollTop 計算將對應區塊滾動到可見區域
3. 保留 Phase 1 的 requestAnimationFrame + syncingScroll flag 防迴圈機制
4. Preview → Editor 反向同步同樣透過 data-source-line 映射

## Non-Goals

- 不實作行內（inline）級精確同步（僅 block-level）
- 不修改 MarkdownPreview 的樣式或 CSS
- 不影響非 Split 模式（Edit-only / Preview-only）的行為

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `skill-content-markdown-preview`：MarkdownPreview 的 marked renderer 新增 data-source-line 屬性注入，Split 模式捲動同步從比例映射改為 source map 區塊對應

## Impact

- 受影響 specs：skill-content-markdown-preview（renderer 行為變更）
- 受影響程式碼：
  - Modified: src/lib/components/shared/MarkdownPreview.tsx（自訂 marked renderer，注入 data-source-line）
  - Modified: src/lib/components/skills/SkillEditor.tsx（Split 捲動同步邏輯從比例映射改為 source map 查找）
- 無新增依賴（marked 已是現有依賴）
- 無破壞性變更
