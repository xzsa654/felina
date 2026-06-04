## Why

Skill 不單單只包含 `SKILL.md` 一個檔案，有時還會帶有 `scripts/` 等子資料夾或附屬檔案。目前在 Felina 中，使用者無法得知這些附屬檔案的存在，這導致了資訊的不透明。為了解決這個問題，我們需要在 Skill 編輯介面中提供一個唯讀的目錄檢視，讓使用者能清楚知道 Skill 目錄下還有哪些結構。

## What Changes

- 在 `SkillEditor.tsx` 中新增一個「目錄 (Directory)」分頁。
- 實作全新的後端 Tauri 指令，用於掃描並回傳 Skill 目錄下的檔案結構（排除 `SKILL.md` 本身）。
- 採用符合 Felina UI 規範的去線條化（Borderless）與文件中心化（Document-Centric）的 Flex 清單佈局，不使用傳統表格。

## Non-Goals (optional)

## Capabilities

### New Capabilities

- `skill-directory-view`: 提供唯讀的 Skill 目錄檔案結構檢視功能。

### Modified Capabilities

(none)

## Impact

- Affected specs: `skill-directory-view`
- Affected code:
  - Modified:
    - `src-tauri/src/commands/mod.rs`
    - `src-tauri/src/lib.rs`
    - `src-tauri/src/commands/canonical_skills.rs`
    - `src/lib/tauri/commands.ts`
    - `src/lib/components/skills/SkillEditor.tsx`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
