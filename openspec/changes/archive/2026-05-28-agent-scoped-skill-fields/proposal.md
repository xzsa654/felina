## Why

目前 canonical skill 的進階 frontmatter extras 是扁平 key/value，使用者可以輸入任何欄位；這讓 Claude Code、Codex、Gemini CLI 之間的欄位容易混用，也讓 fan-out 必須靠零散 renderer 行為避免錯誤外洩。現在三個 target 的官方欄位已確認不同，Felina 需要把欄位選擇、canonical 儲存、fan-out 過濾收斂成同一套明確契約。

## What Changes

- 新增 agent-scoped skill field catalog，列出 Claude Code、Codex、Gemini CLI 可用欄位、型別、輸出位置與 verified source metadata。
- 將 SkillEditor 的 Advanced 區塊由自由 key/value 改為依 selected targets 分組的欄位下拉與型別化輸入。
- 將 canonical skill extras 從單一扁平 map 遷移為 agent-scoped 儲存結構，保留既有 extras 並在讀取/儲存時相容舊格式。
- fan-out renderer SHALL 只輸出目標 agent 允許的欄位，避免 Claude Code skill 出現 Codex-only YAML 或 Codex metadata，Gemini CLI 只輸出其支援欄位。
- import flow SHALL 在知道來源 agent 時把可識別欄位歸類到該 agent namespace；未知欄位保留但不得跨 agent 輸出。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agent-skills-schema`: 更新 Claude Code、Codex、Gemini CLI 的欄位參考與 canonical-to-agent mapping，作為 UI catalog 與 fan-out allowlist 的依據。
- `multi-agent-skills`: 更新 canonical skill frontmatter extras、visual editor、import 與 fan-out 行為，支援 agent-scoped 欄位並禁止跨 target 欄位外洩。

## Impact

- Affected specs: agent-skills-schema, multi-agent-skills
- Affected code:
  - Modified: src/lib/components/skills/SkillEditor.tsx
  - Modified: src/lib/components/skills/SkillsPage.tsx
  - Modified: src/lib/components/skills/TargetEditor.tsx
  - Modified: src/lib/types/skills.ts
  - Modified: src/lib/tauri/commands.ts
  - Modified: src/lib/i18n/locales/en.ts
  - Modified: src/lib/i18n/locales/zh-TW.ts
  - Modified: src-tauri/src/commands/canonical_skills.rs
  - Modified: src-tauri/src/commands/skill_import.rs
  - Modified: src-tauri/src/commands/fan_out/anthropic.rs
  - Modified: src-tauri/src/commands/fan_out/codex.rs
  - Modified: src-tauri/src/commands/fan_out/gemini.rs
  - New: src/lib/components/skills/skillFieldCatalog.ts
  - New: src-tauri/src/commands/skill_fields.rs
  - Removed: none
- Dependencies: no new npm or Cargo dependency expected; use existing YAML parsing and TypeScript/Rust validation patterns.
- Compatibility: existing canonical skills with flat `frontmatter_extras` remain readable and are migrated on save; fan-out becomes stricter by design and may stop emitting previously leaked unsupported fields.
