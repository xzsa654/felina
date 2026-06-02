## Why

`SettingsPage`（`/settings`）與 `TemplatesPage`（`/templates`）兩支 legacy 頁面在現行 UI 中已被取代或無實質功能：

- `SettingsPage` 為早期 Claude global/project/local settings 編輯器，現已由 `FelinaSettingsPage`（`/felina-settings`）負責 Felina 主要設定，Sidebar 上的 Settings 入口指向的是 legacy 版本。
- `TemplatesPage` 是個空殼：唯一功能是開啟 `TemplateGallery` overlay 並預覽選中樣板的 content，**未**與 Felina 的 canonical skill / fan-out 主流程整合（gallery 的 `onselect` 只回傳物件，TemplatesPage 不做任何寫入）。經評估，gallery 的 6 個 skill 樣板缺乏 Felina 特有的 multi-agent / fan-out target 資訊，不值得整合到 SkillsPage；其餘 22 個 hook/mcp/rule/agent 樣板的 active consumer 為 retained-for-reference 頁面，當前無 active 路徑使用。

依 Rule 2 Simplicity First：legacy + 空殼 + 無接續計畫的 active code 應移除。

實作過程中發現 retained-for-reference 的 `hooks.rs` / `mcp.rs` 依賴 `commands::settings::{read,write}_settings` 作為 settings.json I/O 基礎設施，若維持 settings.rs 為 retained 會留下「為 retained 而存在的 retained」死鏈。經使用者拍板選擇深層退役方案：一併把 hooks / mcp 從 retained-for-reference 移除，讓 settings.rs 能完整刪除而不留耦合。

## What Changes

- **移除 `SettingsPage`** 及其專屬 sub-components（`GeneralSettings`、`PermissionsEditor`、`EnvVarsEditor`），以及後端 `commands::settings`（`read_settings` / `write_settings`）
- **移除 `TemplatesPage`** 與共用元件 `TemplateGallery`（含其硬編碼 `TEMPLATES` 字典）
- **退役 retained-for-reference 的 `hooks` 與 `mcp`**（後端 `commands::hooks` / `commands::mcp`、前端 `src/lib/components/hooks/` / `src/lib/components/mcp/`、`commands.ts` 的 `api.hooks` / `api.mcp` wrapper）以解除對 `settings` 的耦合
- 清理 `src-tauri/src/paths.rs` 中僅供 settings / mcp 使用的 5 個 helper（`global_settings_path`、`project_settings_path`、`project_local_settings_path`、`project_mcp_json_path`、`claude_desktop_config_path`）
- 更新 `CLAUDE.md` 的 retained-for-reference 段落：清單從 `hooks / instructions / mcp / rules / budget / stats` 縮減為 `instructions / rules / budget / stats`
- 更新 `src/router.tsx`：移除 `/settings`、`/templates` route 與 lazy import
- 更新 `src/lib/stores/navigation.ts`：自 `Page` type 與 `NAV_ITEMS` 移除 `settings`、`templates` 兩個項目
- 更新 `src/lib/components/layout/Sidebar.tsx`：自 `ICON_MAP` 移除 `gear`、`templates` 鍵；`Settings` lucide import 保留（仍由 QuickSettings 觸發按鈕使用）
- 更新 `src/lib/tauri/commands.ts`：移除 `api.settings` / `api.hooks` / `api.mcp` namespace 與其 type imports（`SettingsScope` / `HookEventConfig`）
- 更新 `src-tauri/src/commands/mod.rs` 與 `src-tauri/src/lib.rs`：移除 `pub mod settings;` 與 `invoke_handler!` 中的 `read_settings` / `write_settings` 註冊
- 連帶清理 `src/lib/components/shared/OnboardingWelcome.tsx`（兩個 `page: "settings"` / `page: "templates"` step）與 `src/lib/components/shared/CommandPalette.tsx`（ICON_MAP 死鍵 + unused imports）
- 清理 `src/lib/i18n/locales/en.ts` 與 `zh-TW.ts` 中僅被移除頁面 / 元件使用的 i18n key（實際 audit 後發現 legacy 頁面用 hardcoded 字串、無 i18n key 殘留）
- **清理 orphan 型別:** `src/lib/types/hooks.ts` 整檔刪、`src/lib/types/settings.ts` 整檔刪、`src/lib/types/index.ts` 移除對應 re-export、`src/lib/utils/achievements.ts` 整檔刪（upstream Glyphic baseline 殘留、零 caller，與 `Settings` 型別構成 dead-引用-dead 鏈）
- **不動**：`FelinaSettingsPage`、`QuickSettingsPopover`（仍由 Sidebar 觸發）、`commands::budget`（被 tokens 頁 `AgentQuotaPanel` 使用）、`commands::instructions` / `commands::rules` / `commands::stats`（維持 retained-for-reference，無耦合 settings）

## Non-Goals

- 不退役 retained-for-reference 的 `instructions` / `rules` / `budget` / `stats`（這四者與 settings 無耦合，維持 retained 政策）
- 不改動 `FelinaSettingsPage` 的任何行為或範圍
- 不在 SkillsPage 新增「從樣板建立 skill」流程；若未來要做，另開 change
- 不處理 `openspec/specs/app-pages/spec.md`、`openspec/specs/app-routing/spec.md` 內提及 `TemplatesPage.svelte` 等舊 Svelte 命名的歷史殘留（僅針對本 change 涉及的 requirement 做 delta）
- 不擴及 `MemoryPage`、`HistoryPage` 等其他可能 underused 頁面
- 不為 `/settings` 或 `/templates` 保留 redirect

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-routing`: 移除 `/settings` 與 `/templates` 兩條 route 的註冊與 page id 對應
- `app-pages`: `Registered Pages` 由六頁縮減為四頁（`skills`、`tokens`、`memory`、`history`，加上既有的 `projects` 為五頁 — 以實際 NAV_ITEMS 為準）

## Impact

- Affected specs: `app-routing`, `app-pages`
- Affected code:
  - Removed:
    - src/lib/components/settings/SettingsPage.tsx
    - src/lib/components/settings/GeneralSettings.tsx
    - src/lib/components/settings/PermissionsEditor.tsx
    - src/lib/components/settings/EnvVarsEditor.tsx
    - src/lib/components/templates/TemplatesPage.tsx
    - src/lib/components/shared/TemplateGallery.tsx
    - src/lib/components/hooks/HooksPage.tsx
    - src/lib/components/hooks/HookCard.tsx
    - src/lib/components/mcp/McpPage.tsx
    - src-tauri/src/commands/settings.rs
    - src-tauri/src/commands/hooks.rs
    - src-tauri/src/commands/mcp.rs
    - src/lib/types/hooks.ts
    - src/lib/types/settings.ts
    - src/lib/utils/achievements.ts
  - Modified:
    - src/router.tsx
    - src/lib/stores/navigation.ts
    - src/lib/components/layout/Sidebar.tsx
    - src/lib/components/shared/OnboardingWelcome.tsx
    - src/lib/components/shared/CommandPalette.tsx
    - src/lib/tauri/commands.ts
    - src/lib/types/index.ts
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/paths.rs
    - src/lib/i18n/locales/en.ts
    - src/lib/i18n/locales/zh-TW.ts
    - CLAUDE.md
- Dependencies: 無新增 npm / Cargo 依賴
- Breaking changes: 無對外 API；對使用者影響為 Sidebar 上的 Settings / Templates 兩項目消失，及 `/settings`、`/templates` URL 失效（不保留 redirect）。retained-for-reference 的 hooks / mcp 模組退役屬內部清理，無前端 active route 影響。
- Backward compatibility: 不保留任何相容路徑
