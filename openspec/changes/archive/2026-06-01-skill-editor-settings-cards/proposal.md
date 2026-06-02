## Summary

Settings 分頁的 Agent Fields 改為按 agent 分卡片垂直堆疊可摺疊，Advanced Extras 包裝為獨立卡片並補上 Add property 按鈕。

## Motivation

`skill-editor-document-header` 建立了 Content / Settings 分頁骨架，Settings 分頁目前直接展開所有 Agent Fields 和 Extras，缺乏視覺分組。按 agent 分卡片讓使用者快速定位特定 agent 的設定；Advanced Extras 獨立成卡片並提供 Add property 按鈕，讓動態 YAML key-value 新增更直覺。

## Proposed Solution

1. **Agent Fields 按 agent 分卡片**：Anthropic / Codex / Gemini 各一張可摺疊卡片，垂直堆疊。只有該 skill 實際有設定欄位的 agent 才顯示卡片，空的不佔位。卡片使用 `bg-bg-secondary/30` + `border` 樣式。
2. **可摺疊行為**：每張卡片有展開/摺疊 toggle（ChevronDown/ChevronRight），預設展開。
3. **Advanced Extras 卡片化**：包裝在獨立卡片區塊中，新增 `+ Add property` 按鈕讓使用者直覺新增 key-value row。
4. **Focus 回饋**：Settings 分頁內的輸入欄位加入 `focus:ring-1 focus:ring-accent` 視覺回饋。
5. **未來擴展性**：第三方 agent 若透過 `dynamic-agent-field-catalog` 取得專屬欄位，直接多一個摺疊卡片，不需改版面結構。第三方 agent 若使用通用格式無專屬欄位，則不出現在 Agent Fields。

## Non-Goals

- 不實作 `dynamic-agent-field-catalog`（未來 change）
- 不修改 AgentFieldsEditor 的後端邏輯
- 不修改 Agent Fields 的欄位定義來源

## Impact

- Affected specs: `skills-workspace-layout`
- Affected code:
  - Modified: `src/lib/components/skills/SkillEditor.tsx`, `src/lib/components/skills/AgentFieldsEditor.tsx`, `src/lib/i18n/locales/en.ts`, `src/lib/i18n/locales/zh-TW.ts`
