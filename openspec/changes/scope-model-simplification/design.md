## Context

`cross-project-push-and-coverage`（已 archived）讓 global 主檔可以 push 到任意 project 的 agent 目錄；同一 session 中，使用者明確指出雙 scope 模型違背 APP 初衷（skill 收斂），且 UI 兩個分頁實際上行為相同、persistently 製造認知負擔。本 change 從根本砍掉 `SkillScope::Project` canonical，讓 `~/.felina/skills/` 成為唯一真相來源；UI 層 Skills 與 Projects 拆成兩個 top-level view，Projects 重新定位為「該 project 的 skill 納管狀態 dashboard」。

技術棧：Tauri v2 + React 19 + TypeScript（strict）+ Tailwind v4 + Rust。後端 cargo test 守 regression；前端 npm run check 是唯一靜態 gate。`SkillTarget.scope=project` 早已支援跨 project（(b) 已落地），所以 fan-out 那層不需動 schema。

## Goals / Non-Goals

**Goals:**

- 刪除 `SkillScope::Project` canonical 分支（不保留死碼），單一 canonical 路徑 = `~/.felina/skills/`。
- 收緊 `SkillTarget.scope=project` 語意為「push 目的地是某 project 的 agent 目錄」。
- UI 取消 Global/Project toggle + ProjectPicker；Skills（管理 global 主檔）與 Projects（納管清單）成為兩個 top-level view，從 sidebar/route 進入。
- Projects view 用既有後端 API（`skill_import_scan` / `known_projects_list` / `canonical_skills_list`）組出 union 納管清單，呈現「納管標籤 + per-agent chip」兩軸獨立狀態。

**Non-Goals:**

- C3 文字狀態欄、D3 就地改 target、A3 multi-project grid、Push dry-run / drift / cascade（(c) 範圍）、雙模式相容。
- **project→global migration command / onboarding UI**：project-scope canonical 從未發布，無存量資料，明確不做（見 Decisions / proposal Alternatives）。
- **import-all（批次一鍵匯入）+ 有 rename 的衝突解析**：留 follow-up。本 change 只做 per-row「Import to global」+ 同名 overwrite 確認。理由：批次匯入要做好需要 per-conflict 的 keep/overwrite/rename 選擇（等同被本 change 砍掉的 import wizard），且跨 project 同名是 single-global-by-name 模型的本質議題，宜獨立處理（併入 `skill-sync-lifecycle` (c) 或新 change）。

## In Scope / Out of Scope

**In scope:**

- 後端：移除 `SkillScope::Project` canonical 邏輯、收緊 `SkillTarget.scope` 註解 / 文件；import / prune 簽名與 canonical scope 解耦。
- 前端：取消 Skills 頁 toggle + ProjectPicker、Skills 改純 global、`?select=` deep-link、SkillList 無-target 浮頂；新增 Projects route + ProjectsPage / ProjectsList / ManagedInventory（含 not-found 移除鈕、import 同名衝突提示）；nav label「Skills」+ Projects entry；移除 useSkillsStore 中與 canonical scope 相關的 state。
- Specs：`multi-agent-skills` MODIFIED、`known-projects` MODIFIED、`app-pages` MODIFIED、`projects-view` NEW。

**Out of scope:**

- 全面重寫 fan-out / SkillTarget schema（已支援跨 project，無需動）。
- Coverage matrix 重寫（Skills view 內仍可用作 global 主檔的 target 覆蓋表）。
- import wizard UX 重做（只去掉 project canonical 寫入點，其餘行為不變）。
- 跨平台路徑規則（已在 (b) 落地 + 寫入 `openspec/config.yaml`）。
- project-scope canonical 的 migration / legacy 清理（無存量資料，不做）。

## Decisions

**取消 `SkillScope::Project` canonical（不保留死碼）**

直接從 enum、helper、type 拔掉。`canonical_skills_dir_for_scope` 收成回傳 `~/.felina/skills/` 的 const 函式（或直接呼叫 `paths::felina_global_skills_dir`）；`paths::felina_project_skills_dir` **完全刪除**（無 migration 需求，見下）。`SkillScope` enum 若還有其他 caller 仍以二元存在但僅用於 `SkillTarget.scope`，註解收緊。理由：選項曾考慮「保留 enum 但隱藏 UI」，但會在後端 enum、sidecar schema、import wizard 等多處留下永久死碼與行為陷阱，proposal Alternatives 已拒絕。測試重導：`paths::felina_home()` 加 `#[cfg(test)]` thread_local override，讓 canonical 測試把 `~/.felina/skills/` 指到 tempdir（取代原本用 `SkillScope::Project + tmp` 重導的手法）。

**`SkillTarget.scope=project` 語意收緊：push 目的地，而非主檔所在**

schema 不變（已是 `SkillTarget` 含 scope / project / enabled / mode 欄位），只是在 type 註解、Rust struct doc、Spec 描述都明確標示「scope=project 意指 push 目的地是某 project 的 agent 目錄」。Fan-out `resolve_pair` 行為不變，但需確保不再被誤用於主檔路徑解析（透過刪掉 `canonical_skills_dir_for_scope` 的 project 分支來強制）。

**不做 migration（project-scope canonical 是未發布的開發階段功能）**

明確不建 migration command 或 onboarding UI。project-scope `.felina/skills/` 從未發布給真實使用者，沒有存量資料需要遷移；為不存在的情境建遷移機器是多餘的向後相容殘留（proposal Alternatives 已拒絕）。Skills 頁不再讀 `<project>/.felina/skills/*`，這些（若開發者本機自測產生的）殘留就由人工刪除。

**UI：取消 Global/Project toggle + ProjectPicker，Skills 與 Projects 拆成 top-level view**

`src/router.tsx` 新增 `/projects` route，nav 共六頁（skills / projects / settings / templates / tokens / memory；既有 tokens 保留，本 change 只新增 projects）；nav label 由「Skills & Agents」改為「Skills」。`SkillsPage.tsx` 把 ScopeToggle、scope state、以及 ProjectPicker 全拔掉，整頁固定 global 行為（canonical 列表與 import scan 都走 global）；store 移除 scope/setScope。Projects view 是 sibling route，不在 Skills 內部。Skills 頁額外支援 `?select=<name>` deep-link（給 Projects 已納管行點擊跳轉用）。

**Projects view 兩欄佈局**

- 左欄 ProjectsList：呼叫 `known_projects_list` 取 Known Projects（含 exists）。預設選 L1（current cwd），無 L1 → 第一個 entry。`exists=false` 顯示「⚠ project not found」灰字（重用 (b) 的視覺）。
- 右欄 ManagedInventory：對選中 project 渲染納管清單表格。
- 純前端 component；無新後端 command。

**納管清單行 = union(scan_agent_dirs ∪ targets_pointing_at_this_project)**

來源組合（前端）：

1. `skill_import_scan(project_path=<selected>)` — 既有 scan 行為已能掃 project 的三個 agent 目錄並 collapse 同名 skill。但目前 scan 跟 canonical scope 綁定，需要釐清呼叫方式：本 change 將 scan 邏輯與 canonical scope 解耦，新增前端可用的「掃指定 project 的 agent 目錄」入口（或重用 `skill_import_scan` 並讓它接受 explicit project path）。
2. `canonical_skills_list` 結果中，每個 skill 的 targets 過濾出 `scope=project && project=<selected>`，取其 skill 名。

兩來源以 skill 名為 key union，產生行清單。每行的兩軸：

- 納管標籤 = 此 skill 是否出現在 (2) 中（global 主檔的 target 指向此 project）。
- per-agent chip 對應 agent = 此 skill 是否出現在 (1) 中對應 agent 的 scan 結果。

無新後端 command；若 `skill_import_scan` 簽名需調整，列為前端 invocation 重整（不增加新 command 條目）。

**動作集（D2）**

- 未納管的行：「Import to global」按鈕 → 呼叫 `skill_import_apply`（scope=global、來源來自 (1) 的 ImportCandidate）。完成後刷新納管清單。**若 global 已有同名主檔**，先跳 ConfirmDialog 確認覆蓋，不靜默蓋掉既有 global 主檔內容；確認訊息額外警告「若該主檔已有指向其他 project 的 target，下次 Push 會把這份新內容一併蓋到那些 project」，並提示同名但不同 skill 應改名而非覆蓋。
- 已納管的行：點擊整列 → navigate `/skills?select=<name>` 跳到 Skills view 並選中該主檔編輯。
- Projects view 內**不提供** target 編輯入口（避免雙重編輯入口），所有 target 增改在 Skills view 的 TargetEditor 完成。
- **無 import-all**：批次一鍵匯入 + 有 rename 的衝突解析屬 follow-up（見 Non-Goals）；本 change 只做 per-row。

**納管清單列排序**

`compareRows`：先 status（Managed=0 在前 / Unmanaged=1），再 action（import=0 / edit=1 / multi-source=2），最後 skill 名 alphabetical。結果順序：Managed（可編輯）→ Unmanaged 可匯入 → multi-source（deferred）。

**import 寫入單一來源 target（不 backfill）**

`skill_import_apply` 寫 sidecar 時用 `read_sync_meta_v2_no_backfill`（非 `read_sync_meta_v2`）：fresh import 的 sidecar 只含「來源那一條 target」，不會從 skill 的 `agents` frontmatter 額外 backfill 一條 global target（否則會出現「global + projectA 兩條」）。overwrite 既有主檔時保留原 target list、只加/保留來源 target。

**左欄 not-found 條目移除**

`exists=false` 的條目除了顯示警示外，若其來源含 `saved`（L3，存在 `~/.felina/known-projects.json`）則提供移除鈕 → ConfirmDialog → `known_projects_remove`。純 `detected`（L2）/ `cwd`（L1）來源不給移除鈕（刪了下次重掃會重現，給按鈕誤導）。只動 JSON 清單、不碰實際資料夾。

**SkillList 排序：無 target 的 skill 浮到上層**

`sortRank` 把 broken、dirty、以及**無 target（`targets.length === 0`）**的 skill 都歸到頂層 rank，其餘 alphabetical。新建但尚未設 target 的 skill 是 `dirty=false`，否則會沉到字母序；浮上層當「待設定」提醒。此行為在 `known-projects-and-multi-target`「dirty 語意統一」後失效，本 change 顯式恢復。

## Implementation Contract

**Behavior（可觀察）：**

- 啟動後 sidebar/route 看到 Skills 與 Projects 兩個並列 top-level entry。Skills 頁 header 不再有 Global/Project toggle。
- Skills 頁的 canonical skill 列表來源固定為 `~/.felina/skills/`；新建、編輯、import、push 全部在 global 發生。
- Projects 頁：左欄列 Known Projects（三來源 + exists，預設選當前 cwd）；右欄列該 project 的 skill 納管清單，每行帶納管標籤與三個 per-agent chip。
- Projects 頁 row 動作：未納管 → 「Import to global」按鈕成功後該行變已納管（同名衝突先確認）；已納管 → 點擊跳到 Skills 並選中該 skill。
- `<project>/.felina/skills/*` 既有目錄**不會被本 change 觸碰**（不讀、不寫、不刪）；Skills 頁列表**不再讀取**這些目錄。沒有 migration 流程。

**Interface / data shape:**

- `canonical_skills_dir_for_scope(scope, project_path)` → 收成 `canonical_skills_dir()` 回 global path；caller（`canonical_skills_list` / `read` / `write` / `delete` / `skill_targets_set` / `skill_prune_orphans_*` / fan-out / import）全面改用無 scope 版本。
- `paths::felina_project_skills_dir` 刪除。`paths::felina_home()` 加 `#[cfg(test)]` thread_local override 供測試重導。
- `SkillScope` enum：保留二元（Target 仍需要），加 doc 註解「only valid in SkillTarget.scope」。
- `skill_import_apply(project_path?, selections)`：寫入固定 global canonical，並依 `project_path`（`Some`→scope=project / `None`→scope=global）加對應 `SkillTarget`。`skill_import_scan(project_path?)` / `_scan_quick(project_path?)`：`None` 掃 global agent dirs、`Some` 掃該 project。
- `skill_prune_orphans_scan(skill_name)`：要掃哪些 project 的 agent dir 從 skill 自身的 `targets` 反推（不再由 caller 帶 project_path）；`OrphanFile` 加 `project` 欄位。
- 前端新增 component（無新後端 command）：ProjectsPage / ProjectsList / ManagedInventory。**不含** migration command 或 MigrationPanel。

**Failure modes:**

- 已選的 project exists=false：左欄保留條目並顯示警示（含 saved 來源則給移除鈕），右欄渲染空表 + 提示「找不到該 project 資料夾」。
- `skill_import_scan` 對不存在的 project_path：回空清單（既有行為），不報錯。
- Projects view 中 Import to global 遇 global 同名主檔：跳 ConfirmDialog 確認覆蓋，不靜默蓋。
- Skills 頁讀取時若仍找到 legacy `<project>/.felina/skills/*` 目錄：**不顯示**、不破壞、不刪除（無 migration，留給人工處理）。

**Acceptance criteria:**

- `npm run check` exit 0；`cargo build` exit 0，無新 warning（baseline 2 個 tokens/ warning 不計）。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` 不退化（baseline 62 tests）；canonical / fan-out / import 測試改用 `felina_home` override 重導 tempdir 後全綠。
- `spectra validate` / `analyze` Critical = 0、Warning = 0。
- 手動 smoke（書面回報）：(a) sidebar 六頁、Skills 頁無 Global/Project toggle 也無 ProjectPicker；(b) Skills 頁新建 / 編輯 skill 寫入 `~/.felina/skills/`，新建未設 target 的 skill 浮在清單上層；(c) Projects 頁左欄列 Known Projects、預設選 cwd、exists=false 顯示警示（saved 來源可移除）；(d) Projects 頁右欄列出 union 行、納管標籤與 per-agent chip 正確；(e) Unmanaged 行 Import to global 成功後變 Managed（同名衝突先確認）；(f) Managed 行點擊跳到 Skills view 並選中該 skill。

**Scope boundaries（與其他 change 的邊界）：**

- 與 `skill-sync-lifecycle` (c)：本 change 不處理 legacy `.felina/skills/` 清理（無 migration）；(c) 的 scope-move / cascade 若未來需要再獨立排程。
- 與 Coverage matrix view（已落地）：Skills 內 List/Summary toggle 仍存在，Summary 看的是 global 主檔的 target 覆蓋表，不受本 change 影響。Projects view 是 per-project 視角的不同 view，不取代 Coverage matrix。

## Risks / Trade-offs

- [取消 project-scope canonical 後，開發者本機自測殘留的 `<project>/.felina/skills/*` 變孤兒] → Skills 頁不再讀；因為從未發布、無真實存量資料，不提供 migration，由開發者手動刪除即可。
- [Projects view 拉多個 API 組 union → 大 project / 大量 skill 時前端組合成本] → v1 預期 skill 數 < 100、project 數 < 20，前端 union 成本可忽略；如 future 規模成長再考慮後端聚合 endpoint。
- [取消 Global/Project toggle 對既有 muscle memory 是 breaking UX] → 由於使用者已明確 painfully 體會雙 toggle 困惑，UX 改動方向與抱怨吻合，不視為負面 break。
