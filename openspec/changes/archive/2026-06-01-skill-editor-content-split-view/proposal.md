## Summary

Content 分頁新增 Split 雙欄並排檢視模式，與現有 Edit / Preview 切換並存。

## Motivation

`skill-editor-document-header` 建立了 Content / Settings 分頁骨架，Content 分頁目前有 Edit 和 Preview 兩種模式。使用者編輯 Markdown 時需要在兩者之間反覆切換才能確認渲染結果。新增 Split 模式讓使用者在寬螢幕時能一邊編輯、一邊即時預覽。

## Proposed Solution

1. **三種檢視模式**：Edit（純編輯器，預設）、Preview（純預覽）、Split（左編輯右預覽）。三個模式以按鈕組呈現，使用者自行選擇。
2. **寬度門檻**：使用 `ResizeObserver` 偵測 Content 區域 container 寬度。Split 模式僅在 container 寬度 ≥ 768px 時可選；< 768px 時 Split 按鈕 disabled。Edit 和 Preview 切換永遠可用，不受寬度影響。
3. **Split 版面**：左右各佔 50%，中間 `border-r border-border` 分隔。左側為 textarea，右側為 MarkdownPreview。兩側獨立捲動。
4. **自動回退**：若使用者在 Split 模式下縮小視窗至 < 768px，自動回退到 Edit 模式。

## Non-Goals

- 不實作可拖曳的分隔線調整左右比例
- 不實作 synchronized scroll（左右同步捲動）
- 不修改 MarkdownPreview 元件本身

## Impact

- Affected specs: `skill-content-markdown-preview`
- Affected code:
  - Modified: `src/lib/components/skills/SkillEditor.tsx`, `src/lib/i18n/locales/en.ts`, `src/lib/i18n/locales/zh-TW.ts`
