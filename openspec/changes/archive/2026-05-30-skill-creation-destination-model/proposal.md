## Why

目前使用者在建立新 Skill 時，常常會忘記進行 Target 設定，導致後續同步時才發現 Skill 沒有綁定落點，造成困惑。藉由在建立階段強制要求輸入名稱並選擇初始目標 (Initial Target)，可以確保每一個新建的 Skill 都擁有明確的預設落點，減少使用者的學習成本。

## What Changes

- 在點擊「新增 Skill」時，不再直接進入編輯器並產生無名稱的暫存檔案，而是跳出精簡的 **Create Skill Dialog**。
- 此對話框包含「Skill Name」輸入框，自動設定到 `skill.name` 與目錄名稱。
- 包含「Initial Target」下拉選單，直接複用現有 Target 選擇元件，可選擇 Global、特定 Project 或 None。
- 建立並綁定初始 Target 後，系統在背景初始化完成，接著轉導至編輯畫面。

## Non-Goals (optional)

- 不涉及在建立時就輸入所有 Agent 專屬屬性 (如 Anthropic 的 `effort` 等)，保持建立流程輕量化。
- 不改變既有 Target 的同步模式 (Tracked/Detached/Forked) 邏輯。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: 修改新增 Skill 的流程需求，加入 Create Dialog 及 Initial Target 選擇。

## Impact

- Affected specs: `multi-agent-skills`
- Affected code:
  - Modified: `src/lib/components/skills/SkillsPage.tsx` (或是負責新增按鈕的 Component)
  - Modified: `src/lib/tauri/commands.ts` (如果有新增 API)
  - Modified: `src-tauri/src/commands/canonical_skills.rs` (如果有初始化含 Target 的新建方法)
  - New: `src/lib/components/skills/CreateSkillDialog.tsx` (新增的對話框元件)
