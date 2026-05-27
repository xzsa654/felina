## Summary

為 Skill 的檢視區塊（review body 與 sync target 面板）提供 Markdown 預覽模式，利用現有的 Markdown 渲染元件提升閱讀體驗。

## Motivation

目前在 Skill 編輯器或 Sync Target 面板中檢視 Skill 內容時，只能看到原始的 Markdown 語法。對於包含豐富排版（如表格、粗體、程式碼區塊）的 Skill，直接閱讀原始碼較為吃力。由於 Memory page 已經有實作 Markdown preview，我們可以復用該功能，為 Skill 的預覽介面提供更直覺、易讀的閱讀體驗。

## Proposed Solution

- 確認 Memory page 使用的 Markdown rendering 元件，確保其抽離為共用元件（例如 `MarkdownViewer` 或 `MarkdownPreview`）。
- 在 `SkillEditor` 的編輯區（或讀取模式）加入「Preview」切換按鈕，讓使用者可以在原始碼與預覽模式間切換。
- 在 Sync Target 的檢視介面（點擊 Eye button 所彈出的內容預覽）中，預設套用 Markdown 預覽模式，以利同步前確認。

## Impact

- Affected specs: `skill-content-markdown-preview`
- Affected code:
  - Modified: `src/lib/components/skills/SkillEditor.tsx` (加入 Preview Toggle)
  - Modified: 處理 Sync target 檢視的對話框元件 (例如 Target Preview Modal)
  - Modified (如果需要): `src/lib/components/shared/` 下的 Markdown 渲染元件，確保跨頁面復用。
