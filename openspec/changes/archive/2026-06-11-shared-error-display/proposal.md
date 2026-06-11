## Why

各頁面的錯誤呈現方式不一致且多處直接把後端 raw error 丟給使用者：Skills 與 Projects 用 `window.alert(...)`（阻斷式、無法複製、不符 app 視覺語彙），Skills/Settings/Hub/Tokens 多處將裸 `String(e)` 直接渲染（無 i18n 標題、使用者看到未翻譯的技術訊息）。專案 i18n 慣例是「backend error payload 保留 verbatim，但 UI 框架文字必須走 t(locale, key)」，目前沒有共用元件承載這個慣例，導致每頁各自發明。

## What Changes

- 新增共用錯誤呈現元件 `ErrorNotice`（`src/lib/components/shared/ErrorNotice.tsx`）：
  - 呈現結構 = i18n 標題（caller 提供 key）+ verbatim detail（後端 error payload 原文，monospace、可選取複製）
  - inline 區塊形式（danger 語意色），不是 modal；不阻斷操作
  - detail 可摺疊：標題永遠可見，過長 detail 收合
- 新增對應 i18n keys（`common.error.*` namespace，en + zh-TW 同步）
- 遷移既有錯誤呈現到 `ErrorNotice` 或「i18n 標題 + verbatim detail」模式：
  - Skills：`SkillsPage.tsx` 的 push preview / push confirm `window.alert(String(e))`；`TargetPopover.tsx` 的 fork preview 與 open folder 裸 `String(e)`；`TargetEditor.tsx` 的 open folder 裸 `String(e)`；三檔中其餘 `window.alert(t(...))` 一併改為非阻斷呈現
  - Projects：`ProjectsList.tsx` 移除失敗的 `window.alert`
  - Settings：`AgentPathsSection.tsx`、`SkillLibrarySection.tsx` 的裸 `String(e)` 顯示
  - Hub：`LoginDialog.tsx` 登入錯誤、`HubPage.tsx` 刪除錯誤的未本地化訊息
  - Tokens：`TokensPage.tsx` 的 `String(queryError)` 錯誤橫幅
- 遷移完成後 `src/lib/components/` 內不再有任何 `window.alert` 呼叫

## Non-Goals

- Memory 與 History 頁面的錯誤呈現：兩頁缺整頁 i18n，由後續 i18n change 一併用本元件收掉
- 已在樣式化錯誤區塊內顯示 `String(e)` 的站點（如 `ManagedInventory.tsx`、`SkillEditor.tsx`、`ImportStagingDialog.tsx`、`skills-store.ts` 的 store error state）：呈現容器已存在且非阻斷，全面換裝屬大規模 UI 重構，不在本 change 範圍；後續可逐步採用
- Toast / notification 系統：不引入全域 toast；錯誤就地呈現
- 後端 error payload 格式變更：detail 維持 verbatim，不解析、不翻譯

## Capabilities

### New Capabilities

- `shared-error-display`: 共用錯誤呈現元件的結構（i18n 標題 + verbatim detail）、非阻斷行為，以及「UI 元件程式碼不得使用 window.alert 呈現錯誤」的約束

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `shared-error-display`
- Affected code:
  - New: src/lib/components/shared/ErrorNotice.tsx
  - Modified:
    - src/lib/i18n/locales/en.ts
    - src/lib/i18n/locales/zh-TW.ts
    - src/lib/components/skills/SkillsPage.tsx
    - src/lib/components/skills/TargetPopover.tsx
    - src/lib/components/skills/TargetEditor.tsx
    - src/lib/components/projects/ProjectsList.tsx
    - src/lib/components/settings/AgentPathsSection.tsx
    - src/lib/components/settings/SkillLibrarySection.tsx
    - src/lib/components/hub/LoginDialog.tsx
    - src/lib/components/hub/HubPage.tsx
    - src/lib/components/tokens/TokensPage.tsx
  - Removed: (none)
- 無新增 npm / Cargo 依賴；純前端變更，不動 Rust 層
- 風險：低。非破壞性 UI 變更；主要風險是遷移站點漏改造成呈現不一致，以 `window.alert` grep 歸零作為驗證條件
