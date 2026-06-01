## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline；執行 cargo test -p felina --test agent_paths 確認既有測試通過。驗證：兩項結果記錄

## 2. 後端預設路徑與 import probe 修正

- [x] [P] 2.1 `src-tauri/src/commands/agent_paths.rs`：`defaults()` 的 gemini global 從 `~/.gemini/skills` 改為 `~/.gemini/antigravity-cli/skills`。同時更新檔頭註解中的 Antigravity 路徑（`antigravity/skills` → `antigravity-cli/skills`）。行為：新安裝的 Felina 預設 gemini 全域目標指向 Antigravity CLI 目錄。驗證：cargo test -p felina --test agent_paths 通過（`defaults_round_trip` test 確認序列化往返）
- [x] [P] 2.2 `src-tauri/src/commands/skill_import.rs`：兩處 Antigravity probe 路徑 `~/.gemini/antigravity/skills` 修正為 `~/.gemini/antigravity-cli/skills`（約 L131 `expand_user_path` 呼叫與 L211 `collect_candidates_in` 呼叫）。行為：import scanner 探測到正確的 Antigravity CLI skills 目錄。驗證：grep 確認無殘留 `antigravity/skills`（不含 `-cli`）出現在 skill_import.rs

## 3. 前端預設路徑與文案

- [x] [P] 3.1 `src/lib/components/settings/AgentPathsSection.tsx`：`DEFAULT_PATHS` gemini global 從 `~/.gemini/skills` 改為 `~/.gemini/antigravity-cli/skills`。help text 中的路徑字串同步更新。行為：Settings 頁面 gemini 欄位的預設值與說明文字顯示正確的 Antigravity CLI 路徑。驗證：npm run check 通過

## 4. 驗證

- [x] 4.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 4.2 執行 cargo test -p felina --test agent_paths 確認 `defaults_round_trip` 等測試通過。驗證：test 全通過
