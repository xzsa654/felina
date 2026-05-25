## Why

每個頁面目前疊了兩層頁首:`src/router.tsx` 的 `AppLayout` 對所有頁面渲染一個全域 `src/lib/components/layout/Header.tsx`(硬編碼英文標題 + 描述,無 icon、無操作按鈕、不走 i18n),而正在開發的頁面(skills / projects)又各自渲染 `PageScaffold` 的 `PageHeader`(含 icon、操作按鈕、i18n),tokens 則有自己的 inline `<h1>`。結果是同一個頁面出現兩個標題(例如 Skills 頁同時出現「Skills / Custom skills and agent definitions」與「Skills / Agent Skills 的單一管理來源…」),不僅重複,全域 `Header` 那條頂欄還白白吃掉垂直空間,壓縮了主視覺。

## What Changes

- **移除全域 app 頂欄 `Header`**:從 `AppLayout`(`src/router.tsx`)移除 `<Header />` 與其 import,並刪除 `src/lib/components/layout/Header.tsx`(含其中的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map)。釋放出整條頂欄的垂直高度給主內容。
- **已開發頁面不需改動**:skills / projects 已自帶 `PageHeader`,tokens 已自帶 inline `<h1>` 標題;移除全域 `Header` 後,這三頁各自只剩單一標題,重複消失、空間釋放。
- **舊頁面補最小佔位標題**:settings / memory / history 目前唯一的標題來源就是全域 `Header`,移除後會變成無標題頁。為它們各補一個**最小的硬編碼 inline 標題**作為佔位,避免無標題,但不接 i18n、不加 icon、不導入 `PageHeader` 機制(這些頁屬於舊 app、尚未重做,等正式重做時再處理)。
- **更新 `app-pages` spec**:目前 spec 將「`Header.tsx` 的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map」列為導覽註冊的一致性來源之一;`Header.tsx` 移除後此來源不再存在,需把一致性契約從「四個來源」改為「三個來源」(`src/router.tsx` 路由表、`src/lib/stores/navigation.ts` 的 `NAV_ITEMS` 與 `Page` type),並移除所有對 Header map 的引用。

## Non-Goals

- **不為舊頁(settings / memory / history)導入 i18n、icon 或 `PageHeader`**:這些頁面尚未重做,只補最小硬編碼標題佔位,刻意不投資。將來各頁正式重做時再補完整頁首與 i18n。
- **不改動 tokens 頁的版面結構**:tokens 的 inline `<h1>` 與其下方 tab 列是一體設計,本次保留原樣,不改寫成 `PageHeader`。移除全域 `Header` 後它自然只剩單一標題。
- **不調整 skills / projects 的 `PageHeader` 內容或樣式**:本次只是讓它們成為唯一頁首,不動標題文字、icon 或按鈕。
- **不重新設計 Sidebar 或導覽結構**:導覽項目集合不變,僅移除頁面內容區上方的全域標題列。
- **被否決的替代方案**:保留全域 `Header`、改而刪除各頁 `PageHeader` 的標題塊 —— 否決,因為 `PageHeader` 還掛著 icon 與各頁專屬操作按鈕(reload / import / new),無法搬進不知道各頁 context 的共用 `Header`,且 `Header` 是硬編碼英文、不符 i18n 規範。只改 `Header` 描述字串 —— 否決,無法消除重複也釋放不到空間。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-pages`: 導覽註冊一致性契約從「四個來源(含 `Header.tsx` 的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS`)」改為「三個來源(`src/router.tsx`、`NAV_ITEMS`、`Page` type)」;新增「每個註冊頁面自行提供頁首/標題,app 不再渲染全域標題列」的契約。

## Impact

- Affected specs: `app-pages`(modified)
- Affected code:
  - Modified:
    - `src/router.tsx`(移除 `Header` import 與 `AppLayout` 中的 `<Header />`)
    - `src/lib/components/settings/SettingsPage.tsx`(補最小 inline 標題)
    - `src/lib/components/memory/MemoryPage.tsx`(補最小 inline 標題)
    - `src/lib/components/history/HistoryPage.tsx`(補最小 inline 標題)
  - Removed:
    - `src/lib/components/layout/Header.tsx`
- 不新增 npm / Cargo 依賴。
- 無後端(Rust)變動,純前端 layout 調整。
- 破壞性:移除全域 `Header` 會改變所有頁面的頂部版面;skills / projects / tokens 視覺上少一條重複標題列(預期改善),settings / memory / history 改用最小佔位標題(視覺降級但屬暫定,符合其未重做狀態)。
- 跨 change 依賴:`app-pages` spec 的 `Registered Pages` requirement 同時被 `add-history-page`(已完成、未 archive)修改;本 change 的 delta 以目前實際 7 頁(skills / projects / settings / templates / tokens / memory / history)為基準,並僅額外移除 Header map 來源,archive 時以最後套用者為準。
