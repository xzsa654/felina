## Why

Project page 的 multi-source skill（同名 skill 存在多個 agent dir）目前只顯示灰色文字提示，使用者無法直接操作匯入。Skills page 的 Import Wizard 在 skill 數量多時資訊過度擁擠，且無法匯入 project-level agent dir 的 skills。按鈕標籤「匯入至 Global」造成語意混淆，實際目的地是 Felina canonical store。

## What Changes

- Project page 的 multi-source deferred row 改為可展開的 inline 選源 UI，使用者選定來源後直接匯入至 Felina。
- 按鈕標籤從「匯入至 Global」/「Import to global」改為「匯入至 Felina」/「Import to Felina」。
- Skills page 新增 Browse project import 入口：從已知 project list 選擇 project，複用 Project page 的 ManagedInventory import 邏輯，不維護兩套。
- Skills page Import Wizard UI 精簡：預設摺疊 body preview 和 diff summary，排序按決策優先級（多來源 → 有衝突單來源 → validation error → 無衝突單來源，同類別內字母排序）。

## Non-Goals

- 不改動 import conflict resolution 模型（overwrite/skip/rename 語意不變）。
- 不實作 arbitrary-folder import（從任意資料夾匯入，歸 skill-import-entrypoint-ux）。
- 不改動 backend import scan / apply 的 IPC contract（前端 UI 改動為主）。
- 不改動 fan-out push 邏輯。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: 更新 Import Wizard 排序邏輯和摺疊行為、ManagedInventory inline 選源 UI、Skills page Browse project import 入口。
- `projects-view`: ManagedInventory 按鈕標籤修正、multi-source deferred row inline 選源。

## Impact

- Affected specs: multi-agent-skills, projects-view
- Affected code:
  - Modified: src/lib/components/skills/SkillImportWizard.tsx
  - Modified: src/lib/components/skills/SkillsPage.tsx
  - Modified: src/lib/components/projects/ManagedInventory.tsx
  - Modified: src/lib/components/projects/managed-inventory.ts
  - Modified: src/lib/i18n/locales/en.ts
  - Modified: src/lib/i18n/locales/zh-TW.ts
  - New: none expected (reuse existing components)
  - Removed: none
- Dependencies: no new npm or Cargo dependency expected.
