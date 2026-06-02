## Context

Projects page 是使用者檢視單一 project skill 狀態的入口。現行 `ManagedInventory` 以 `skill_import_scan(projectPath)` 與 `canonical_skills_list()` 建 row，但 row 的 agent icon 同時混入 project-local scan sources 與 canonical target agents，造成「來源」與「Felina 管理狀態」混淆。現行邏輯還會把 same-name canonical 已存在但未連到 selected project 的 row 顯示成 Import/Overwrite 流程，這與使用者真正想做的 link 行為不一致。

另外，Codex 與 Gemini Antigravity CLI 依 spec 共同使用 project-relative `.agents/skills/`。後端 scanner 會依 agent attribution 產生多個 candidates，這是正確資料模型；但 Projects page UI 若把同一 physical path 顯示成兩張來源卡，使用者會以為磁碟上有兩份不同檔案。

本 change 僅更新 Projects inventory 與相關 Spectra 行為，不進行 app-wide navigation 或 skill editor 重構。UI 需遵守 `$felina-ui-guidelines`：去表格化、文件中心化、狀態融入 row，不新增外掛式資訊列。

## Goals / Non-Goals

**Goals:**

- 將 Projects inventory row 拆成 Detected sources 與 Felina targets 兩個獨立語意軸。
- same-name canonical 已存在時，根據 target 狀態顯示 Managed、global duplicate、needs link 或 local-only import。
- Link to Project 前顯示 canonical/local 差異確認，避免下一次 push 無聲覆蓋不同內容。
- 將 shared `.agents/skills` multi-source UI 改成單一 physical source card + attribution 選擇。
- 保留 overwrite 作為明確次要動作，而非 same-name canonical 的預設主動作。
- 以 borderless list view、inline drawer、row-integrated chips 完成 UI，不使用 table 或硬格線。

**Non-Goals:**

- 不新增刪除 project-local skill 的 destructive flow。
- 不改變 `.agents/skills` shared-directory invariant。
- 不改變後端 import attribution side effects。
- 不改變 canonical sync-meta schema。
- 不新增第三方依賴。

## Decisions

### Two-axis inventory row model

`buildInventoryRows` 應輸出足以分開渲染的兩個集合：

- `detectedSources`: selected project scan 直接回傳的 source candidates，按 physical source path 分組。
- `felinaTargets`: same-name canonical master 中 relevant target 的 summary，只包含 `scope=global` 或 `scope=project` 且 normalized project path 等於 selected project 的 targets。

`managed` 僅在 canonical 有 enabled 且非 detached/forked 的 selected-project target 時為 true。Global target 可顯示 Felina global coverage，但不能讓 selected project row 成為 Managed。其他 project 的 target 必須完全排除在此 project row 的 target axis 之外。

替代方案是保留現有 union icon。拒絕原因：使用者問的是單一 project 底下有哪些 skill 與來源；union icon 會把其他 project 或 user-global availability 誤讀為本 project source。

### Same-name canonical resolution states

Row relationship 應至少能表達四種狀態：

- `managedProject`: canonical master 已有 selected project target。
- `canonicalGlobalOnly`: project-local source 存在，same-name canonical 只有 relevant global target，代表 local copy 與 Felina global 同名，需要 resolve。
- `canonicalExistsUnlinked`: same-name canonical 存在，但沒有 selected project target；可 Link to Project。
- `localOnly`: 沒有 same-name canonical；可 Import to Felina。

`canonicalGlobalOnly` 與 `canonicalExistsUnlinked` 的主動作不得是 overwrite。Link to Project 是主要路徑，但使用者必須先看到 canonical/local 差異確認；overwrite 是次要且明確標示風險的選項。

### Diff confirmation uses inline hunks computed at scan time

實作初版用後端 `summarise_diff` 回的字串（兩邊 lines / bytes 統計）已被驗證不足以讓使用者判斷差異 — 使用者無法看到實際被改動的內容。改為：

- 後端 `ConflictInfo` 新增 `hunks: Vec<DiffHunk>` 欄位，於 `skill_import_scan` 同一個 read 過程一併以行級 diff 算出，沿用 `commands/fan_out/mod.rs` 的 `build_diff_hunks`（`similar::TextDiff::from_lines` + `grouped_ops(3)`）。
- 計算時機：**scan-time（一律算）**，不採 lazy。Scan 已讀過 source 與 canonical 兩邊 raw 內容，順手 diff 成本低；資料一致性比省這次計算重要。
- 既有 `diff_summary` 字串保留作為 fallback（hunks 為空時的摘要）；不另開 preview-only command。
- 前端 Link confirmation dialog 改以 inline hunk renderer 呈現（與 `PullConfirmDialog` 的 diff 區塊視覺一致；視重用程度決定是否抽共用元件）。

替代方案：lazy 新增 `skill_import_preview_diff` command。拒絕原因：scan 已經算過 `summarise_diff`，要再 round-trip 一次只為產生 hunks 是無謂成本，也讓 row 渲染所需資料不一致。

### Terminology normalization (UI vocabulary)

使用者複審 dialog/badge 文案時指出三套詞並存（「Felina 中央控管庫」/「Global 主檔」/「Felina」），且「Global」一詞既被用來指 canonical 主檔又被用來指 target scope，造成語意混淆。本 change 統一規則：

- **Canonical 主檔** UI 一律用 **「Felina 主檔」**。
- **Global** 一詞 **僅限** target scope 語境（指 `~/.claude/skills/`、`~/.codex/skills/`、`~/.gemini/skills/` 等使用者層 agent 目錄，對應 `SkillTarget.scope = global`），不再被借用來指主檔。
- **不使用** 「Felina 中央控管庫」（非台灣慣用語）。

`canonicalGlobalOnly` badge 文案維持「全域重名」（使用者保留）；其他既有「Global 主檔」/「Felina 中央控管庫」字眼一律改為「Felina 主檔」。i18n key 名 `inventory.importToGlobal` 是 misnomer（實際 import 進 canonical 不是 global），但 key 重命名屬獨立正名工程，本 change 不動。

### Physical-source-first multi-source drawer

Drawer 的資料應按 normalized physical `sourcePath` 分組。當 Codex 與 Gemini candidates 指向同一 physical `.agents/skills/<name>/SKILL.md`，UI 顯示一張 shared source card，card 內顯示可選 attribution chips（Codex/Gemini）。當 candidates 指向不同 physical paths，UI 顯示多張 source cards。

使用者選擇 attribution 後，frontend 仍呼叫現有 `skill_import_apply` + `selectSource`，source index 必須對應到原始 `deferred.candidates` 中的 candidate。後端現有行為會保留 non-selected sources 為 disabled targets，這點不變。

### Felina UI presentation contract

Projects inventory 右欄必須維持 Felina 風格：

- 使用 list view，不使用 `<table>`。
- Row 透過 padding、hover `bg-bg-secondary/20` 或既有語意 token 表達互動，不使用硬格線。
- 狀態以 row-integrated chips/badges 表示，例如 Managed、New、Global duplicate、Needs link。
- Detected sources 與 Felina targets 使用一致的 agent icon/chip 視覺語彙。
- Diff confirmation 與 shared-source attribution 使用 inline drawer 或 compact inline panel；避免把狀態做成頁面中間的獨立 warning/info bar。

## Implementation Contract

**Behavior:**

- Projects right panel SHALL show each row's detected project-local sources separately from Felina target coverage.
- A selected project's Managed count SHALL include only rows with selected-project canonical targets.
- A same-name canonical global target SHALL be visible as Felina global coverage but SHALL NOT mark the selected project as Managed.
- A same-name canonical without selected project target SHALL show a Link/resolve path, not the normal Import to Felina primary button.
- Link to Project SHALL present canonical/local diff information before appending a target.
- Shared `.agents/skills` multi-source rows SHALL display one physical source card with Codex/Gemini attribution choices when candidates share the same path.

**Interface / data shape:**

- `InventoryRow` can add fields such as `detectedSources`, `felinaTargets`, and `relationship`; exact naming is implementation detail, but the model must support the behavior above without recomputing UI-only state in JSX branches.
- `skillTargets.set(skillName, targets)` remains the write interface for Link to Project.
- `skillImport.apply([{ candidate, resolution: { kind: "selectSource", sourceIndex } }], projectPath)` remains the write interface for attributed multi-source import.
- `ConflictInfo` (Rust struct + matching TS interface) gains `hunks: DiffHunk[]`. `DiffHunk` 與 `DiffLine` 沿用 `commands/fan_out/mod.rs` 已定義 shape（`oldStart`/`oldCount`/`newStart`/`newCount`/`lines[{ kind, content }]`）。`diffSummary` 字串保留。

**Failure modes:**

- If diff metadata is missing for a Link confirmation, the UI must not silently add the target. It must surface an inline error or fetch a preview command if one is implemented.
- If `skill_targets_set` fails, the row remains in its previous state and the existing error surface is used.
- If the canonical entry disappears between scan and action, reload inventory and show an error instead of falling back to overwrite.

**Acceptance criteria:**

- `npm run check` has no new TypeScript errors relative to baseline.
- Pure inventory row tests cover selected project target filtering, global target non-managed behavior, same-name canonical relationship states, and shared physical source grouping.
- Manual UI verification confirms no table/hard-grid presentation, no row text overlap, inline drawer attribution works, and Link confirmation appears before target mutation.

**Scope boundaries:**

- In scope: Projects inventory derivation, Projects row UI, multi-source drawer presentation, Link to Project confirmation, i18n, frontend tests.
- Out of scope: deleting project-local files, changing agent path configuration, changing sync-meta schema, changing Codex/Gemini backend import side effects, renaming project-local skills, i18n key 名 `importToGlobal` 的 key rename。後者兩項另開 change（暫名 `projects-local-skill-resolution` 涵蓋 rename / remove / detach；i18n key 正名屬獨立工程）。

## Risks / Trade-offs

- [Risk] Row model grows more complex → Mitigation: keep relationship/source grouping in pure helpers and cover them with node:test.
- [Risk] Link uses read-modify-write through `skill_targets_set` → Mitigation: desktop app is single-user; duplicate target prevention must compare normalized project paths before append.
- [Risk] Diff summary can be too shallow for nuanced content review → Mitigation: extend `ConflictInfo` with line-level `hunks` computed at scan-time using `build_diff_hunks`; render inline-diff UI in Link dialog. `diffSummary` 字串保留作為 fallback。
- [Risk] 詞彙混淆讓使用者誤判覆寫對象 → Mitigation: UI 一律用「Felina 主檔」指 canonical；「Global」僅用於 target scope；統一所有 dialog/badge 文案。
- [Risk] Shared physical source grouping could hide attribution consequences → Mitigation: card must show attribution choices and explain Codex sidecar behavior in concise inline text.
