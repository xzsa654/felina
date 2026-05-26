## Problem

Projects page 的 managed inventory 目前把每個 agent chip 當成「selected project 內對應 agent 目錄是否有同名 SKILL.md」。這會漏掉同名 global canonical skill 已經為其他 agent 設定 target 的情況，導致同一個 skill 在 Skills page 可見的 target summary 與 Projects page 的 project summary 不一致。

## Root Cause

`src/lib/components/projects/ManagedInventory.tsx` 已同時載入 project-local scan 與 global canonical list，但 `agentsPresent` 只由 `skill_import_scan(projectPath)` 的結果填入。Global canonical skill 的同名 target agents 只用來判斷 `managed` 或 import overwrite conflict，沒有合併進 per-agent chip summary。

## Proposed Solution

- 保留 Projects page 的 row 粒度：每列仍代表 selected project 視角下的一個 skill name。
- 修改 managed inventory 的 per-agent chip 語意：chip SHALL 表示該 skill name 對該 agent 在此 project 視角下可用，來源包含 project-local agent skill presence，以及同名 global canonical skill 的 enabled/tracked targets。
- 對同名 global canonical skill，使用 canonical directory identity 與 project scan 的 skill folder name 比對，避免 parsed YAML `name` drift 造成錯配。
- 保留 `Managed` label 的既有語意：只有 canonical target 指向 selected project 時才顯示 Managed；global-only 同名 target 不應讓該 row 被誤標成 Managed。
- 不新增 backend command；前端用現有 `skill_import_scan(projectPath)` 與 `canonical_skills_list` 合併資料。
- 新增/調整前端單元級 helper 或測試覆蓋 row 合併規則，並用 `npm run check` 驗證。

## Non-Goals

- 不在 Projects page 直接編輯 targets、加入 target、刪除 skill、或推送 skill；這些仍由 Skills page / TargetEditor 負責。
- 不改變 `skill_import_scan` 的 backend contract；它仍只描述 agent-native skill files discovered in the requested scan scope。
- 不把 disabled、detached、forked targets 視為 chip present；它們不是目前可用的 tracked target。
- 不改變 import apply 行為；若 row 真的是 unmanaged 且沒有同名 canonical，仍可匯入到 global canonical。

## Success Criteria

- 若 selected project 只有 `<project>/.claude/skills/foo/SKILL.md`，而 global canonical `foo` 有 enabled/tracked `codex:global` 與 `gemini:global` targets，Projects page 的 `foo` row SHALL 顯示 claude、codex、gemini 三個 chips present。
- 若 global canonical `foo` 只有 disabled 或 detached `codex:global` target，Projects page 的 `foo` row SHALL NOT 因該 target 把 codex chip 顯示為 present。
- 若 global canonical `foo` 有 enabled/tracked project target 指向 selected project，row 仍 SHALL 顯示 Managed 並可點擊跳轉 Skills page `?select=foo`。
- 若同名 canonical 存在但沒有 target 指向 selected project，row SHALL NOT 顯示 Managed；但同名 enabled/tracked global target agents SHALL 仍納入 chip summary。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `projects-view`: Managed Inventory View 的 per-agent chips 從「只顯示 selected project agent directory presence」改為「顯示 project-local presence 與同名 global canonical enabled/tracked target agents 的合併可用性」。

## Impact

- Affected specs: `projects-view`
- Affected code:
  - Modified:
    - `src/lib/components/projects/ManagedInventory.tsx`
    - `src/lib/types/skills.ts`
  - New:
    - `src/lib/components/projects/managed-inventory.ts`
  - Removed: none
- Dependencies: no new npm or Cargo dependencies.
- Backend: no new Tauri command and no Rust command contract change expected.
- Compatibility: existing project-local only rows keep their behavior; global canonical target agents only add missing chip visibility for same-name rows.
