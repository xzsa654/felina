## Context

`/tokens` 目前由 `src/router.tsx` lazy-load `src/lib/components/tokens/TokensPage.tsx`，頁面再組合多個 React 子元件。標題、載入文字、空狀態、控制項、圖表 legend、表格欄位、tooltip 與狀態文字分散硬編在這些 components 中。專案已使用 Zustand 管理主題等前端狀態，尚未有 i18n 套件或翻譯資源目錄。

這次變更先以 `/tokens` 為試點，建立可以擴展到其他 React 頁面的翻譯基礎，不改動 Tauri command 回傳資料結構，也不處理舊 Svelte 頁面。

## Goals / Non-Goals

**Goals:**

- 支援 English 與繁體中文兩個 locale，預設使用 English。
- 在 `/tokens` 頁面提供語言切換入口，切換後立即更新頁面文字。
- 將 `/tokens` 與其直接 React 子元件的使用者可見靜態文字改為翻譯 key。
- 讓語言選擇持久化於瀏覽器儲存，重新啟動 Tauri app 後保留選擇。
- 提供 typed translation keys，避免呼叫不存在的 key 時只在執行期才暴露。
- 讓數字、日期與金額格式能接收 locale，至少套用於 `/tokens` 目前顯示的事件數、日期與美元金額。

**Non-Goals:**

- 不把整個應用一次改為雙語。
- 不翻譯 API 回傳的 agent id、model name、錯誤原文或資料庫內容。
- 不新增大型 i18n framework 依賴，除非實作時證明現有輕量方案無法滿足 typed key、持久化與 React render 更新。
- 不修改 Rust token analytics 聚合邏輯或 Tauri command schema。
- 不處理 `src/lib/components/tokens/*.svelte` 或其他 Svelte 頁面。

## Decisions

### Add lightweight typed i18n resources

在 `src/lib/i18n/` 新增 `en.ts` 與 `zh-TW.ts` 翻譯資源，並由 `src/lib/i18n/index.ts` 匯出 `Locale`、translation dictionary、`TranslationKey`、`t(locale, key, params)` 與 locale-aware format helpers。English dictionary 作為 key shape 的來源，繁中 dictionary 必須符合相同 key 結構。

替代方案是引入 `react-i18next` 或類似套件。此階段只涵蓋單一頁面與兩個 locale，外部套件會增加初始化、bundle 與測試面積；先使用 typed object 與 helper 可降低風險，之後若需要 plural rules、namespace lazy loading 或 ICU message format，再以同一翻譯 key 結構遷移。

### Use a Zustand locale store with localStorage persistence

新增 `src/lib/stores/locale.ts`，模式參考 `src/lib/stores/theme.ts`。store 保存 `locale`、`setLocale` 與 `toggleLocale`，localStorage key 使用 `glyphic-locale`，只接受 `en` 與 `zh-TW`，無效值回退到 `en`。

替代方案是在 URL query、router state 或 component local state 保存語言。Tauri 使用 memory router，URL 不適合承擔全域偏好；component local state 會讓頁面外擴時重複實作。

### Keep the language switcher scoped to the Tokens page

新增 `src/lib/components/tokens/components/LanguageSwitcher.tsx`，放在 `/tokens` 頁面 header/control area。它只切換 `en` 與 `zh-TW`，使用目前設計系統的緊湊 segmented control 樣式，並提供可翻譯的 label 與 aria-label。

替代方案是放到全域 Header 或 Settings。使用者要求主要先作用於 `/token`，全域入口會暗示全站已完成翻譯，與實際範圍不一致。

### Pass translated labels through component props where practical

對 chart/table/control components，優先讓父層或 component 內部讀取 locale store 後取得翻譯。複用性較高的子元件可接收 labels props；只服務 Tokens 頁面的元件可直接使用 translation helper。資料欄位名稱與 token analytics 型別不更名，只替換顯示文字。

替代方案是在全 app 建 React context/provider。現階段 Zustand 已能觸發 React re-render，額外 provider 不是必要條件；未來全站導入時再評估是否加入 provider 以支援 namespace loading。

### Localize formatting without changing business data

新增或擴充格式化 helper，使數字、日期與美元金額可依 locale 使用 `Intl.NumberFormat` 與 `Intl.DateTimeFormat`。token count 的 K/M 縮寫可維持短格式，但必須由 locale-aware helper 產生數字部分；美元仍顯示 USD，不進行匯率轉換。

替代方案是只翻譯文字、不碰格式化。這會讓繁中 UI 仍出現硬編 `en-US` 日期與數字格式，使用體驗不完整。

## Risks / Trade-offs

- [Risk] 手寫 i18n helper 後續可能不支援複雜 plural 或 ICU 規則 → Mitigation: 目前 key 與 params API 保持簡單且集中，未來可將 helper 實作替換為成熟套件而不改 component key。
- [Risk] `/tokens` 子元件文字遺漏，造成中英混雜 → Mitigation: tasks 明列所有 Tokens React components，並要求搜尋殘留硬編字串。
- [Risk] localStorage 中存在未知 locale 值 → Mitigation: store 初始化時以 allowlist 驗證，未知值回退 English 並覆寫儲存值。
- [Risk] 圖表 tooltip、legend 與 title 屬性在 Recharts 或 DOM attribute 中被遺漏 → Mitigation: tasks 要求覆蓋 Recharts `name`、`formatter`、empty states 與 heatmap `title` 字串。
