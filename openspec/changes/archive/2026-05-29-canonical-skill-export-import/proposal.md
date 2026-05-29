## Why

目前 Felina 沒有任何方式讓使用者備份或還原整個 canonical skill 庫（`~/.felina/skills/`）。如果使用者想重灌環境、遷移到新機器、或清空技能庫重新開始，只能手動複製資料夾。需要一個內建的匯出/匯入/重置功能，讓使用者能安全地管理整個 skill 庫的生命週期。

## What Changes

- 在 Felina Settings 頁面新增獨立的「Skill Library」section
- **全部匯出**：將 `~/.felina/skills/` 下所有 skill 打包為單一 ZIP 檔。匯出時排除 `.felina-sync-meta.json`（target 綁定為機器/專案特定）和 `.git/`（snapshot repo，匯入後自動重建）。ZIP 結構為 `<skill-name>/SKILL.md` 加上該 skill 的所有子目錄與檔案
- **匯入**：從 ZIP 檔還原 skills 到 `~/.felina/skills/`。匯入時系統自動 backfill `.felina-sync-meta.json`（由 `read_sync_meta_v2` 從 SKILL.md frontmatter 產生）。同名 skill 需提示使用者選擇覆寫或跳過
- **重置**：清空整個 `~/.felina/skills/` 目錄（保留目錄本身與 `.git/`）。操作前以確認對話框警告，建議使用者先匯出備份

## Non-Goals

- 不做單一 skill 匯出/匯入（現有 skill import 已處理單一 agent 端匯入）
- 不做雲端備份/同步
- 不在 ZIP 內保留 `.felina-sync-meta.json`，因為 target 綁定的 project 路徑和 agent 設定為機器特定，匯入到其他環境後無意義
- 不匯出 `.git/` snapshot repo，匯入後首次 push 會自動重建

## Capabilities

### New Capabilities

- `skill-library-management`: Felina Settings 內的 Skill Library section，提供全部匯出（ZIP）、匯入（ZIP 還原）、重置（清空庫）功能

### Modified Capabilities

- `felina-settings-page`: 新增 Skill Library section 到 Felina Settings 頁面

## Impact

- Affected specs: `skill-library-management`（新建）、`felina-settings-page`（修改）
- Affected code:
  - New: `src-tauri/src/commands/skill_library.rs`（後端匯出/匯入/重置 commands）
  - New: `src/lib/components/settings/SkillLibrarySection.tsx`（前端 section 元件）
  - Modified: `src/lib/components/settings/FelinaSettingsPage.tsx`（掛載新 section）
  - Modified: `src/lib/tauri/commands.ts`（新增 invoke wrappers）
  - Modified: `src-tauri/src/commands/mod.rs`（註冊新模組）
  - Modified: `src-tauri/src/lib.rs`（invoke_handler 註冊）
  - Modified: `src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`（i18n keys）
- 新增依賴: `zip` crate（Cargo，用於 Rust 端 ZIP 打包/解壓）
- 無破壞性變更、無跨 change 依賴
- 風險：重置操作為不可逆的破壞性動作，需確認對話框保護
