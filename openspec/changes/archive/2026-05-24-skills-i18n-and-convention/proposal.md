## Why

Skills 頁（9 個元件）和 Projects 頁（3 個元件）的 UI 文字目前全部硬編碼為英文，沒有使用既有的 i18n 系統（`useLocaleStore` + `t(locale, key)`）。Tokens 頁已經有完整的 en / zh-TW 雙語支援，但其他頁面沒有跟進。這造成兩個問題：

1. 使用者切換語言時 Skills / Projects 頁面不會變，體驗不一致。
2. 沒有開發規範，後續 change 繼續用硬編碼寫 UI 文字，i18n 債務持續累積。

## What Changes

- 在 `src/lib/i18n/locales/en.ts` 和 `zh-TW.ts` 新增 `skills` 和 `projects` 兩個 namespace 的 translation tree。
- 替換 Skills 頁 9 個元件（SkillsPage、SkillList、SkillEditor、TargetEditor、AddTargetDialog、SkillImportBanner、SkillImportWizard、PendingPushBar、CoverageMatrix）中約 32 處硬編碼 UI 文字為 `t(locale, key)` 呼叫。
- 替換 Projects 頁 3 個元件（ProjectsPage、ProjectsList、ManagedInventory）中約 3 處硬編碼 UI 文字。
- 建立開發規範：更新 CLAUDE.md，明確要求「新增/修改 UI 文字時一律使用 i18n key，不允許硬編碼」。
- 不翻譯 user/system data（skill 名稱、檔案路徑、agent ID、時戳、後端錯誤訊息）。

## Non-Goals

- 不處理 Settings 頁或其他頁面的 i18n（本 change 範圍限 Skills + Projects）。
- 不新增第三語言或 i18n 框架替換（繼續使用既有的 `t(locale, key)` 系統）。
- 不做 locale 自動偵測或語言切換 UI 改動（已有）。
- 不翻譯 Sidebar nav label（目前 Sidebar 文字由 navigation store 管理，獨立於頁面 i18n）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `app-pages`: 新增 i18n 開發規範條目——所有頁面 UI 文字須使用 `t(locale, key)`，不允許硬編碼。

## Impact

- Affected specs: `app-pages`（新增 i18n 規範 requirement）
- Affected code:
  - Modified:
    - `src/lib/i18n/locales/en.ts`（新增 `skills` + `projects` namespace）
    - `src/lib/i18n/locales/zh-TW.ts`（新增 `skills` + `projects` namespace）
    - `src/lib/components/skills/SkillsPage.tsx`
    - `src/lib/components/skills/SkillList.tsx`
    - `src/lib/components/skills/SkillEditor.tsx`
    - `src/lib/components/skills/TargetEditor.tsx`
    - `src/lib/components/skills/AddTargetDialog.tsx`
    - `src/lib/components/skills/SkillImportBanner.tsx`
    - `src/lib/components/skills/SkillImportWizard.tsx`
    - `src/lib/components/skills/PendingPushBar.tsx`
    - `src/lib/components/skills/CoverageMatrix.tsx`
    - `src/lib/components/projects/ProjectsPage.tsx`
    - `src/lib/components/projects/ProjectsList.tsx`
    - `src/lib/components/projects/ManagedInventory.tsx`
    - `CLAUDE.md`（Gotchas 段新增 i18n 開發規範）
  - New: 無
  - Removed: 無
- 無新增依賴（npm / Cargo 不動）
- 無破壞性變更；純 UI 文字替換，行為不變
- 無跨 change 依賴
