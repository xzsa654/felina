## Context

目前使用者在新增 Skill 時，系統會直接產生預設的空白（或範本）檔案並轉導到編輯器。然而，沒有在第一時間強迫綁定 Target（同步落點），導致許多新手忘了去設定 Target，在後續執行 Push 時才發現沒有生效。為了解決這個問題，設計上決定在新增 Skill 的入口插入一個「Create Dialog」，要求使用者輸入名稱並設定初始 Target。

## Goals / Non-Goals

**Goals:**
- 在新增 Skill 時跳出包含名稱輸入與 Initial Target 選擇的 Dialog。
- 確保新建 Skill 的初始 Target 與其 Canonical Name 正確寫入檔案與 metadata。
- 複用現有的 Target 選擇元件，減少重複開發。

**Non-Goals:**
- 不涉及進階的參數設定（如 Anthropic effort、model 等），保持建立過程快速輕量。
- 不修改既有的 Target 同步機制與後端核心流程。

## Decisions

- **新增 `CreateSkillDialog` 元件**：在前端建立一個受控的 Dialog 元件，負責收集使用者輸入的 Skill Name 以及 Target。這樣能將建立邏輯封裝在組件內部，避免污染 `SkillsPage` 主流程。
- **前端依序呼叫現有 API**：為了避免變更後端架構，採取組合現有 Tauri commands 的做法。先呼叫 `canonical_skills_write` 建立 `SKILL.md`，接著呼叫 target 相關的 API (`skill_target_add` 或同等邏輯) 寫入 `.felina-sync-meta.json`。這能保持 React 層與 Rust 層的明確職責切分。

## Implementation Contract

- **Behavior**: 使用者點擊「新增 Skill」時，不再直接產生檔案，而是開啟 `CreateSkillDialog`。輸入檔名及選定 Target 並送出後，系統建立檔案及 Target meta，並導覽至該 skill 的編輯頁。
- **Interface / data shape**:
  - `CreateSkillDialog` 元件屬性。
- **Failure modes**: 當檔案名稱不合法或是發生 IO 錯誤時，在 Dialog 內顯示錯誤訊息，並阻斷關閉流程。
- **Acceptance criteria**:
  - 成功建立 Skill 並綁定選定的 Target，確認 `.felina-sync-meta.json` 內出現對應的 target 且狀態為 enable/tracked。
  - 建立後轉導正確。
  - 若使用者選擇 None，則只建立 Skill 不綁定 target。
- **Scope boundaries**: 僅新增前端元件及串接邏輯。後端 `canonical_skills.rs` 等底層邏輯與儲存格式不變。

## Risks / Trade-offs

- **[Risk] 前端多步呼叫的 Partial Failure** → 若建立 Skill 成功但設定 Target 失敗，會產生一個沒有 Target 的 Skill。
  - **Mitigation**: 對 Felina 來說，無 Target 的 Skill 依然是合法的狀態（可由使用者稍後補齊）。我們會在第二步發生錯誤時顯示 Toast，但依然將使用者轉導至建立好的 Skill 頁面，不需實作複雜的 Rollback。
