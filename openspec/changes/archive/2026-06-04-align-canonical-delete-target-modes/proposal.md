## Problem

Canonical Skill 刪除 Dialog 與現行刪除規格仍只把 `enabled + tracked` target 視為可連動刪除，但 Auto Sync 模式已將使用者可操作的受管理 target 改為 `auto` 與 `manual`，並將舊 `tracked` 值定義為 `manual` 的永久 alias。結果是啟用中的 `auto` / `manual` target 不會出現在 Cascade 摘要中，Cascade 甚至可能被錯誤停用，造成 UI 與使用者目前看到的 target 狀態不一致。

## Root Cause

`skill-target-lifecycle-safety` 建立 Cascade / Detach / Cancel 政策時，以當時的 `enabled + tracked` 模型定義可連動刪除範圍。後續 `auto-sync-mode` 擴充 `TargetMode` 為 `auto` / `manual`，並保留 `tracked` 作為 legacy alias，但 canonical delete 的前端資格判斷、後端刪除判斷與主規格未同步更新。

## Proposed Solution

- 將 canonical Cascade delete 的 eligible target 定義改為「`enabled=true` 且 mode 為 `auto`、`manual` 或 legacy `tracked` 的受管理 target」。
- 明確保留 `enabled=false`、`detached` 與 `forked` targets，不納入 Cascade count、path summary 或實際刪除。
- 讓前端 `DeletePolicyDialog` 與後端 policy-aware delete command 使用相同 eligibility 語意。
- 更新刪除 Dialog 文案，避免繼續向使用者顯示已過時的「啟用且 tracked」描述。
- 補充前端純函式測試與 Rust filesystem tests，覆蓋 auto、manual、legacy tracked、disabled、detached、forked targets。

## Success Criteria

- 啟用的 `auto`、`manual` 與 legacy `tracked` targets 都會列入 canonical delete Dialog 的 Cascade count 與摘要。
- 當至少一個啟用的 `auto`、`manual` 或 legacy `tracked` target 存在時，Cascade 按鈕可使用。
- 選擇 Cascade 時，後端只刪除上述 eligible targets 與 canonical directory。
- Disabled、detached 與 forked targets 的 agent-side directories 保持不變。
- 前端摘要、按鈕狀態與後端實際刪除結果使用一致的 eligibility 規則。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: 將 Explicit Canonical Delete Policy 從舊的 enabled tracked 定義，對齊現行 auto / manual / legacy tracked target mode 模型。

## Impact

- Affected specs: `multi-agent-skills`
- Affected code:
  - Modified:
    - `src/lib/components/skills/DeletePolicyDialog.tsx`
    - `src/lib/components/skills/sync-status-utils.ts`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
    - `src-tauri/src/commands/canonical_skills.rs`
    - `tests/sync-status-utils.test.ts`
  - New: none expected
  - Removed: none
- Dependencies: 不新增 npm 或 Cargo 依賴。
- File structure: 不變更檔案結構。
- Breaking changes: 無；legacy `tracked` targets 維持可連動刪除。
- Backward compatibility: 擴大 Cascade eligibility 至現行受管理的 `auto` / `manual` targets，修正既有 UI 與刪除行為偏差。
- Cross-change dependency: 依賴已封存的 `skill-target-lifecycle-safety` 與 `auto-sync-mode` 所建立的政策與 target mode 模型。
