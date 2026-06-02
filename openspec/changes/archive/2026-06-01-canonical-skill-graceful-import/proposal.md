## Problem

使用者從外部直接複製 Claude skill 到 `~/.felina/skills/<name>/` 時，`parse_skill_md` 因缺少 Felina 專屬的 `agents` frontmatter 欄位而回傳 `Err`，導致該 skill 完全不出現在清單中。實際上 SKILL.md 內容本身是完好的（有 `name`、`description`、body），只是缺少 Felina 的 multi-agent 欄位。

## Root Cause

`parse_skill_md` 呼叫 `take_required_agents(map)` 要求 `agents` 為必填欄位。外部 skill（例如從 `.claude/skills/` 複製而來）的 frontmatter 只有 `name` 和 `description`，沒有 `agents`，導致解析直接失敗。

此外，外部複製的 skill 也不會有 `.felina-sync-meta.json` sidecar，但這部分已有 backfill 邏輯（`read_sync_meta_v2` 對不存在的檔案回傳 default），不是阻塞問題。

## Proposed Solution

將 `agents` 從 hard-required 改為 graceful fallback：

1. `parse_skill_md`：`agents` 缺失時不回傳 `Err`，改為設為空陣列 `[]`
2. 前端 SkillList：`agents` 為空的 skill 歸入 Action Required 分組，顯示「未設定目標 agent」提示
3. SkillEditor：開啟 `agents` 為空的 skill 時，在 header 區域顯示提示 banner 引導使用者設定 agents

## Non-Goals

- 不自動推測 agent 來源（例如從來源目錄名稱推斷 `anthropic`）— 使用者應明確選擇
- 不做 git2 file watch 自動偵測外部新增（未來可做，但不是修復解析失敗的必要條件）
- 不修改 import scanner（`skill_import.rs`）的行為 — 那是從 agent-side 目錄掃描，不是從 canonical 目錄
- 不修改 fan-out 邏輯 — `agents` 為空時 fan-out 自然跳過（無目標），不需要特殊處理

## Success Criteria

- `parse_skill_md` 對僅有 `name` + `description` frontmatter 的 SKILL.md 回傳 `Ok`，`agents` 為空陣列
- 外部複製的 skill 出現在 SkillList 的 Action Required 分組
- SkillEditor 能正常開啟該 skill 並引導設定 agents
- 既有的含 `agents` 欄位的 skill 行為不受影響

## Impact

- Affected specs: `skill-library-management`（delta spec 更新 agents 欄位為 optional）
- Affected code:
  - Modified: `src-tauri/src/commands/canonical_skills.rs`（`parse_skill_md` agents fallback + 相關測試）
  - Modified: `src/lib/components/skills/SkillsPage.tsx`（SkillList Action Required 分組邏輯擴充）
  - Modified: `src/lib/components/skills/SkillEditor.tsx`（缺少 agents 的提示 banner）
  - Modified: `src/lib/i18n/locales/en.ts`（新增 i18n keys）
  - Modified: `src/lib/i18n/locales/zh-TW.ts`（新增 i18n keys）
