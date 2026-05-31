## Summary

SkillEditor 從「填表式表單」重構為「文件中心化」版面：Document Header（Name 大字體 + Description + Action Bar）取代現有的 Properties 區塊和獨立 toolbar，新增 Content / Settings 分頁骨架，並加入 Sticky Header、Broken Raw Mode 分頁隱藏、Dirty State 標示等 UX 改善。

## Motivation

目前 SkillEditor 的版面排列為：toolbar → Properties（Name/Description）→ Advanced → Body，呈現典型的表單填寫感。Name 欄位是不可編輯的 input 框，Description 是 textarea，視覺上缺乏文件的沉浸感。此外 Properties 和 Body 之間的 Advanced 區塊讓寫作流程被打斷。

重構後 SkillEditor 採用 Notion 風格的文件標頭，Name 成為大字體標題，Description 緊接其下，Action Bar 整合到右上方。Content / Settings 分頁將 Markdown 寫作區與 Agent Fields / Advanced Extras 分離，讓使用者專注於內容編輯。

## Proposed Solution

1. **Document Header**：將 Name 渲染為 `text-2xl` 大字體（不可編輯，改名走 Rename 按鈕）。Description 以柔和色調緊接在下。Action Bar（Save / Rename / Delete / Cancel）整合到 Name 同一行的右側。
2. **分頁骨架**：在 Document Header 下方新增 Content / Settings 分頁列（底線型分頁，`border-b-2 border-accent`）。Content 分頁放 Markdown Body（現有 edit/preview 切換），Settings 分頁放 Agent Fields + Advanced Extras（維持現有功能，僅移動位置）。
3. **Sticky Header**：Document Header + 分頁列設為 sticky，僅 Content / Settings 區域獨立捲動（`overflow-y-auto`）。
4. **Broken Raw Mode**：`brokenRaw` 模式下隱藏分頁列，只保留紅色 Action Bar 和滿版 Raw Textarea。
5. **Dirty State 標示**：Name 旁加入修改指示（`*` 號），當有未儲存的變更時顯示。
6. **移除 Properties 區塊**：原本的 Properties 標題、Name input、Description textarea 區塊移除，功能由 Document Header 取代。

## Non-Goals

- 不實作 Target Chips（屬於 `skill-editor-target-chips` change）
- 不實作 Split View 雙欄預覽（屬於 `skill-editor-content-split-view` change）
- 不實作 Agent Fields 按 agent 分卡片（屬於 `skill-editor-settings-cards` change）
- 不修改後端邏輯
- Description 維持可編輯的 textarea，不改為 contentEditable

## Impact

- Affected specs: `skills-workspace-layout`（版面結構變更）
- Affected code:
  - Modified: `src/lib/components/skills/SkillEditor.tsx`, `src/lib/i18n/locales/en.ts`, `src/lib/i18n/locales/zh-TW.ts`
