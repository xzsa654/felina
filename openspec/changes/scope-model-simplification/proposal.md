## Summary

取消 `SkillScope::Project` canonical（不再有 `<project>/.felina/skills/` 主檔），將 `~/.felina/skills/` 作為單一真相來源；Skills 頁的 Global/Project toggle 拿掉，Projects 變成獨立的頂層 view，呈現「該 project 的 skill 納管清單」（兩欄式：左 Known Projects、右該 project 的 skill union），把編輯主檔/設定 target 的入口統一回到 Skills view。

## Motivation

`cross-project-push-and-coverage`（已 archived）落地後，global 主檔已能 push 到任意 project 的 agent 目錄，使得「每個 project 自存一份主檔」失去存在理由。同時，現行雙 scope 模型有三個具體問題在 (b) smoke 期間被使用者明確指出：

- **違背初衷**：APP 本意是「skill 散落各 agent / 各 project 難管 → 一個主檔 fan out 收斂」。`project-scope canonical` 反而把主檔打散到每個 project，重新製造它要解決的分散問題。
- **「project 主檔可進該 repo git 版控」站不住**：使用者對 `.claude/skills` 的 commit/gitignore 處置對 `.felina/skills` 一視同仁，`.felina` 沒有額外的版控優勢；要版控直接把 `.claude/skills` 納入 git 即可。
- **UI 看不出差異**：Global 與 Project 兩個分頁的 import / edit / target / push 操作完全相同；使用者（含開發者）需要反覆釐清 toggle 的語意，無法直觀區辨。

這個 change 從根本砍掉雙 scope 概念負擔，並讓 Projects 分頁變成「該 project 的 skill 納管狀態 dashboard」這個有意義的新角色。

## Proposed Solution

**Storage model**（底層）：

- 刪除 `SkillScope::Project` canonical branch。`canonical_skills_dir_for_scope`、`paths::felina_project_skills_dir`、`skill_import_apply` 內所有 project-scope 分支移除，不保留死碼。
- 單一 canonical 路徑 = `~/.felina/skills/`。新建 / import / 編輯 / fan-out 全部走 global。
- `SkillTarget.scope` 維持二元 `global | project`，但語意收緊：`scope=project` 意指「**push 目的地是某 project 的 agent 目錄**」，不再隱含「主檔住哪」。`SkillTarget.project` 仍是目的地 project 絕對路徑。Fan-out `resolve_pair` 不變。
- 提供一次性 migration（CLI 子命令）：掃描既有的 `<project>/.felina/skills/*`，逐 skill 詢問是否升級成「global 主檔 + 指向該 project 的 target」；不做雙模式長期相容。

**UI / IA**（上層）：

- 取消 Skills 頁的 Global/Project toggle。**Skills**（管理 global 主檔）與 **Projects**（納管清單）成為兩個並列的頂層 view，從 sidebar/route 進入。
- Projects view 兩欄佈局：
  - 左欄：Known Projects list（沿用 `known_projects_list` 三來源 + `exists` 旗標）。預設選 L1（當前 cwd）；無 L1 → 第一個 entry；清單為空 → empty state。`exists=false` 顯示「⚠ project not found」（視覺對齊既有 target 降級）。
  - 右欄：該 project 的「納管清單」表格。
- 納管清單的行 = **union(掃 project 三個 agent 目錄找到的 skill 名) ∪ (global 主檔中有 target 指向此 project 的 skill 名)**。前端用既有三條 API 組合（`skill_import_scan` / `known_projects_list` / `canonical_skills_list`），不新增後端 command。
- 每行兩個獨立軸：
  - **納管標籤**（已納管 / 未納管）：由 global 主檔是否有 target 指向此 project 決定。
  - **per-agent chip × 3**（claude / codex / gemini）：各「該 project agent 目錄裡有沒有此 skill 的檔」。
- 動作（D2 範圍）：未納管的行 → 「Import to global」按鈕（收編進 `~/.felina/skills/`）；已納管的行 → 點擊跳轉到 Skills view 該主檔的編輯畫面。**不在 Projects view 內編輯 target**，避免重複入口。

## Non-Goals

- **per-skill 同步狀態文字欄（C3）**：v1 用 per-agent chip + 納管標籤就夠呈現三種有效狀態，是否升級成獨立文字欄留 v1 實際使用後再評估。
- **Push dry-run / push-time drift / cascade prompt**：屬於 `skill-sync-lifecycle` (c) 範圍，本 change 不重做；但 migration 步驟需依賴 (c) 的 cascade-vs-detach 行為已實作。
- **「Manage this skill」一鍵 toggle target（D3）**：會把 target 編輯帶回 Projects view，違背「Projects = 唯讀清單」定位；保留 Skills view 為唯一 target 編輯入口。
- **per-project 覆蓋率總覽 / project × skill grid（A3 風格）**：等納管清單 v1 穩定後再評估 Phase 2 疊加，不在本 change。
- **保留 `SkillScope::Project` enum 但隱藏 UI**：明確拒絕，避免長期死碼與行為陷阱。
- **隊友共享 project 主檔**：若需把 project 專屬 skill 給隊友，請把 `.claude/skills` 或 `.codex/skills` 納入該 repo 的版控，不再透過 `.felina` 主檔達成。

## Alternatives Considered

- **保留 enum 但隱藏 UI**：成本看似低（只動前端），但 `SkillScope::Project` 仍會出現在後端 enum、sidecar schema、import wizard 等多處，形成永久死碼與「永遠不該發生但語法上可達」的行為陷阱。拒絕。
- **雙模式長期相容**：允許部分 project 自存主檔。維護兩條 storage 路徑與兩種 import 行為，等於沒解決原問題。拒絕，採一次性 migration。
- **B 方案 UI（toggle 留著、語意改）**：把現有 Global/Project toggle 保留但內部已是不同模型；視覺像沒大改，但會把舊問題（兩個維度塞同一個 toggle）帶到新模型，使用者繼續被誤導。拒絕，採 A 方案（拿掉 toggle，獨立 top-level view）。
- **B1 行的來源（只掃 agent 目錄）**：能呈現「散落漏網之魚」但漏掉「已納管但 agent 缺檔」這種失同步狀態。拒絕，採 B2（union 兩來源），這是 Projects view 真正的價值。
- **C1 狀態欄（單一已納管/未納管）**：資訊太貧，看不到失同步。拒絕，採 C2（per-agent chip 與納管標籤兩軸獨立）。
- **D3 動作集（含就地改 target）**：把 target 編輯入口帶回 Projects view，導致兩個編輯入口、語意又混。拒絕，採 D2（只「Import to global」+ 跳 Skills 編輯）。

## Impact

- Affected specs:
  - `multi-agent-skills` (MODIFIED：`SkillScope::Project` canonical 移除、import scope 限定為 global、`SkillTarget.scope=project` 語意收緊)
  - `known-projects` (MODIFIED：作為 Projects view 左欄資料源的 contract 補強)
  - `app-pages` (MODIFIED：取消 Global/Project toggle、加 Skills/Projects 兩個 top-level view)
  - `projects-view` (NEW：Projects 頁的兩欄行為、union 行來源、兩軸標示、D2 動作集)
- Affected code:
  - Modified:
    - src-tauri/src/commands/canonical_skills.rs（移除 `SkillScope::Project` canonical 分支與相關 helper）
    - src-tauri/src/commands/skill_import.rs（移除 project-scope import 寫入路徑，import target 寫入點限定為 global）
    - src-tauri/src/commands/known_projects.rs（如需提供 Projects view 用的 helper 或新欄位）
    - src-tauri/src/commands/fan_out/mod.rs（`SkillTarget.scope=project` 語意收緊；`resolve_pair` 行為不變但需確保不再被誤用於主檔解析）
    - src-tauri/src/paths.rs（移除 `felina_project_skills_dir`，視必要保留 read-only 給 migration 使用）
    - src-tauri/src/lib.rs（如註冊新的 migration command）
    - src/lib/components/skills/SkillsPage.tsx（取消 Global/Project toggle、Skills 變單一 global view）
    - src/lib/components/skills/SkillImportWizard.tsx（target scope 預設 global、不再寫 project canonical）
    - src/lib/components/skills/AddTargetDialog.tsx（移除 canonical scope 概念，留 target scope）
    - src/lib/router.tsx（新增 Projects route）
    - src/lib/stores/skills-store.ts（拿掉 canonical scope state，改成 view-mode state）
    - src/lib/types/skills.ts（`SkillScope` enum 若仍保留則僅用於 target；註解收緊）
  - New:
    - src/lib/components/projects/ProjectsPage.tsx（Projects 頁主元件，兩欄佈局）
    - src/lib/components/projects/ProjectsList.tsx（左欄：Known Projects list）
    - src/lib/components/projects/ManagedInventory.tsx（右欄：納管清單表格、每行兩軸）
  - Removed:
    - 任何只服務 `SkillScope::Project` canonical 的 helper / type / route（具體名單在 design.md 明列）
