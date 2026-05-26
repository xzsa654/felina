## Why

Felina 的 canonical skill store 採用 single-global-by-name flat namespace（`~/.felina/skills/<name>/`）。當不同 project 的 agent directory 各自存在同名但不同內容的 skill 時，import 流程缺少讓使用者做出知情選擇的機制——`ImportResolution` 的 KeepCanonical 與 Skip 行為完全相同（都是 no-op），wizard 無法預覽各來源版本的差異，且未被選為來源的同名 skill 在 import 後失去與 canonical 的關聯，變成潛在 orphan。

## What Changes

- **維持 single-global-by-name flat namespace**，確認不引入 project namespace 或 per-project canonical 分層。
- **Import wizard 增加多來源 diff 預覽與 conflict warning**：同名 skill 存在多個 agent/project 來源時，wizard 顯示各來源的內容差異，讓使用者在選擇前比較；若 canonical 已有同名 skill，multi-source row 也要顯示與單一來源一致的 conflict warning，避免使用者誤以為只是選來源而不是覆蓋風險。
- **Import conflict resolution 新增「選擇來源」語意**：使用者選定一個來源當 canonical 內容，其餘同名來源自動建立 disabled target，保留「Felina 知道那邊有這個 skill」的資訊，避免 prune scan 誤判為 orphan。
- **Disabled target 可查看 agent 端現有內容**：disabled target 提供入口讓使用者查看 agent-side 現有 SKILL.md 內容，而不只是 open-in-folder。
- **ImportResolution 語意釐清**：KeepCanonical 與 Skip 的冗餘行為合併或重新定義，消除語意重疊。

## Non-Goals

- 不引入 project namespace（如 `~/.felina/skills/<project-hash>/<name>/`）。
- 不改變 canonical identity key（維持 directory name 作為唯一 identity）。
- 不實作 forked overlay、three-way merge、或 agent-side 內容反向匯入 canonical。
- 不處理 marketplace / versioning 的 identity 擴展（Phase 3 scope）。
- 不改變非碰撞情境的 import 流程——單一來源無衝突的 import 行為不受影響。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: import conflict resolution 從 keep/overwrite/skip 擴展為包含「選擇來源 + 其餘來源建立 disabled target」的流程；disabled target 增加查看 agent 端現有 SKILL.md 內容的能力；ImportResolution enum 語意釐清。

## Impact

- Affected specs: multi-agent-skills
- Affected code:
  - Modified:
    - `src-tauri/src/commands/skill_import.rs`（ImportResolution 擴展、apply 邏輯調整）
    - `src/lib/tauri/commands.ts`（前端 wrapper 型別對齊）
    - `src/lib/types/skills.ts`（ImportResolution 前端型別）
    - `src/lib/components/skills/SkillsPage.tsx`（import wizard 多來源 diff 預覽 UI）
    - `src/lib/components/skills/TargetEditor.tsx`（disabled target 查看內容入口）
    - `src/lib/components/projects/ManagedInventory.tsx`（import 入口可能受 resolution 變更影響）
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
  - New: none expected
  - Removed: none
- Dependencies: 不新增 npm 或 Cargo dependency。
- Risk: ImportResolution enum 變更影響現有 import wizard 的 conflict UI 與 backend apply 邏輯，需確保非碰撞情境的 import 流程不受影響。本 change 與 `clarify-skill-import-conflicts`（#15）scope 有部分重疊，propose 階段需確認邊界。
