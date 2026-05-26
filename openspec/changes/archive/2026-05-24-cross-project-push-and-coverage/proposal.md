## Why

Phase 1.5 (a) `known-projects-and-multi-target`（已 archived）建立了 per-skill target editor 與 Known Projects 三來源模型，但 AddTargetDialog 只允許選「當前 project」，無法建立跨 project 的 target row；fan-out push 只寫入當前 project 或 global 的 agent 目錄。使用者若有多個 project 共用同一組 skill，目前必須在每個 project 各自手動維護——canonical 的「一處編輯、多處推送」優勢無法跨 project 發揮。

同時，使用者缺乏一個全局視角來檢視「哪些 skill 推到了哪些 target、同步狀態如何」，只能逐 skill 查看 TargetEditor 和 Sync info bar。

本 change 解除 AddTargetDialog 的 cross-project 限制、讓 fan-out 能推送到其他 project 的 agent 目錄，並新增 Skills 頁的 Summary view-mode 提供 skill × target 的覆蓋矩陣。附帶提供手動路徑輸入（Tauri folder dialog）解決 L2 auto-detect 漏掉 project 的問題。

## What Changes

1. **Cross-project target 啟用**：AddTargetDialog 解除「只有當前 project 可選」的限制，所有 Known Projects 清單中的 project 均可選為 target。fan-out push 根據 target 的 `project` 欄位，將 rendered SKILL.md 寫入對應 project 的 agent skill 目錄（例如 `<other-project>/.claude/skills/<skill-name>/`）。Canonical 仍只存在於 origin project 的 `.felina/skills/`。

2. **Manual project path entry**：AddTargetDialog 的 project 選擇器新增「Browse...」按鈕，使用 Tauri `dialog.open({ directory: true })` 讓使用者選擇資料夾路徑，選完後自動呼叫 `known_projects_add` 寫入 L3，路徑即時出現在下拉。解決 L2 auto-detect 反解失敗時漏掉 project 的問題。

3. **Coverage summary view-mode**：Skills 頁 header 新增 List / Summary 切換。Summary mode 顯示 skill × target grid（行 = skill，列 = agent×scope target），cell 顯示 sync state（✓ synced / ● dirty / — not synced / ○ disabled）。初期列數由 3 agents × 2 scopes 決定（max ~6 columns per project），CSS grid + 垂直滾動，不需虛擬化。

4. **Origin-project 消失時的降級**：當 target 的 destination project 從 Known Projects 消失（例如資料夾被刪）時，該 target row 優雅降級為 disabled 狀態（不自動刪除 target row 或 agent-side 檔案）。Push 跳過該 target 並在 Sync info 標示 "project not found"。

## Non-Goals

- Push dry-run（留 (c) `skill-sync-lifecycle`）
- Push-time drift check（留 (c)）
- Cascade/detach/cancel prompt on canonical delete（留 (c)）
- Multi-source import resolution（留 (c)）
- Forked overlay rendering（Phase 2）
- Coverage matrix 虛擬滾動 / 大量 agent 擴展（Phase 2 capability registry）

## Capabilities

### New Capabilities

- `coverage-matrix`: Skills 頁的 Summary view-mode，顯示 skill × target 覆蓋矩陣與 sync state。

### Modified Capabilities

- `known-projects`: 新增 manual project path entry（Tauri folder dialog + `known_projects_add`）。
- `multi-agent-skills`: Per-Skill Target Editor 解除 cross-project 限制；fan-out push 支援寫入非當前 project 的 agent 目錄；origin-project 消失時的降級策略。

## Impact

- Affected specs: coverage-matrix (new), known-projects (modified), multi-agent-skills (modified)
- Affected code:
  - New:
    - src/lib/components/skills/CoverageMatrix.tsx
    - src/lib/utils/path.ts（normalizeProjectPath，跨平台路徑正規化）
  - Modified:
    - src/lib/components/skills/AddTargetDialog.tsx
    - src/lib/components/skills/SkillsPage.tsx
    - src-tauri/src/commands/known_projects.rs（KnownProject 加 exists: bool）
    - src/lib/types/skills.ts（KnownProject type 加 exists）
    - src-tauri/Cargo.toml（+ tauri-plugin-dialog）
    - src-tauri/src/lib.rs（註冊 dialog plugin）
    - src-tauri/capabilities/default.json（+ dialog:default）
  - Removed:
    (none)
  - 註：fan-out 後端（`fan_out/mod.rs` 與各 agent renderer）原預期需改,實作確認 `resolve_pair` 已能依 `target.project` 路由到任意 project,故未變動。
