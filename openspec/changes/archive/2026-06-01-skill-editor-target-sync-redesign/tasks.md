## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline，確認本 change 起始狀態乾淨。驗證：npm run check 結果記錄在 commit message 或 scratch 檔中

## 2. 共用邏輯抽取

- [x] [P] 2.1 從 SyncInfoBar.tsx 抽出 classifyTarget 函式、STATUS_CONFIG 常數、targetKey 函式到獨立模組 src/lib/components/skills/sync-status-utils.ts，使 TargetChips 和 TargetEditor 皆可複用。行為：import path 改變後 SyncInfoBar 仍正常運作（暫不移除）。驗證：npm run check 通過
- [x] [P] 2.2 為 classifyTarget 撰寫 node:test 單元測試（tests/sync-status-utils.test.ts），涵蓋 synced/pending/missing 三種狀態分類（Sync Info Status Grouping 需求）。驗證：node --test tests/sync-status-utils.test.ts 全數通過

## 3. TargetChips 同步狀態融合

- [x] 3.1 擴展 TargetChips props，加入 lastSync: Record<string, LastSyncEntry>、knownProjects: KnownProject[]、siblingsDirty: boolean。收合態每個 chip 根據 classifyTarget 結果顯示狀態 icon（✓/●/!）並套用 STATUS_CONFIG 語意色。siblingsDirty 為 true 時在 Target Chips 行最前方顯示單一 ⚠ 區域級警告。行為：收合態 chip 呈現 [✓ claude·global·auto] [● gemini·project·manual] 格式（Interactive Expansion、Sync Info Status Grouping 需求）。驗證：npm run check 通過 + npm run tauri dev 手動確認 chip 帶狀態 icon

## 4. Target Detail Popover

- [x] 4.1 建立 TargetPopover 元件（src/lib/components/skills/TargetPopover.tsx），接收單一 target 資料、lastSync entry、knownProjects、onChange/onDelete callbacks。內容包含：agent/location 標籤、mode 下拉選單（Auto/Manual/Disabled）、同步時間或 "Not synced" 狀態、drift 警告、操作按鈕（檢視/開資料夾/刪除，ghost 風格）。Popover 內部無硬邊框，使用微弱分隔與留白（Target Detail Popover 需求）。行為：Popover 面板包含完整 target 詳細資訊與操作控制。驗證：npm run check 通過
- [x] 4.2 TargetChips 中整合 Popover 開關邏輯：點擊 chip 開啟對應 target 的 TargetPopover（錨定在 chip 附近），同時間只開一個 Popover，點擊外部或 Esc 關閉。行為：點擊 chip 彈出懸浮面板，不擠壓 Content 區域（Target Detail Popover 需求）。驗證：npm run check 通過 + npm run tauri dev 手動確認 Popover 定位與開關
- [x] [P] 4.3 TargetEditor.tsx 移除 inline 展開邏輯（SkillEditor 中的 max-h-[200px] overflow-y-auto 包裹區塊），Target 詳細檢視完全由 Popover 取代。行為：TargetChips 區域不再有 inline 展開，點擊 chip 一律開 Popover。驗證：npm run check 通過

## 5. 資料流串接

- [x] 5.1 SkillEditor.tsx 接收並透傳 lastSync、knownProjects、siblingsDirty 給 TargetChips 元件。行為：SkillEditor 作為 props 中繼，不持有同步邏輯。驗證：npm run check 通過
- [x] 5.2 SkillsPage.tsx 移除獨立 SyncInfoBar 渲染，改為將 lastSync、knownProjects 傳給 SkillEditor。行為：SkillsPage 不再直接渲染 SyncInfoBar 元件，同步資訊完全由 TargetChips 區域呈現（SyncInfoBar Removal 需求）。驗證：npm run check 通過 + npm run tauri dev 確認 SyncInfoBar 已不在畫面上

## 6. 清理與 i18n

- [x] [P] 6.1 SyncInfoBar.tsx 共用邏輯已抽出至 sync-status-utils.ts 後，將 SyncInfoBar.tsx 標記為 retained-for-reference（加 eslint-disable + 註解），不刪除但不再被任何元件 import。行為：grep -r "SyncInfoBar" src/ 只出現在 SyncInfoBar.tsx 自身和 retained-for-reference 註解中。驗證：npm run check 通過 + grep 確認無活躍 import
- [x] [P] 6.2 新增 i18n keys（en.ts 和 zh-TW.ts）：skills.sync.synced、skills.sync.pending、skills.sync.missing、skills.sync.notSynced、skills.sync.siblingsDirty。行為：所有新增 UI 文案透過 t(locale, key) 取值。驗證：npm run check 通過（TypeScript TranslationDict 強制對齊）

## 7. 驗證

- [x] 7.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 7.2 執行 node --test tests/sync-status-utils.test.ts 確認單元測試全數通過。驗證：exit code 0
- [x] 7.3 npm run tauri dev 手動驗證以下行為：(a) 收合態 chip 帶狀態 icon 與語意色、(b) siblingsDirty 區域級 ⚠ 顯示、(c) 點擊 chip 開啟 Popover 懸浮面板（錨定在 chip 附近）、(d) Popover 內 mode 下拉選單可操作、(e) Popover 內操作按鈕可見可點擊、(f) Popover 內同步時間欄位顯示、(g) 點擊外部或 Esc 關閉 Popover、(h) 同時只開一個 Popover、(i) SyncInfoBar 不再出現。驗證：逐項目視確認
