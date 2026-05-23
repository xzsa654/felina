## Context

`cross-project-push-and-coverage`（已 archived）讓 global 主檔可以 push 到任意 project 的 agent 目錄；同一 session 中，使用者明確指出雙 scope 模型違背 APP 初衷（skill 收斂），且 UI 兩個分頁實際上行為相同、persistently 製造認知負擔。本 change 從根本砍掉 `SkillScope::Project` canonical，讓 `~/.felina/skills/` 成為唯一真相來源；UI 層 Skills 與 Projects 拆成兩個 top-level view，Projects 重新定位為「該 project 的 skill 納管狀態 dashboard」。

技術棧：Tauri v2 + React 19 + TypeScript（strict）+ Tailwind v4 + Rust。後端 cargo test 守 regression；前端 npm run check 是唯一靜態 gate。`SkillTarget.scope=project` 早已支援跨 project（(b) 已落地），所以 fan-out 那層不需動 schema。

## Goals / Non-Goals

**Goals:**

- 刪除 `SkillScope::Project` canonical 分支（不保留死碼），單一 canonical 路徑 = `~/.felina/skills/`。
- 收緊 `SkillTarget.scope=project` 語意為「push 目的地是某 project 的 agent 目錄」。
- 提供一次性 migration CLI，把既有 `<project>/.felina/skills/*` 升級成「global 主檔 + 指向該 project 的 target」。
- UI 取消 Global/Project toggle；Skills（管理 global 主檔）與 Projects（納管清單）成為兩個 top-level view，從 sidebar/route 進入。
- Projects view 用既有後端 API（`skill_import_scan` / `known_projects_list` / `canonical_skills_list`）組出 union 納管清單，呈現「納管標籤 + per-agent chip」兩軸獨立狀態。

**Non-Goals:**

- C3 文字狀態欄、D3 就地改 target、A3 multi-project grid、Push dry-run / drift / cascade（(c) 範圍）、雙模式相容。

## In Scope / Out of Scope

**In scope:**

- 後端：移除 `SkillScope::Project` canonical 邏輯、收緊 `SkillTarget.scope` 註解 / 文件；新增一次性 migration command。
- 前端：取消 Skills 頁 toggle、Skills 改純 global；新增 Projects route + ProjectsPage / ProjectsList / ManagedInventory；移除 useSkillsStore 中與 canonical scope 相關的 state。
- Specs：`multi-agent-skills` MODIFIED、`known-projects` MODIFIED、`app-pages` MODIFIED、`projects-view` NEW。

**Out of scope:**

- 全面重寫 fan-out / SkillTarget schema（已支援跨 project，無需動）。
- Coverage matrix 重寫（Skills view 內仍可用作 global 主檔的 target 覆蓋表）。
- import wizard UX 重做（只去掉 project canonical 寫入點，其餘行為不變）。
- 跨平台路徑規則（已在 (b) 落地 + 寫入 `openspec/config.yaml`）。

## Decisions

**取消 `SkillScope::Project` canonical（不保留死碼）**

直接從 enum、helper、type 拔掉。`canonical_skills_dir_for_scope` 收成回傳 `~/.felina/skills/` 的 const 函式（或直接呼叫 `paths::felina_global_skills_dir`）；`paths::felina_project_skills_dir` 視 migration 需要保留 read-only helper，否則刪除。`SkillScope` enum 若還有其他 caller 仍以二元存在但僅用於 `SkillTarget.scope`，註解收緊。理由：選項曾考慮「保留 enum 但隱藏 UI」，但會在後端 enum、sidecar schema、import wizard 等多處留下永久死碼與行為陷阱，proposal Alternatives 已拒絕。

**`SkillTarget.scope=project` 語意收緊：push 目的地，而非主檔所在**

schema 不變（已是 `SkillTarget` 含 scope / project / enabled / mode 欄位），只是在 type 註解、Rust struct doc、Spec 描述都明確標示「scope=project 意指 push 目的地是某 project 的 agent 目錄」。Fan-out `resolve_pair` 行為不變，但需確保不再被誤用於主檔路徑解析（透過刪掉 `canonical_skills_dir_for_scope` 的 project 分支來強制）。

**一次性 migration CLI（依賴 (c) 的 cascade 行為已實作後才能完整跑通）**

新 Rust command 例如 `migrate_project_canonicals_scan` + `migrate_project_canonicals_apply`：scan 階段列出所有 `<project>/.felina/skills/*` 的 skill；apply 階段對每個 skill 執行「升級成 global 主檔 + 加一個指向該 project 的 target」，避免覆蓋既有同名 global 主檔（衝突時詢問或標 conflict 跳過）。Migration 不自動觸發，要使用者透過 CLI 或 UI 確認後才執行。是否需要 (c) 的 cascade prompt 配合（搬完後要不要清原 `.felina/` 目錄）由 (c) 落地後決定；本 change 預設不刪原目錄，留給使用者人工清理或等 (c)。

**UI：取消 Global/Project toggle，Skills 與 Projects 拆成 top-level view**

`src/lib/router.tsx` 新增 `/projects` route（或對等 sidebar entry）。`SkillsPage.tsx` 把 ScopeToggle 與 scope state 拔掉，整頁固定 global 行為；store 中 scope 改成 viewMode（List / Summary）或保留作 Skills 內部子模式，但與 canonical scope 完全脫鉤。Projects view 不在 Skills 內部，是 sibling route。

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

- 未納管的行：「Import to global」按鈕 → 呼叫 `skill_import_apply`（scope=global、來源來自 (1) 的 ImportCandidate）。完成後刷新納管清單。
- 已納管的行：點擊 → 跳轉到 Skills view 該主檔的編輯畫面（route 帶 skill name）。
- Projects view 內**不提供** target 編輯入口（避免雙重編輯入口），所有 target 增改在 Skills view 的 TargetEditor 完成。

## Implementation Contract

**Behavior（可觀察）：**

- 啟動後 sidebar/route 看到 Skills 與 Projects 兩個並列 top-level entry。Skills 頁 header 不再有 Global/Project toggle。
- Skills 頁的 canonical skill 列表來源固定為 `~/.felina/skills/`；新建、編輯、import、push 全部在 global 發生。
- Projects 頁：左欄列 Known Projects（三來源 + exists，預設選當前 cwd）；右欄列該 project 的 skill 納管清單，每行帶納管標籤與三個 per-agent chip。
- Projects 頁 row 動作：未納管 → 「Import to global」按鈕成功後該行變已納管；已納管 → 點擊跳到 Skills 並選中該 skill。
- `<project>/.felina/skills/*` 既有目錄在執行 migration command 前**不會自動消失**，且 Skills 頁列表**不再讀取**這些目錄。
- 執行 migration CLI 後，原 `<project>/.felina/skills/<name>` 對應的 skill 出現在 `~/.felina/skills/<name>`，且其 targets 含一個 `scope=project, project=<原 project 路徑>` 的 entry。

**Interface / data shape:**

- `canonical_skills_dir_for_scope(scope, project_path)` → 退化為 `canonical_skills_dir` 回 global path（或保留簽名但 Project 分支回 Err，配合 enum 變動）；caller 全面改用無 scope 版本。
- `paths::felina_project_skills_dir` 視 migration 保留 read-only 用途否則刪。
- `SkillScope` enum：保留二元（Target 仍需要），加 doc 註解「only valid in SkillTarget.scope」。
- 新增 Rust commands：
  - `migrate_project_canonicals_scan` 回 Vec<MigrationCandidate>：列出所有可遷移的 `<project>/.felina/skills/<name>` 條目（含 project_path、skill_name、global 是否衝突）。
  - `migrate_project_canonicals_apply` 接 Vec<MigrationAction> 回 Vec<MigrationResult>：執行單筆遷移（建 global 主檔 + 加 target；衝突時依使用者選擇 keep / overwrite / skip）。
- 前端新增 component（無 new backend command for view 本身）：
  - ProjectsPage.tsx（路由入口、左右欄組合）
  - ProjectsList.tsx（左欄 Known Projects + 選中狀態）
  - ManagedInventory.tsx（右欄表格、union 邏輯、納管 chip）

**Failure modes:**

- Migration 衝突（同名 global 主檔已存在）：scan 階段標示衝突，apply 階段依使用者選擇處理；不靜默覆蓋。
- 已選的 project exists=false：左欄保留條目並顯示警示，右欄渲染空表 + 提示「找不到該 project 資料夾」。
- `skill_import_scan` 對不存在的 project_path：回空清單（既有行為），不報錯。
- Projects view 中 Import to global 對名稱衝突：重用既有 `skill_import_apply` 的 conflict 流程（keep / overwrite / rename）。
- Skills 頁讀取時若仍找到 legacy `<project>/.felina/skills/*` 目錄：**不顯示**、不破壞，留給 migration CLI 處理。

**Acceptance criteria:**

- `npm run check` exit 0；`cargo build` exit 0，無新 warning。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` 不退化（baseline 62 tests），新增至少 4 個 test 覆蓋 migration scan/apply、`canonical_skills_dir` 行為。
- `spectra validate` / `analyze` Critical = 0、Warning = 0。
- 手動 smoke（書面回報）：(a) sidebar 看到 Skills / Projects 兩個 entry、Skills 無 toggle；(b) Skills 頁新建 / 編輯 skill 寫入 `~/.felina/skills/`；(c) Projects 頁左欄列 Known Projects、exists=false 顯示警示；(d) Projects 頁右欄列出 union 行、納管標籤與 chip 正確；(e) Import to global 成功後該行變已納管；(f) 已納管行點擊跳到 Skills view 並選中該 skill；(g) `migrate_project_canonicals_scan` 列出本機 `C:/MyProject/Pershing/felina/.felina/skills/git/`、apply 後該 skill 出現在 `~/.felina/skills/git/` 且 target 含對應 project。

**Scope boundaries（與其他 change 的邊界）：**

- 與 `skill-sync-lifecycle` (c)：cascade-vs-detach（搬完後是否清原 `.felina/`）由 (c) 落地；本 change 預設保留原目錄、不自動刪。
- 與 (c) 的 scope-move：本 change 的 migration 命令是 (c) scope-move 的反向特例（project → global），可共用底層 helper，但本 change 先實作 project → global 一次性 CLI；(c) 完整 scope-move（雙向 + UI）獨立排程。
- 與 Coverage matrix view（已落地）：Skills 內 List/Summary toggle 仍存在，Summary 看的是 global 主檔的 target 覆蓋表，不受本 change 影響。Projects view 是 per-project 視角的不同 view，不取代 Coverage matrix。

## Risks / Trade-offs

- [既有 `<project>/.felina/skills/*` 必須被使用者主動 migrate] → 沒跑 migration CLI 前，該 project 的舊主檔就是「孤兒」（Skills 頁不再讀）。提供 onboarding 提示（Projects view 偵測到該 project 有 legacy 目錄時提示一鍵 migrate），但不自動執行。
- [Projects view 拉了三個 API 組 union → 大 project / 大量 skill 時前端組合成本] → v1 預期 skill 數 < 100、project 數 < 20，前端 union 成本可忽略；如 future 規模成長再考慮後端聚合 endpoint。
- [取消 Global/Project toggle 對既有 muscle memory 是 breaking UX] → 由於使用者已明確 painfully 體會雙 toggle 困惑，UX 改動方向與抱怨吻合，不視為負面 break。建議落地時短期保留 inline help「以前的 Project 分頁去哪了？」說明指向 Projects top-level view。
- [Migration CLI 與 (c) cascade 行為的相依] → 本 change 預設不刪原目錄、不阻擋；若 (c) 先落地則 migration CLI 可加上「migrate 完是否清原 .felina/」prompt，否則保留 manual 清理。
