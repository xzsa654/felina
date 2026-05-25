## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄當前 TypeScript errors/warnings 數量作為下界。驗證：baseline 數字記錄在 `baseline.txt`，後續 task 比較差異

## 2. i18n 字典建立

- [x] [P] 2.1 在 `src/lib/i18n/locales/en.ts` 新增 `skills` namespace，涵蓋 Skills 頁 9 個元件（SkillsPage、SkillList、SkillEditor、TargetEditor、AddTargetDialog、SkillImportBanner、SkillImportWizard、PendingPushBar、CoverageMatrix）的所有 user-facing labels、tooltips、button text、status messages、empty states、confirmation dialogs、error display text。驗證：`npm run check` 通過（TypeScript `TranslationDict` type 強制 en 結構正確）（對應 ADDED Requirement: Page-Level i18n Coverage）
- [x] [P] 2.2 在 `src/lib/i18n/locales/en.ts` 新增 `projects` namespace，涵蓋 Projects 頁 3 個元件（ProjectsPage、ProjectsList、ManagedInventory）的所有 user-facing text。驗證：`npm run check` 通過（對應 ADDED Requirement: Page-Level i18n Coverage）
- [x] 2.3 在 `src/lib/i18n/locales/zh-TW.ts` 新增對應的 `skills` 和 `projects` namespace，每個 key 都有繁體中文翻譯，結構與 `en.ts` 完全對應。驗證：`npm run check` 通過（`TranslationDict` type 強制 zh-TW 結構與 en 結構一致，缺 key 會 compile error）

## 3. Skills 頁元件替換

- [x] [P] 3.1 `SkillsPage.tsx` 所有 hardcoded UI text 替換為 `t(locale, "skills.*")` 呼叫，元件內透過 `useLocaleStore` 取得 locale。skill names、file paths、timestamps 維持 verbatim 不翻譯。驗證：`npm run check` 通過 + 檔案內搜尋不到 hardcoded user-facing string literals（對應 ADDED Requirement: Page-Level i18n Coverage）
- [x] [P] 3.2 `SkillList.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.3 `SkillEditor.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.4 `TargetEditor.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.5 `AddTargetDialog.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.6 `SkillImportBanner.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.7 `SkillImportWizard.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.8 `PendingPushBar.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 3.9 `CoverageMatrix.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text

## 4. Projects 頁元件替換

- [x] [P] 4.1 `ProjectsPage.tsx` 所有 hardcoded UI text 替換為 `t(locale, "projects.*")` 呼叫。驗證：`npm run check` 通過 + 無 hardcoded UI text（對應 ADDED Requirement: Page-Level i18n Coverage）
- [x] [P] 4.2 `ProjectsList.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text
- [x] [P] 4.3 `ManagedInventory.tsx` 同上替換。驗證：`npm run check` 通過 + 無 hardcoded UI text

## 5. 開發規範建立

- [x] 5.1 在 CLAUDE.md Gotchas 段新增 i18n 開發規範：「新增/修改 user-facing UI text 一律使用 `t(locale, key)`，不允許 hardcoded string literals。translation key 同時加入 `en.ts` 和 `zh-TW.ts`」。驗證：CLAUDE.md 內可搜尋到該規範文字（對應 ADDED Requirement: i18n Development Convention）

## 6. 整合驗證

- [x] 6.1 執行 `npm run check`，確認 TypeScript errors/warnings 數量不超過 baseline（task 1.1）。驗證：exit code 0 或 error 數量 ≤ baseline
- [x] 6.2 `npm run tauri dev` 手動驗證：(a) Skills 頁在 en 語言下所有 UI text 正常顯示 (b) 切換到 zh-TW 後所有 UI text 變為繁體中文 (c) skill names/paths/timestamps 不被翻譯 (d) Projects 頁同樣驗證 en → zh-TW 切換 (e) Tokens 頁既有 i18n 行為未 regress。驗證：五項手動檢查全部通過
