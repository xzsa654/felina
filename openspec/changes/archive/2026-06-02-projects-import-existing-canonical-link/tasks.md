## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings 數量作為 baseline。行為：後續驗證能區分 pre-existing 與本 change 新增問題。驗證：保存本次 `npm run check` 結果摘要。

## 2. Inventory row model（Two-axis inventory row model）

- [x] 2.1 [P] 在 `src/lib/components/projects/managed-inventory.ts` 重構 `InventoryRow` 推導，使每列明確分離 Detected sources 與 Felina targets，且 Felina targets 只包含 global target 與 normalized path 等於 selected project 的 project target。涵蓋 `Managed Inventory View` 的 local-source/target-axis separation 與 other-project exclusion。驗證：新增或更新 node:test 覆蓋 local source + global target 不等於 Managed、other-project target 被排除。
- [x] 2.2 [P] 在 `src/lib/components/projects/managed-inventory.ts` 增加 same-name canonical resolution states 推導，至少能區分 `managedProject`、`canonicalGlobalOnly`、`canonicalExistsUnlinked`、`localOnly`，並以 selected-project enabled non-detached target 作為 Managed 的唯一條件。涵蓋 `Managed Inventory View` 的 selected project target 與 same-name canonical resolution scenarios。驗證：node:test 覆蓋 selected-project target 使 row Managed、global target 只顯示 duplicate/coverage、不顯示 Import primary。
- [x] 2.3 [P] 在純函式層加入 physical-source grouping，將相同 normalized `sourcePath` 的 multi-source candidates 合併成單一 source group，同時保留每個 attribution 對應的原始 `deferred.candidates` source index。涵蓋 `Multi-Source Inline Source Selection` 的 shared `.agents/skills` source grouping。驗證：node:test 覆蓋 Codex/Gemini 同 path 合併為一組、不同 path 保持分開、選 Gemini attribution 對應正確 source index。

## 3. Projects inventory UI（Felina UI presentation contract）

- [x] 3.1 `src/lib/components/projects/ManagedInventory.tsx` 將 row layout 更新為 `$felina-ui-guidelines` 相容的 borderless list view：row 內顯示 relationship badge、Detected sources chips、Felina targets chips、primary action；不得使用 `<table>` 或硬格線。涵蓋 `Projects Inventory Presentation Style`。驗證：`npm run check` 通過，手動檢查 DOM/畫面無 table presentation、狀態不以 standalone info/warning bar 呈現。
- [x] 3.2 `src/lib/components/projects/ManagedInventory.tsx` 實作 same-name canonical action 分支：local-only 顯示 Import to Felina；managed row 點擊導向 Skills；`canonicalGlobalOnly` 與 `canonicalExistsUnlinked` 顯示 Link/resolve primary action，overwrite 僅作 secondary action。涵蓋 `Managed Inventory View` 與 `Discovered Skill Link Confirmation`。驗證：`npm run check` 通過，手動驗證 canonical 已存在但未連 project 時不再顯示 Import/Overwrite 作為主動作。
- [x] 3.3 `src/lib/components/projects/ManagedInventory.tsx` 實作 diff confirmation uses existing import conflict metadata first 的 Link to Project confirmation inline panel/drawer，顯示 `ImportCandidate.conflict.diffSummary` 或等價 preview，使用者確認前不得呼叫 `skill_targets_set`。涵蓋 `Discovered Skill Link Confirmation` 的 confirmation-before-append scenario。驗證：手動驗證點 Link 先顯示 diff/confirmation，確認後才新增 target；缺少 diff metadata 時顯示 inline error 且不 mutate targets。
- [x] 3.4 `src/lib/components/projects/ManagedInventory.tsx` 實作 Link to Project append 流程：使用既有 `skillTargets.set` 追加 `{ agent, scope: "project", project, enabled: true, mode: "manual" }`，用 `normalizeProjectPath` 做 duplicate target prevention，成功後 reload 並移入 Managed。涵蓋 `Discovered Skill Link Confirmation` 的 add target 與 duplicate prevention scenarios。驗證：`npm run check` 通過，手動驗證 Link 後 row 移入 Managed、重複 link 不新增第二筆等價 target。
- [x] 3.5 `src/lib/components/projects/ManagedInventory.tsx` 將 multi-source drawer 改為 physical-source-first multi-source drawer presentation：同 path Codex/Gemini 顯示一張 shared source card，card 內提供 attribution chips；不同 path 顯示不同 source cards；confirm 時仍送出 `selectSource` 與正確 source index。涵蓋 `Multi-Source Inline Source Selection`。驗證：`npm run check` 通過，手動驗證 shared `.agents/skills` 不是兩張重複路徑卡，選 Codex/Gemini attribution 皆可送出正確 import payload。

## 4. i18n

- [x] [P] 4.1 更新 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 的 Projects inventory 文案，新增 relationship badges、Detected sources、Felina targets、Link confirmation、shared source attribution、overwrite secondary action 所需 keys。行為：所有新增 user-facing text 透過 `t(locale, key)` 顯示且 en/zh-TW 結構對齊。驗證：`npm run check` 通過。

## 5. Verification

- [x] 5.1 執行 `npm run check`，確認 TypeScript error 數不高於 baseline。驗證：`npm run check` error 數 ≤ task 1.1 baseline。
- [x] 5.2 執行相關 node:test（包含 managed inventory row model / source grouping 測試）。驗證：新增或更新的 tests 全部通過。
- [x] 5.3 啟動 `npm run tauri dev` 手動驗證 Projects page：(a) source 與 Felina targets 分軸顯示，(b) global target 不使 row 變 Managed，(c) same-name canonical Link 前出現 diff confirmation，(d) Link 後 row 移入 Managed，(e) overwrite 是 secondary action，(f) shared `.agents/skills` drawer 顯示單一 physical source card + attribution choices。
- [x] 5.4 使用 Browser 或截圖檢查 Projects page 在寬版與窄版 panel 下的 UI：row 文字不重疊、drawer 不撐破、狀態 chips 融入 row、沒有 table/hard-grid 或 standalone warning/info bar。驗證：截圖/目視紀錄符合 `$felina-ui-guidelines`。

## 6. Post-review rework（用戶複審後補做：術語正名 + inline diff）

涵蓋 design.md 新增 Decisions「Diff confirmation uses inline hunks computed at scan time」與「Terminology normalization (UI vocabulary)」。

- [x] 6.1 後端擴 `ConflictInfo`：在 `src-tauri/src/commands/skill_import.rs` 的 `ConflictInfo` 加 `pub hunks: Vec<DiffHunk>` 欄位；於 `scan_dir`（產生 `ConflictInfo` 處）讀完 source / canonical raw 後呼叫 `build_diff_hunks(canonical_raw, source_raw)` 一併填入。`DiffHunk` / `DiffLine` 直接從 `commands/fan_out/mod.rs` 重用（必要時 `pub(crate)` 化或 re-export）。`diff_summary` 字串保留作為 fallback。驗證：`cargo check` 通過；scan 對同名 canonical 回傳的 `conflict.hunks` 非空且 `kind` 為 `add`/`delete`/`context`/`replace` 之一。
- [x] 6.2 前端 TS 型別對齊：在 `src/lib/types/skills.ts` 的 `ConflictInfo` interface 新增 `hunks: DiffHunk[]`。`DiffHunk` / `DiffLine` 若 `types/` 內已有（pull-diff-preview 既有）直接 import；無則新增與後端 camelCase 對齊。驗證：`npm run check` 通過。
- [x] 6.3 Link confirmation dialog 改用 inline hunks 渲染：`src/lib/components/projects/ManagedInventory.tsx` 的 `ActionDialogs` Link 區塊，把現行單行 `linkCandidate.conflict.diffSummary` 顯示，改為迭代 `hunks` 渲染 add/delete/context 行（樣式向 `PullConfirmDialog` 既有 inline diff 視覺對齊；可抽共用元件或就地實作，二擇一）。`hunks` 為空時 fallback 顯示 `diffSummary`。驗證：`npm run check` 通過；手動驗證 Link dialog 顯示行級 diff 而非 lines/bytes 統計。
- [x] 6.4 i18n 文案正名（zh-TW + en，結構對齊）：
  - `projects.importConflictDialog.title`：`Global 已有同名主檔` → `Felina 主檔已存在同名檔案`（en 對應）。
  - `projects.importConflictDialog.message`：改為「寫入方向：此專案 → Felina 主檔。\n副作用：Felina 主檔的所有 enabled targets（其他專案、Global agent 目錄），下次 push 會被同步覆蓋。」（en 對應）。
  - `projects.importConflictDialog.confirm`：維持「仍要覆蓋」/`Overwrite anyway`，不動。
  - `projects.inventory.link.message`：改為「Felina 主檔已存在同名「{name}」。\n確認連結後，此專案將被納入該主檔的同步管理範圍。下方為本專案與 Felina 主檔的差異：」（en 對應）。
  - 移除任何「Felina 中央控管庫」字眼。
  - 不改 i18n key 名（`importToGlobal` 等保持原 key 名，僅改顯示字串）。
  - 驗證：`npm run check` 通過；grep 「中央控管庫」 / 「Global 主檔」 / 「global master」（en）無殘留。
- [x] 6.5 Verification：執行 `npm run check` 與相關 `cargo check`；無新增 TypeScript 或 Rust error。驗證：error 數 ≤ task 1.1 baseline；Rust 編譯通過。
