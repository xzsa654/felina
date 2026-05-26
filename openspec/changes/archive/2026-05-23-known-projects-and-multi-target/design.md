## Context

`path-bug-and-target-model`(已 archived)建立了 sync-meta v2:`{ version: 2, targets: [{ agent, scope, project?, enabled, mode }], last_sync: {...}, dirty }`,並讓 fan-out 由 target 清單驅動。但該 change 為了行為等價,target 清單仍由 SKILL.md `agents` 欄位衍生(`canonical_skills_write` 寫入後呼叫對齊邏輯重建 targets;`read_sync_meta_v2` 對「v2 + 空 targets」會從 agents backfill)。專案 path 反解(`paths.rs::project_hash_to_path`)已能在 Windows 正確還原 cwd 或回報 unresolved。

本 change 把 target 清單從「agents 衍生」升級為「使用者顯式編輯」,並建立 Known Projects 三來源模型作為 project 選擇來源。技術棧:Tauri v2 + React 19 / TS + Rust;後端 cargo test 守 regression。

## Goals / Non-Goals

**Goals:**

- 建立 known-projects capability:三來源(L1 cwd / L2 auto-detect / L3 explicit JSON)合併、normalized-path dedupe、來源標記。
- per-skill target editor:list + add-target dialog,新建 skill 預設 empty targets。
- target 驅動來源從 agents 欄位轉為顯式清單;移除 agents-derived 對齊與 backfill heuristic;SkillEditor agents checkbox 退役。
- 顯式 orphan prune 動作(掃描 + 確認 + 刪除)。

**Non-Goals:**

- 跨 project 實際 push、coverage matrix view(留 (b))。
- push dry-run、push-time drift、canonical delete cascade prompt、multi-source import、任意路徑 import、scope 互移(留 (c))。
- forked overlay 渲染(Phase 2);UI 只顯示 disabled 佔位。

## Decisions

### Known Projects 三來源 + minimal storage

`~/.felina/known-projects.json` 採 minimal shape `{ projects: [path] }`,只持久化 L3(使用者顯式加入)。runtime 合併:

- **L1 cwd**:當前選定 project path(若有)。
- **L2 auto-detect**:列舉 `~/.claude/projects/<hash>`,逐個用 `paths::project_hash_to_path` 反解;unresolved 者略過(不進清單)。
- **L3 explicit**:讀 JSON 的 `projects` 陣列。

三來源 union 後以 normalized path(絕對路徑、`/` 分隔、去尾斜線、Windows casefold)dedupe。每筆 project 回傳時附 `sources: [cwd|detected|saved]`(可多重),供 UI 顯示來源 chip。新增 command `known_projects_list`、`known_projects_add`、`known_projects_remove`(後兩者只動 L3 JSON)。

理由:minimal schema 避免 metadata 維護負擔;L1/L2 動態算不進檔,語意上「JSON = 使用者顯式意圖」。替代(rich schema 帶 lastUsed/displayName)被否決,因為本 change 不需要排序 / 命名,等實際需要再升級。

### Target 來源:empty default + 顯式編輯(agents-derived 退役)

新建 skill 寫入的 sync-meta sidecar `targets` 為空陣列。`canonical_skills_write` 移除 align-to-agents 對齊呼叫(該函式整個刪除)。`read_sync_meta_v2` 移除「v2 + 非空 markers 但空 targets → 從 skill.agents backfill」的分支:v2 + 空 targets 就是「使用者尚未加任何 target」的合法狀態,直接回傳空清單。

**v1 sidecar 的 backfill 保留**:首次讀到 v1 sidecar(無 version / 無 targets 欄位)時,仍按 skill.agents x scope 衍生 tracked targets 作為一次性 legacy migration — 確保 path-bug-and-target-model 之前建立的舊 skill 升級後 target 不致全空。差異:v1 to v2 只在「從未被 target editor 觸碰過」時觸發一次;一旦使用者編輯過 targets(寫入 v2 sidecar),之後永遠以 v2 為準。

SkillEditor 移除 agents checkbox 區塊。`CanonicalSkill.agents` 欄位仍保留(SKILL.md frontmatter 仍可有 agents,作為 metadata / 未來 capability gate),但不再驅動 fan-out。

理由:符合 path-bug-and-target-model design 已預留的「預設空 + 顯式加」模型;target editor 上線後 agents 衍生會與顯式編輯語意衝突,必須二擇一。

### Target editor UI:list + add-target dialog

Skills 頁的 skill 詳情區新增 target editor:

- **List**:逐 target 一行,顯示 agent / scope / project(若 project scope)+ segmented control。空清單顯示 empty state「No targets yet — add one to push this skill」。
- **Segmented control**:每行 `Tracked / Disabled` 兩態（Tracked = enabled true + mode tracked；Disabled = enabled false + mode tracked）。`Detached`（Phase 2: drift detection）與 `Forked`（Phase 2: overlay rendering）均顯示但 disabled。後端 `TargetMode::Detached` 資料模型保留,UI 現階段不允許選擇。
- **`[+ Add target]` dialog**:選 agent(anthropic / codex / gemini)+ scope(global / project)。scope=project 時,project 下拉用 `known_projects_list` 結果,但本 change 只允許選「當前 project」(其餘 project entry disabled,附「cross-project: Phase 1.5 (b)」提示);`[Add cross-project target]` 入口在本 change 不啟用。加入後預設 Tracked。
- 刪除單一 target:每行末 trash icon,直接從清單移除(寫回 sync-meta)。

新增 command `skill_targets_set` 整批覆寫該 skill 的 targets(保留既有 last_sync 中仍對應到的 entry,prune 掉孤兒 key)。`dirty` 由 pushable target 存在性決定（`targets.iter().any(|t| t.enabled && mode == tracked)`），不再無條件設為 true。

- **建立時 buffered 模式**:建立新 skill 時 TargetEditor 以 buffered 模式顯示（`onTargetsChange` prop），targets 暫存在前端 state；Save 後先建 skill 再呼叫 `skill_targets_set` 寫入 targets,一步完成。
- **TargetEditor 位置**:位於 SkillEditor 上方（建立與編輯模式皆同），確保 targets 是使用者第一眼看到的資訊。
- **SkillList agent chips**:從 `skill.targets` 取得去重 agent 列表,不再使用 `skill.agents` frontmatter 欄位。
- **Push 按鈕**:dirty=true 時顯示「Push」；dirty=false 時不顯示任何按鈕（移除 Re-push）。
- **syncOne 刷新**:push 後呼叫 `loadEntries()` 從後端讀回完整 sync-meta,取代 partial optimistic update。

### 顯式 orphan prune

新增 `[Prune orphans]` 動作(skill 詳情區一個按鈕)+ command `skill_prune_orphans_scan` 與 `skill_prune_orphans_apply`。

- **Scan**:對該 skill,列舉所有 agent skill 目錄(由 `agent_paths_get` 解析的 global + 當前 project 路徑),找出存在 agent 目錄下 `<skill>/SKILL.md` 但對應 target 已不在清單(或 mode 為 Disabled)的殘留檔。回傳 `Vec<OrphanFile>`（含 path / agent / scope）。
- **Apply**:接收完整 `Vec<OrphanFile>`（非單純 paths），刪除確認的孤兒檔連同其 skill 子目錄,逐檔錯誤隔離;刪除後同步清除 sync-meta 中對應的 `lastSync` 記錄。`OrphanFile` struct 加 `Deserialize`。
- UI:scan 後跳 ConfirmDialog 列出待刪路徑,使用者確認才 apply。不在 toggle Disabled 時自動刪。建立模式下隱藏 Prune orphans 按鈕（skill 不存在,無意義）。

理由:prune 是 destructive 動作,顯式按鈕 + 確認比「toggle 即刪」安全。cascade/detach 一致性層(刪整個 canonical 時的 prompt)留 (c)。

## Implementation Contract

**Behavior(可觀察)**:

- 新建 skill 後其 sync-meta sidecar `targets` 為空、`dirty` 為 false,Skills 頁 target editor 顯示 empty state,PendingPushBar 不出現,Push 按鈕不顯示。
- 建立 skill 時 TargetEditor 以 buffered 模式顯示在 SkillEditor 上方,使用者可在 Save 前加入 targets;Save 後 skill 與 targets 一步建立。
- 使用者透過 `[+ Add target]` 加入 target 後,該 target 出現在 list、sidecar `targets` 含對應條目、`dirty` 為 true、Push 按鈕顯示,Push 寫入該 agent 目錄。
- target row 切 Disabled 後,Push 跳過該 target;若無其他 pushable target,`dirty` 為 false、Push 按鈕消失。
- Push 後 Sync info bar 即時更新（顯示 per-target 最後推送時間）。
- 既有(v1 sidecar)skill 首次讀取仍 backfill 出與 agents 一致的 targets;之後若使用者編輯過,以 v2 為準不再 backfill。
- Known Projects 清單反映三來源 union;auto-detect 對 unresolved hash 不出現在清單。
- `[Prune orphans]` scan 列出殘留 agent 檔,使用者確認後刪除並清除對應 `lastSync` 記錄;不誤刪仍在 target 清單內的檔。
- SkillList 的 agent chip 從 `skill.targets` 取得,反映實際推送對象。

**Interface / data shape**:

- `~/.felina/known-projects.json`:`{ projects: [string] }`。
- Rust `KnownProject { path: String, sources: Vec<ProjectSource> }`,`ProjectSource` enum `Cwd | Detected | Saved`(camelCase wire)。
- 新 command:`known_projects_list`(帶 current_project 參數)、`known_projects_add`、`known_projects_remove`、`skill_targets_set`(帶 scope / project_path / skill_name / targets)、`skill_prune_orphans_scan`(回 OrphanFile 清單)、`skill_prune_orphans_apply`(帶確認路徑清單)。
- TS:`KnownProject` / `ProjectSource` 型別;`api.knownProjects` 三條、`api.skillTargets.set`、`api.skillPrune` 兩條。
- sync-meta v2 schema 不變(沿用 path-bug-and-target-model 的結構);本 change 只改「targets 怎麼被產生 / 編輯」。

**Failure modes**:

- `known-projects.json` 缺失 / 非 JSON / 缺 `projects` 鍵 → 視為空 L3,只回 L1+L2,不報錯。
- `known_projects_add` 重複 path → dedupe 後無變化(idempotent)。
- auto-detect 反解失敗 → 該 hash 略過,不影響其他。
- orphan scan 對不存在的 agent 目錄 → 回空,不報錯。
- prune apply 單檔刪除失敗 → 該檔標記失敗,其他照刪。

**Acceptance criteria**:

- cargo test:(a) `known_projects_list` 對 L1+L2+L3 union dedupe by normalized path、source 標記正確、unresolved hash 不入清單;(b) `known_projects_add` / `known_projects_remove` 只動 L3 JSON 且 idempotent;(c) 新建 skill(canonical_skills_write)後 sidecar `targets` 為空;(d) `read_sync_meta_v2` 對「v2 + 空 targets」回空(不 backfill),對 v1 sidecar 仍 backfill;(e) `skill_targets_set` 覆寫 targets 並 prune 孤兒 last_sync key;(f) `skill_prune_orphans_scan` 正確辨識殘留檔(target 不在清單 / mode detached)、不誤報仍在清單的檔。
- `npm run check` exit 0;`cargo build` 無新 warning;`spectra validate` / `analyze` 無 Critical / Warning。
- 既有 path-bug-and-target-model + multi-agent-skills-foundation cargo test 不退化(下界 44)。
- 手動 smoke:新建 skill → target editor empty → add target → Push 寫入 → 切 Detached → Push 跳過 → prune orphans 掃出並刪除。

**Scope boundaries**:

- In scope:known-projects capability(後端 + 型別)、target editor UI(list + add dialog + segmented control)、empty-default + agents-derived 退役、SkillEditor agents checkbox 移除、顯式 orphan prune。
- Out of scope:跨 project push 實際寫入、coverage matrix、push dry-run、push-time drift、canonical delete cascade prompt、forked overlay 渲染、multi-source import、任意路徑 import、scope 互移。

## Risks / Trade-offs

- [agents-derived 退役破壞既有 skill] → v1 sidecar 首次讀仍 backfill,確保舊 skill 升級後 target 不全空;只有「從未被 target editor 編輯過」才 backfill,編輯後以 v2 為準。cargo test 覆蓋兩種路徑。
- [orphan prune 誤刪使用者手動放的檔] → scan 只標「對應 target 不在清單 / detached」的檔,且一律經 ConfirmDialog 顯式確認;不自動刪。trash 行為連 skill 子目錄一起刪,確認對話框需明列完整路徑。
- [auto-detect 列舉 `~/.claude/projects/` 的效能] → 只在 `known_projects_list` 呼叫時掃,UI 不在每次 render 觸發;若 project 數大導致 latency,留 (b) 視需要加 cache(本 change 不預先優化)。
- [agents 欄位語意懸置] → `CanonicalSkill.agents` 保留但不再驅動 fan-out,可能讓讀者困惑。以 design 與 spec 明文「agents 為 metadata,target 清單才驅動 fan-out」澄清;未來若確認 agents 無用可另開 change 移除。
