## 1. i18n 基礎設施

- [x] 1.1 依照 Add lightweight typed i18n resources，在 src/lib/i18n/index.ts、src/lib/i18n/locales/en.ts、src/lib/i18n/locales/zh-TW.ts 建立 typed dictionary、Locale、TranslationKey、t(locale, key, params) 與缺 key 時的 English fallback。
- [x] 1.2 依照 Frontend exposes selectable locales 與 Use a Zustand locale store with localStorage persistence，在 src/lib/stores/locale.ts 建立只接受 en 與 zh-TW 的 Zustand store，使用 glyphic-locale 持久化，無效值回退 en 並覆寫儲存值。
- [x] 1.3 依照 Localize formatting without changing business data，新增或擴充 src/lib/utils/format.ts 的 locale-aware number、compact token number、USD cost 與 date helpers，確保只改顯示格式、不改 analytics 數值與幣別語意。

## 2. Tokens 頁語言切換與翻譯套用

- [x] 2.1 依照 Tokens page provides language switching 與 Keep the language switcher scoped to the Tokens page，新增 src/lib/components/tokens/components/LanguageSwitcher.tsx，提供 English 與繁體中文 segmented control、翻譯 label、aria-label、目前語系高亮與 setLocale 呼叫。
- [x] 2.2 在 src/lib/components/tokens/TokensPage.tsx 讀取 active locale，放入 LanguageSwitcher，並把 PageHeader title、loading state、error 周邊固定文字與子元件所需 labels 改成 translation keys。
- [x] 2.3 依照 Pass translated labels through component props where practical，更新 GranularityPicker、DateRangeFilter、RefreshButton、AgentStatusPanel，翻譯粒度選項、日期範圍選項、Refresh、Agents、events、Last、Not installed 等文字，agent id 保持資料來源原值。
- [x] 2.4 依照 Tokens user interface uses translation resources，更新 TokenStatCards、CacheEfficiencyCard、CostBudgetCard 的標題、統計 label、subtitle、N/A、Saved、Average daily cost、per day 與 no data 文案，並套用 locale-aware number 和 USD formatting。
- [x] 2.5 依照 Tokens user interface uses translation resources，更新 TokenTimeSeries、TokenCostTimeSeries、ModelBreakdownChart、ModelBreakdownTable、AgentDistribution、HourlyHeatmap 的 chart titles、legend names、tooltip labels、table headers、empty states、Less、More 與 heatmap title attribute 文字。
- [x] 2.6 依照 Locale-aware formatting is used on Tokens page，確認所有 /tokens 顯示的事件數、token 數、日期與美元金額都透過 active locale formatting；model name 與 agent identifier 不翻譯、不轉換、不重新命名。

## 3. 驗證

- [x] 3.1 執行 npm run check，修正 TypeScript 錯誤，特別是 translation key 型別、locale store 型別與 component props 型別。
- [x] 3.2 手動或測試驗證 /tokens 的 Frontend exposes selectable locales：無 glyphic-locale 時預設 English，glyphic-locale=zh-TW 時顯示繁中，無效 glyphic-locale 回退 English。
- [x] 3.3 手動或測試驗證 /tokens 的 Tokens page provides language switching：English 與繁中切換不需 reload，切換後 label、heading、controls、empty states、chart labels、table headers、button text、status text 立即更新且 reload 後保留。
- [x] 3.4 搜尋 src/lib/components/tokens/**/*.tsx 中殘留的使用者可見硬編英文文字，保留資料欄位名稱、CSS class、type name、agent id、model name 與錯誤原文，移除其餘應翻譯字串。
