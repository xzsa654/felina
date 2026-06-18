## Why

Felina 目前只支援 Anthropic / Codex / Gemini 三個 hardcoded agent 的 skill 同步路徑。使用者無法將 canonical skill fan-out 到其他本地 agent 工具（如 Aider、Continue、自建 agent），限制了 Felina 作為多 agent skill 管理器的通用性。

## What Changes

### Backend（Rust）

- `AgentPathsConfig` 從固定三欄位 struct 改為 `HashMap<String, AgentPathPair>`，built-in 三者（anthropic/codex/gemini）不可刪除，作為 default entries
- `AgentPathPair` 擴充 optional `label`（顯示名稱）和 `icon`（本機檔案路徑，`.png`/`.svg`）欄位
- `AgentId` 從 sealed enum 改為 `String` type alias；現有 `match agent` dispatch 改為 built-in lookup + fallback
- 新增 `GenericRenderer` 實作 `FanOutRenderer`，輸出標準 SKILL.md（name + description + body），不做 agent-specific 欄位轉換，不產 sibling files
- `renderer_for()` dispatch：built-in agent → 專用 renderer，其他 → `GenericRenderer`
- 新增 `agent_path_remove` command：接受 agent key + `clean_disk` flag，掃描所有 skill 的 sync-meta 移除對應 targets；`clean_disk=true` 時額外刪除 global path 指向的整個目錄（projectRelative 不自動刪，提示使用者手動清除）
- `agent_path_removal_preview` 回傳 `shared_paths` 資訊：偵測其他 agent 是否共用相同 global path，前端據此決定是否允許勾選磁碟清除
- `validate_pair()` 驗證邏輯不變，適用所有 agent entries

### Frontend（React）

- `AgentId` type 從 union literal 改為 `string`
- Settings → `AgentPathsSection`：從固定 3 列改為動態清單，built-in 不可刪、custom 可刪（🗑），新增「+ Add Agent Path」按鈕
- Add Agent Path dialog：輸入 agent name（kebab-case）、global path、project relative path、optional label、optional icon（file picker）
- 刪除 custom agent 前顯示影響清單（N 個 skill 的 M 個 targets 會被移除），提供「同時刪除磁碟檔案」checkbox（共用路徑時 disabled 並顯示提示），確認後呼叫 `agent_path_remove` command
- `AddTargetDialog`：agent dropdown 從 `agentPaths` config keys 動態產生，不提供 inline 新增
- `TargetChips` / `AgentIcon`：custom agent 查 icon path 顯示圖示，無 icon 時 fallback 到 label 或 agent name 文字

### Drift / Push / Pull

custom agent targets 的 drift 判定、push、pull 流程與 built-in 完全相同，不需額外處理。

## Non-Goals

- Dynamic agent field catalog（per-agent 自訂 YAML 欄位映射）——屬 backlog `dynamic-agent-field-catalog`，不在本次範圍
- 在 Add Target dialog 或 Skill Editor 中 inline 新增 agent path——新增/刪除只在 Settings 操作
- 刪除 agent path 時自動清除 projectRelative 路徑的磁碟檔案——散落各 project，風險高，僅提示手動清除

## Capabilities

### New Capabilities

- `custom-agent-path`: 使用者可在 Settings 新增、編輯、刪除第三方 agent 路徑，fan-out 使用 generic renderer，刪除時清理對應 targets 並可選擇清除 global path 磁碟目錄

### Modified Capabilities

- `felina-settings-page`: Agent Paths 區塊從固定 3 列改為動態清單，支援新增/刪除 custom entries
- `multi-agent-skills`: AgentId 改為開放 string type，fan-out dispatch 支援 generic fallback

## Impact

- Affected specs: `custom-agent-path`（new）、`felina-settings-page`（modified）、`multi-agent-skills`（modified）
- Affected code:
  - Modified: `src-tauri/src/commands/agent_paths.rs`、`src-tauri/src/commands/fan_out/mod.rs`、`src-tauri/src/commands/canonical_skills.rs`、`src-tauri/src/lib.rs`、`src/lib/types/skills.ts`、`src/lib/types/index.ts`、`src/lib/components/settings/AgentPathsSection.tsx`、`src/lib/components/skills/AddTargetDialog.tsx`、`src/lib/components/skills/TargetChips.tsx`、`src/lib/components/skills/AgentFieldsEditor.tsx`、`src/lib/tauri/commands.ts`
  - New: `src-tauri/src/commands/fan_out/generic.rs`、`src/lib/components/settings/AddAgentPathDialog.tsx`、`src/lib/components/settings/RemoveAgentPathDialog.tsx`
  - Removed: 無
- 無新增 npm / Cargo 依賴
- **BREAKING**：`AgentId` 從 enum 改為 String，所有 `match agent` exhaustive pattern 需改為 if-else 或 HashMap lookup + default fallback。`AgentPathsConfig` 序列化格式從 `{ anthropic: {...}, codex: {...}, gemini: {...} }` 改為 `{ agents: { anthropic: {...}, codex: {...}, gemini: {...} } }`——需處理舊格式 migration
