## Why

Google 已將 gemini-cli 日落（sunset），後繼為 Antigravity CLI。Antigravity CLI 的全域 skill 目錄為 `~/.gemini/antigravity-cli/skills/`，與舊版 gemini-cli 的 `~/.gemini/skills/` 不同。Felina 目前的 shipped default 仍指向舊路徑，且 import scanner 的 Antigravity probe 路徑也寫錯（`antigravity/skills` 少了 `-cli`），導致匯入掃描不到 Antigravity CLI 的 skill。

## What Changes

- 後端 `agent_paths.rs::defaults()` 的 gemini global 從 `~/.gemini/skills` 改為 `~/.gemini/antigravity-cli/skills`
- 前端 `AgentPathsSection.tsx` 的 `DEFAULT_PATHS` gemini global 同步更新
- `skill_import.rs` 兩處 Antigravity probe 路徑從 `~/.gemini/antigravity/skills` 修正為 `~/.gemini/antigravity-cli/skills`
- `agent_paths.rs` 檔頭註解與 `AgentPathsSection.tsx` help text 更新路徑字串
- 後端 `agent_paths.rs::defaults()` 的 gemini project-relative 從 `.gemini/skills` 改為 `.agents/skills`
- 前端 `AgentPathsSection.tsx` 的 `DEFAULTS_FALLBACK` gemini projectRelative 同步更新

## Non-Goals

- 不修改 `AgentId` enum 值（維持 `"gemini"`）
- 不修改 agent 顯示名稱（gemini 是模型名，可沿用）
- 不修改 icon（已在 skill-editor-skill-list 指向 antigravity.png）
- 不修改 token analytics 的 gemini-cli parser（獨立議題）
- 不修改 project-relative 路徑 → ~~已移入 scope~~：gemini project-relative 從 `.gemini/skills` 改為 `.agents/skills`

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `agent-skills-schema`：gemini agent 的預設全域路徑變更，import scanner Antigravity probe 路徑修正

## Impact

- Affected specs: `agent-skills-schema`（delta spec 更新預設路徑描述）
- Affected code:
  - Modified: `src-tauri/src/commands/agent_paths.rs`（defaults + 註解）
  - Modified: `src-tauri/src/commands/skill_import.rs`（Antigravity probe 路徑 ×2）
  - Modified: `src/lib/components/settings/AgentPathsSection.tsx`（DEFAULT_PATHS + help text）
- 無新增、無刪除檔案
