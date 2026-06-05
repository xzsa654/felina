## Why

Hub install 目前在程式上是獨立解 tar.gz 的路徑，但產品語意上它應該等同於 Skills page 的 import：只是來源從 agent-native directory 變成 Hub package。若兩條路徑長期分裂，canonical 寫入規則、驗證、防 traversal、sync-meta 初始化與錯誤處理都會逐漸不一致。

Hub 瀏覽也不應停在卡片牆。使用者瀏覽內部 Skill 市集時，預期心智更接近 Skills page：左側列表快速掃描，右側看選中 Skill 的內容與狀態，再決定安裝或更新。

## What Changes

- Hub install 的 backend pipeline 改成共用 Skills import/canonical 寫入語意：Hub package 解包後不得直接散落寫檔，而要通過共用 helper 產生 canonical Skill 目錄與 metadata。
- 共用 helper 需保留 Hub install 既有安全邊界：拒絕 symlink/hardlink、absolute path、path traversal，並排除或重建 publisher-local `.felina-sync-meta.json`。
- Hub 頁面改為 split view 瀏覽：初始仍可顯示市場列表；點選任一 Skill 後進入左側 Skill list、右側 readonly preview 的布局，與 Skills page 的瀏覽方式一致。
- Hub preview 顯示 Skill metadata、描述、版本、contentHash/up-to-date 狀態、安裝/更新 action，並避免使用可編輯 canonical editor。
- Install 成功後 refresh local canonical list 與 Hub installed state，讓右側 preview 與左側 list 狀態立即同步。狀態更新 SHALL 透過重算 `fan_out::directory_hash` 並與 server `contentHash` 比對得出，不可僅憑 install 回傳成功就 optimistic 標 up-to-date。
- Hub refresh 按鈕沿用 Skills page 的 interaction shape（按鈕位置、spinner、disabled 狀態、preserve selection），但 reload body 只重抓 market list + 重算 local directory hash，不可呼叫 drift scan、import count、canonical entries reload 等編輯期 hook。

## Non-Goals

- 不做 Hub Skill 編輯器；Hub preview 必須 readonly。
- 不做 search ranking、詳細頁 URL deep link、author attribution、authz、install confirm dialog、uninstall（本地移除）。
- Hub preview MUST NOT expose server-side delete action — `delete_market_skill` command 已存在但屬於跨責任範疇（影響所有使用者），不在本 change scope。
- 不改 market-server storage schema 或 publish API。
- 不改 Skills page 既有 import staging UX，只抽出可共用的 install/import 寫入語意。
- 不在 canonical skill 的 `.felina-sync-meta.json` 寫入 `directoryHash` 欄位 — `hub-publish-enablement` 已改成即時計算，本 change 沿用該決定，不重新引入快取欄位。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `mock-install-flow`: Hub install SHALL share the same canonical import/write semantics as Skills page import instead of maintaining an independent archive extraction writer.
- `hub-ui-navigation`: Hub browsing SHALL support a Skills-page-like split view with a readonly market Skill preview after selecting a skill.

## Impact

- Affected specs: `mock-install-flow`, `hub-ui-navigation`
- Affected code:
  - New:
    - `src-tauri/src/commands/skill_package.rs`
    - `src/lib/components/hub/MarketSkillList.tsx`
    - `src/lib/components/hub/MarketSkillPreview.tsx`
  - Modified:
    - `src-tauri/src/commands/market_install.rs`
    - `src-tauri/src/commands/skill_import.rs`
    - `src/lib/components/hub/HubPage.tsx`
    - `src/lib/tauri/commands.ts`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
  - Removed: (none)
- Dependencies: no new npm or Cargo dependency expected.
- Backward compatibility: existing installed Hub Skills remain readable; future installs should produce the same canonical directory shape and sync-meta semantics as import.
