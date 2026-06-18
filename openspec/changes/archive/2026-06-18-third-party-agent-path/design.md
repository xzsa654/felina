## Context

Felina 的 agent path 系統目前以 sealed enum `AgentId { Anthropic, Codex, Gemini }` 為核心，貫穿整個 fan-out pipeline：`AgentPathsConfig`（三欄位 struct）、`pair_for()` / `renderer_for()`（match dispatch）、前端 `AgentId` union type、`AddTargetDialog` hardcoded 陣列、`TargetChips` icon lookup。要支援第三方 agent 需要打開這條完整路徑。

現有 Settings JSON 格式為 `{ anthropic: {...}, codex: {...}, gemini: {...} }`，migration 必須無感。

## Goals / Non-Goals

**Goals:**
- 使用者可在 Settings 新增無限多個 custom agent path entries（name + paths + optional label + optional icon）
- Custom agent 可在任何 skill 的 target 中選用，push 使用 generic renderer
- 刪除 custom agent path 時自動清理所有 skill 的對應 targets
- Built-in 三者不可刪除
- 舊版 Settings JSON 無感 migration

**Non-Goals:**
- Per-agent 自訂 YAML 欄位映射（`dynamic-agent-field-catalog`）
- Inline 新增 agent（只在 Settings 操作）
- 刪除 agent path 時自動清除 projectRelative 路徑的磁碟檔案（散落各 project，風險高）

## Decisions

### D1: AgentId 改為 String，不用 enum + Custom variant

用 `type AgentId = String` 而不是 `enum AgentId { Anthropic, Codex, Gemini, Custom(String) }`。原因：
- enum + Custom variant 讓所有現有 match 都要加 `Custom(_)` arm，但行為跟 default arm 一樣
- String 更簡單，built-in 識別用常數 `BUILTIN_AGENTS: &[&str] = &["anthropic", "codex", "gemini"]`
- 前端已經是 `type AgentId = "anthropic" | "codex" | "gemini"`，改為 `string` 最自然

### D2: AgentPathsConfig 序列化 migration

舊格式：`{ anthropic: {...}, codex: {...}, gemini: {...} }`（三個頂層 key）
新格式：`{ agents: { "anthropic": {...}, "codex": {...}, "gemini": {...}, "aider": {...} } }`

`agent_paths_get()` 讀取時：
1. 嘗試解析新格式（有 `agents` key）
2. 若失敗，嘗試解析舊格式（三個頂層 key），轉為新格式的 HashMap
3. 兩者皆失敗 → 使用 default（三個 built-in）

不做寫回 migration：下次使用者儲存任何 path 變更時自然寫為新格式。

### D3: AgentPathPair 擴充欄位

```rust
pub struct AgentPathPair {
    pub global: String,
    pub project_relative: String,
    pub label: Option<String>,   // 顯示名稱，如 "Aider"
    pub icon: Option<String>,    // 本機檔案路徑，如 "~/.felina/icons/aider.png"
}
```

`label` 和 `icon` 都是 optional，serde 用 `#[serde(default, skip_serializing_if = "Option::is_none")]`。Built-in agents 的 label/icon 留 None（前端用 hardcoded icon assets）。

### D4: GenericRenderer

新檔案 `src-tauri/src/commands/fan_out/generic.rs`，實作 `FanOutRenderer`：
- `render()`：寫 SKILL.md，frontmatter 只含 `name` + `description`（從 canonical skill 複製），body 原樣輸出
- 不產 sibling files（不像 Codex 會產 `agents/openai.yaml`）
- 不做 agent-specific 欄位轉換

`renderer_for()` 改為：
```
fn renderer_for(agent: &str) -> Box<dyn FanOutRenderer> {
    match agent {
        "anthropic" => Box::new(AnthropicRenderer),
        "codex" => Box::new(CodexRenderer),
        "gemini" => Box::new(GeminiRenderer),
        _ => Box::new(GenericRenderer),
    }
}
```

### D5: agent_path_remove command

新增 Tauri command `agent_path_remove(agent_key: String, clean_disk: bool)`：
1. 驗證 agent_key 不在 `BUILTIN_AGENTS` 中（拒絕刪除 built-in）
2. 掃描 canonical skills dir，對每個 skill 的 sync-meta-v2 移除 `agent == agent_key` 的 targets
3. 從 `AgentPathsConfig` HashMap 中移除該 key
4. 若 `clean_disk == true`：讀取被移除 entry 的 global path，展開 `~` 後刪除整個目錄（`fs::remove_dir_all`）
5. 回傳 `RemoveResult { skills_affected: u32, targets_removed: u32, disk_deleted: bool }`

磁碟清除只處理 global path。projectRelative 散落在各 project 底下，自動遍歷 known projects 刪除風險高且可能刪到不相關的同名目錄，因此不自動清除——前端在 dialog 中提示使用者手動清除。

### D5b: agent_path_removal_preview 共用路徑偵測

`agent_path_removal_preview(agent_key)` 除了回傳現有的 `skills` 和 `target_count`，新增 `shared_by: Vec<String>` 欄位。邏輯：
1. 讀取 `AgentPathsConfig`，取得待刪 agent 的 global path
2. 正規化後（展開 `~`、正斜線、去尾斜線）與其他所有 agent entries 的 global path 比較
3. 若有其他 agent 的正規化 global path 相同，將其 key 收集到 `shared_by`

前端根據 `shared_by`：
- 空 → checkbox 可勾選
- 非空 → checkbox disabled，顯示「此路徑正被 {shared_by} 使用，無法刪除磁碟檔案」

### D6: 前端刪除確認流程

更新 `RemoveAgentPathDialog`：
1. 呼叫 `agent_path_removal_preview(agent_key)` 取得影響清單（skills + targets 數量 + `shared_by`）
2. 顯示確認 dialog：列出受影響的 skills 和 targets
3. 新增「同時刪除磁碟檔案」checkbox（預設不勾）：
   - `shared_by` 為空 → checkbox 可勾選
   - `shared_by` 非空 → checkbox disabled，顯示提示「此路徑正被 {agents} 使用，無法刪除」
4. 若 checkbox 未勾選，補充提示「global path 目錄將保留於磁碟上」
5. 若有 projectRelative path，補充提示「各 project 下的 {projectRelative} 目錄需手動清除」
6. 確認後呼叫 `agent_path_remove(agent_key, clean_disk)`
7. 重新載入 agent paths config 和 skills store

### D7: icon 處理

- 前端 `AgentIcon` 組件：優先查 `agentPaths[agent].icon`（custom icon path），其次查 hardcoded `AGENT_ICON` map（built-in assets），最後 fallback 到 `label` 或 `agent` name 文字
- Icon path 透過 Tauri `convertFileSrc()` 轉為 webview 可用的 asset URL
- 不做 icon resize/crop，使用者自行提供合適尺寸的圖片

## Implementation Contract

### Behavior

- Settings → Agent Paths 顯示所有 agent entries（built-in + custom），按 built-in 在前、custom 在後排序
- 「+ Add Agent Path」打開 dialog，輸入 agent name（kebab-case，不可重複）、global path、project relative path，optional label 和 icon
- Custom agent entry 有 🗑 按鈕；點擊後顯示影響清單 dialog（含「同時刪除磁碟檔案」checkbox），確認後移除 config entry + 所有 skill 的對應 targets；若勾選清除磁碟且 global path 非共用，刪除該目錄
- Built-in entries 無 🗑 按鈕
- `AddTargetDialog` 的 agent dropdown 動態列出所有 config keys
- Push skill 到 custom agent target 時，使用 GenericRenderer 輸出標準 SKILL.md
- Drift check、pull、fork 流程對 custom agent 與 built-in 完全一致

### Interface / Data Shape

- `AgentPathsConfig`：`HashMap<String, AgentPathPair>`，序列化為 `{ agents: {...} }`
- `AgentPathPair`：`{ global, project_relative, label?, icon? }`
- `AgentId`：`String`（Rust `type AgentId = String`，TS `type AgentId = string`）
- `BUILTIN_AGENTS`：`["anthropic", "codex", "gemini"]`（不可刪除的 keys）
- `RemovalPreview`：`{ skills: Vec<String>, target_count: u32, shared_by: Vec<String> }`
- `RemoveResult`：`{ skills_affected: u32, targets_removed: u32, disk_deleted: bool }`
- New commands：`agent_path_remove(agent_key, clean_disk) -> RemoveResult`、`agent_path_removal_preview(agent_key) -> RemovalPreview`

### Failure Modes

- 嘗試刪除 built-in agent → 回傳 error string，前端 toast 顯示
- agent name 重複 → Add dialog 驗證攔截，不允許送出
- agent name 非 kebab-case 或含 `..` → `validate_pair()` 擴充驗證攔截
- icon 檔案路徑不存在 → 寫入 config 但 `AgentIcon` fallback 到文字，不報錯
- 舊格式 migration 失敗 → fallback 到三個 built-in default，不 crash

### Acceptance Criteria

- Settings 可新增 custom agent，在 AddTargetDialog 可選擇該 agent
- Push skill 到 custom agent target，磁碟上產出標準 SKILL.md
- 刪除 custom agent 後，所有 skill 的對應 targets 被清除，AddTargetDialog 不再列出該 agent
- 舊版 Settings JSON 讀取成功，不遺失 built-in 路徑設定
- `cargo test --lib` 通過，含新增的 migration / GenericRenderer / remove 測試
- `npm run check` 通過

### Scope Boundary

- In scope: agent path CRUD、generic renderer、target cleanup on delete、icon display、Settings JSON migration、刪除時 opt-in 清除 global path 磁碟目錄（含共用路徑偵測）
- Out of scope: dynamic field catalog、inline agent creation outside Settings、自動清除 projectRelative 磁碟檔案
