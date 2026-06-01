## 1. 後端 agents fallback

- [x] [P] 1.1 `src-tauri/src/commands/canonical_skills.rs`：`parse_skill_md` 的 `take_required_agents` 改為 `take_optional_agents`（或直接在 `parse_skill_md` 內處理），`agents` 欄位缺失時設為空 `Vec`，不回傳 `Err`。行為：僅有 `name` + `description` 的 SKILL.md 解析成功，`agents` 為空陣列。驗證：新增 unit test `parse_skill_md_without_agents_returns_ok`，輸入僅含 name/description 的 frontmatter，斷言回傳 `Ok` 且 `agents.is_empty()`
- [x] [P] 1.2 `src-tauri/src/commands/canonical_skills.rs`：新增 unit test `parse_skill_md_with_agents_unchanged`，確認含 `agents` 欄位的既有 SKILL.md 解析行為不變（agents 正確填充）。驗證：test 通過

## 2. 前端 Action Required 分組

- [x] 2.1 `src/lib/components/skills/SkillsPage.tsx`：SkillList 的 `sortRank` / Action Required 分組邏輯擴充，將 `agents` 為空陣列的 skill 歸入 Action Required 分組。行為：外部複製的 skill（無 agents）出現在 Action Required 群組，排在 dirty/drifted skill 之後。驗證：npm run check 通過，手動確認 SkillList 分組正確

## 3. SkillEditor 提示 banner

- [x] 3.1 `src/lib/components/skills/SkillEditor.tsx`：當開啟的 skill `agents` 為空時，在 header 區域（Description 下方、Content/Settings 分頁上方）顯示提示 banner，引導使用者到 Settings 分頁設定 agents。使用 `text-warning` 語意色 + AlertTriangle icon。行為：開啟無 agents 的 skill 時看到提示，設定 agents 後提示消失。驗證：npm run check 通過

## 4. i18n

- [x] [P] 4.1 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts`：新增 i18n keys — skill list 的 "no agents configured" 指示文字、SkillEditor 的提示 banner 文案。驗證：npm run check 通過，兩個 locale 檔案 key 對齊

## 5. 驗證

- [x] 5.1 執行 npm run check 確認零新增 TypeScript errors。執行 cargo test -p felina 確認所有 canonical_skills 相關測試通過（包含新增的兩個 test）。驗證：兩項皆通過
