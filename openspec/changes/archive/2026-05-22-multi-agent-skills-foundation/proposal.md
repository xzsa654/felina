## Why

`agent-skills-schema-reference` change(2026-05-21 archived)已落地 canonical skill schema 與三家 agent(Anthropic / OpenAI Codex / Google Gemini)的 fan-out 對照表。現行 `src-tauri/src/commands/skills.rs` 仍只懂 `.claude/skills/` 一家、沒有 canonical 主檔概念,使用者要在三個 agent 維護同一份 skill 必須手動複製、無法保證一致性。本 change 把這層薄殼重寫為「canonical 主檔 + 三家 fan-out」的雙層架構,讓 skill 真正多 agent 共用。

## What Changes

- **新增 canonical 儲存層**:`~/.glyphic/skills/<name>/SKILL.md`(global)與 `<project>/.glyphic/skills/<name>/SKILL.md`(project),為 source of truth。主檔 frontmatter 採 snake_case canonical schema,含 `agents: [<agent>, ...]` 同步控制欄位。
- **新增三家 fan-out renderer**:Anthropic(`.claude/skills/`,snake → kebab-case rename)、Codex(`.agents/skills/`,SKILL.md + 拆出 `agents/openai.yaml` 兩檔)、Gemini(`.gemini/skills/`,只複製 `name`+`description`)。Fan-out 純單向 push,不做 drift 偵測(屬 phase 2)。
- **重寫 Skills 頁**:列表頂端 sticky **pending-push bar**(顯示有幾個 skill 改過未推、一鍵 Push all);列表每列右側 per-skill Push 按鈕;Edit 介面**強制視覺化表單**,frontmatter 純 UI 操作,raw YAML 不直接編輯(包含 preview 也是 UI 化呈現)。
- **新增首次啟動 import banner**:偵測到 `.claude/skills/` `.agents/skills/` `.gemini/skills/` 等已知路徑有檔案時,Skills 頁頂部顯示 dismissable banner「Detected N existing skills · [Import...] · [Dismiss]」。Import 走精靈,呈現 diff 讓使用者選主版本來源,匯入後既有 agent 目錄不主動刪。
- **Settings 頁新增 Agent Paths 區**:三家 × global / project = 6 個可覆寫路徑欄位,預設值來自 `agent-skills-schema` spec(Anthropic `~/.claude/skills/` + `.claude/skills/`、Codex `~/.agents/skills/` + `.agents/skills/`、Gemini `~/.gemini/skills/` + `.gemini/skills/`),可 per-section 折疊。
- **既有 `list_skills` / `write_skill` / `delete_skill` 三條 Tauri command 廢除**:替換為新的 canonical CRUD + sync commands;前端 wrapper 同步替換。
- **`AGENT.md`(subagent definition)相關 command 不動**:`list_agents` / `write_agent` / `delete_agent` 保留,本 change 不處理 subagent。

## Capabilities

### New Capabilities

- `multi-agent-skills`: 跨 agent 通用的 skill 主檔管理 capability。涵蓋 canonical 儲存層(global / project scope)、frontmatter schema 解析、三家 agent 單向 fan-out renderer、initial import 精靈、pending-push 同步狀態追蹤、Settings 端 agent path 客製。

### Modified Capabilities

- `app-pages`: Settings 頁新增 **Agent Paths** 區作為 registered subsection,變更 page 內部規範(原 spec 未明確要求 Settings 頁內含結構,本 change 加上「Settings 頁 SHALL 提供 per-agent skill path 設定」)。

## Impact

- **Affected specs**:
  - New: `openspec/specs/multi-agent-skills/spec.md`
  - Modified: `openspec/specs/app-pages/spec.md`(加 Settings Agent Paths 子要求)
- **Affected code**:
  - New:
    - `src-tauri/src/commands/canonical_skills.rs`(canonical CRUD + sync trigger)
    - `src-tauri/src/commands/fan_out/mod.rs`(fan-out 子模組註冊)
    - `src-tauri/src/commands/fan_out/anthropic.rs`(Anthropic renderer:snake → kebab-case)
    - `src-tauri/src/commands/fan_out/codex.rs`(Codex renderer:SKILL.md + agents/openai.yaml 拆檔)
    - `src-tauri/src/commands/fan_out/gemini.rs`(Gemini renderer:純複製 name + description)
    - `src-tauri/src/commands/skill_import.rs`(initial import 掃描 + 衝突解決邏輯)
    - `src/lib/components/skills/SkillList.tsx`(列表 + dirty 狀態 dot)
    - `src/lib/components/skills/SkillEditor.tsx`(視覺化表單 + Markdown body 編輯器)
    - `src/lib/components/skills/PendingPushBar.tsx`(sticky 同步狀態列)
    - `src/lib/components/skills/SkillImportBanner.tsx`(首次啟動偵測 banner)
    - `src/lib/components/skills/SkillImportWizard.tsx`(import 精靈 + 衝突解決 UI)
    - `src/lib/components/settings/AgentPathsSection.tsx`(Settings 端三家路徑設定區)
    - `src/lib/stores/skills-store.ts`(Zustand:canonical 清單、dirty bit、import banner dismissed 旗標)
  - Modified:
    - `src-tauri/src/commands/skills.rs`(現行 list_skills / write_skill / delete_skill 三條 command 移除,僅保留 list_agents / write_agent / delete_agent)
    - `src-tauri/src/paths.rs`(新增 `glyphic_global_skills_dir()` `glyphic_project_skills_dir()` 等 helper)
    - `src-tauri/src/lib.rs`(register 新 canonical + fan-out + import commands)
    - `src-tauri/src/commands/mod.rs`(註冊 canonical_skills / fan_out / skill_import 模組)
    - `src-tauri/Cargo.toml`(新增 `serde_yaml` dependency,用於 frontmatter parse)
    - `src/lib/components/skills/SkillsPage.tsx`(整頁重寫,從現行 215 行 CRUD 改為 List + Editor + PendingPushBar + ImportBanner 組合)
    - `src/lib/components/settings/SettingsPage.tsx`(新增 Agent Paths 區)
    - `src/lib/tauri/commands.ts`(移除 listSkills / writeSkill / deleteSkill wrapper,新增 canonical + fan-out + import wrapper)
    - `src/lib/types/skills.ts`(從 `SkillInfo` 6 行擴充為 canonical 型別 + dirty / sync 狀態)
  - Removed:
    - (本 change 不主動刪檔。既有使用者 `~/.claude/skills/` 內容保留,透過 import 精靈拉進 canonical。)
- **Dependency 變動**:
  - Cargo:新增 `serde_yaml`(frontmatter parse;Rust ecosystem 標準選擇)
  - npm:無新增(視覺化表單元件以手寫 Tailwind + Lucide icons 實作,符合既有 UI 風格)
- **跨 change 依賴**:強相依 `agent-skills-schema-reference`(已 archived 2026-05-21);canonical schema 與三家 mapping table 來自該 reference spec
- **破壞性變更**:現行 SkillsPage 流程改變,既有 `list_skills` / `write_skill` / `delete_skill` Tauri command 被移除(任何外部呼叫者會失敗 — Glyphic 是 desktop app,沒有外部 IPC 呼叫者,影響範圍限定 app 內部)
- **Backward compatibility**:`~/.claude/skills/` 既有檔案不會被自動刪除;使用者透過 import 精靈拉進 canonical 後,該目錄變成 Anthropic 的 fan-out 輸出端,後續 push 才會覆寫
