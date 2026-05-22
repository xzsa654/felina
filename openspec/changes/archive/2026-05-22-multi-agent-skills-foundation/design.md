## Context

`agent-skills-schema-reference`(archived 2026-05-21)已落地三個產出:(1) canonical SKILL.md schema 的 required / optional 欄位定義、(2) 三家 agent(Anthropic / Codex / Gemini)的 skill 路徑 + frontmatter + load mechanism 對照、(3) canonical → 各 agent 的欄位 mapping table。現行 `src-tauri/src/commands/skills.rs`(143 行)只懂 `.claude/skills/` 一家、沒有 canonical 概念,使用者要跨 agent 維護同一份 skill 必須手動複製。

本 change 是 product backlog Phase 1 的 foundation:把 skill 子系統重寫為「**canonical 主檔(`.glyphic/skills/`)是 source of truth + 三家 fan-out renderer 單向 push 到各 agent 原生位置**」的雙層架構,落實 schema-reference spec。Phase 2 的雙向同步、drift 偵測、normalize 警示、per-agent override **不在本 change scope** 內。

stakeholders:本機使用者(Glyphic 主要使用者群)。沒有外部 API caller,Tauri command 介面變動的衝擊面 = app 內部前端代碼,no external integration to break。

## Goals / Non-Goals

**Goals:**

- 把 canonical skill 主檔(snake_case YAML frontmatter + Markdown body)落實為使用者真正編輯與 git 追蹤的單一資料源。
- 讓使用者一份 skill 同步到三家 agent 原生 skill 目錄,UI 操作集中、不會「忘了同步」。
- UI 完全屏蔽 raw YAML;使用者只看視覺化表單,不需要記住欄位命名慣例(snake / kebab / split-file 等差異全部由 fan-out renderer 內部處理)。
- 首次啟動體驗:被動偵測既有 skill,主動提示一鍵 import,不破壞「使用者掌控」原則。
- Settings 端讓使用者覆寫 agent path 預設值,以應對 schema 漂移(例如 Gemini → Antigravity CLI 路徑變動)。

**Non-Goals:**

- **不做雙向 drift 偵測**。Fan-out 是單向 push,canonical 永遠領先;agent 端被改不會回流(留給 Phase 2)。
- **不處理 cross-agent 欄位 normalize 警示**。Canonical 的 Anthropic-only 欄位(如 `effort`、`shell`)同步到 Codex / Gemini 時直接被該 renderer 的 mapping rule 過濾,使用者不會收到提示(留給 Phase 2)。
- **不支援 per-agent override**。一份 canonical 對三家 agent 是同源輸出,不支援同名 skill 在不同 agent 的內容差異化(留給 Phase 2)。
- **不動 AGENT.md(subagent definition)子系統**。`list_agents` / `write_agent` / `delete_agent` 三條 command 與相關 UI 完全不動;subagent 規範跨 agent 研究尚未做,不在本 change scope。
- **不暴露第 4 家 agent 設定 UI**。canonical schema 的 `agents` 欄位資料結構支援未來擴充,但 Settings 只暴露三家(避免使用者誤設不存在的 agent)。
- **不引入 CodeMirror 或其他第三方編輯器**。Markdown body 編輯使用瀏覽器原生 textarea,本 change 不開語法高亮。
- **不做 skill 社群化 / marketplace 相關功能**(屬 Phase 3,需 server 端設計)。

## Decisions

**決策 1:Canonical 儲存目錄前綴採 `.glyphic/skills/`,與既有 `.claude/skills/` 並存(不取代)**

選擇:新增 `~/.glyphic/skills/<name>/SKILL.md`(global)與 `<project>/.glyphic/skills/<name>/SKILL.md`(project)。既有 `.claude/skills/` 從「skills 主場」降級為 Anthropic 的 fan-out 輸出目標,與 `.agents/skills/`(Codex)、`.gemini/skills/`(Gemini)平起平坐。

理由:`.claude/skills/` 既要當 canonical 又要當 Anthropic 輸出端,會產生「裡面的欄位該用 snake_case 還是 kebab-case」的雙重身份問題。物理隔離兩層職責讓 mental model 乾淨:`.glyphic/` = 「我編輯的」、各 agent skills 目錄 = 「app 推出去的」。

替代方案:把 `.claude/skills/` 直接當 canonical,Anthropic 不做 rename。捨棄理由:Anthropic-favoritism 違反多 agent 中性立場;且 canonical schema 採 snake_case 已是定案(`agent-skills-schema` spec 的 mapping table),Anthropic 端要做 snake→kebab,自然需要獨立輸出目錄。

**決策 2:Frontmatter 格式 = snake_case canonical YAML,Rust 用 serde_yaml parse 結構化 + body raw passthrough**

選擇:Rust 端定義 CanonicalSkill 型別,frontmatter required 三欄位(`agents` / `name` / `description`)強型別,其餘 optional 用 serde_yaml Value 通透保存;body 維持 raw String 不解析。

理由:三個 required 欄位是 schema-reference spec 的 Canonical Schema Definition Requirement 寫死的,值得用 Rust 型別保證。其餘 optional 欄位數量大、各 agent 各自有少數獨佔欄位,用通用 YAML value 通透保存 + fan-out renderer 各自取所需,避免 schema 增改要改 Rust struct。body 不解析符合 KISS 原則。

替代方案 A:完整強型別所有 optional 欄位。捨棄理由:schema 增改成本高、fan-out 對 vendor-specific 欄位的 passthrough vs ignore 決策被綁死。
替代方案 B:整份 frontmatter 都 raw string。捨棄理由:`agents` 欄位是 sync 控制核心,Rust 端需要直接讀取決定 fan-out target;完全 raw 則每次 sync 都要 reparse。

**決策 3:Module 結構 = canonical_skills.rs + fan_out 子模組(per-agent renderer 各一檔)**

選擇:後端 layout:`src-tauri/src/commands/canonical_skills.rs`(canonical CRUD + sync trigger)、`src-tauri/src/commands/fan_out/mod.rs`(sub-module register + 共用 FanOutRenderer trait)、`src-tauri/src/commands/fan_out/anthropic.rs`(snake → kebab-case;單檔輸出)、`src-tauri/src/commands/fan_out/codex.rs`(SKILL.md + 拆出 openai.yaml sibling 檔)、`src-tauri/src/commands/fan_out/gemini.rs`(只複製 name + description;其餘 ignore)、`src-tauri/src/commands/skill_import.rs`(import 掃描 + 衝突偵測)。

理由:每個 renderer 內部都是「拿 CanonicalSkill → 轉成該 agent 格式 → 寫檔」的單一職責;trait 抽象讓未來新增第 4 家 agent 只要實作 trait + 加進 fan_out 子目錄即可,不必動 canonical 層。Interface depth check 三項通過(seam 在 canonical 與 renderer 之間;1 個 canonical adapter + 3 個 renderer;深度足夠:renderer 真的會做欄位 rename / 拆檔 / filter,不是 pass-through)。

替代方案:三家 renderer 合成一個 fan_out.rs 用 match agent name 分支。捨棄理由:三家拆檔邏輯(Codex)與 ignored 欄位策略(Gemini)差異大,合在一檔 if/else 會迅速膨脹到難讀。

**決策 4:UI 完全屏蔽 raw YAML — 視覺化表單為唯一 frontmatter 編輯介面,raw YAML 不提供 preview**

選擇:SkillEditor 上半部 = Properties 視覺化表單(每個 canonical 欄位一個 UI 元件:text input / multi-select / boolean toggle / enum dropdown),下半部 = Markdown body textarea(無 syntax highlight,維持 KISS)。不提供 Raw YAML preview 或 Switch to YAML mode。Advanced collapsible 區域收納低頻欄位(`effort`、`context`、`paths`、`shell` 等)。

理由:discuss 階段使用者明確表達「raw YAML 不暴露,連 preview 都 UI 化」。實作上多一層 translation layer(UI form state 與 CanonicalSkill struct 雙向轉換)成本可接受,換取「使用者完全不需要知道 snake / kebab / split-file 細節」的乾淨體驗。Advanced collapsible 解決欄位過多視覺擁擠問題。

替代方案:提供 read-only raw YAML preview tab 給進階使用者 debug。捨棄理由:進階使用者本來就能直接編 `.glyphic/skills/<name>/SKILL.md`(主檔可 git 追蹤),不需要走 UI;留 raw preview tab 等於暴露 schema 細節,反而誤導「YAML 是 first-class 編輯介面」。

**決策 5:同步動線 = Dirty bit + 頂端 sticky pending-push bar(不 auto-push,per-skill button 與一鍵全推並存)**

選擇:在 Zustand store `skills-store.ts` 維護 dirty 與 lastSynced 狀態。Skills 頁:列表每列右側顯示 dirty 紅點 + per-skill Push 按鈕;列表頂端固定一條 sticky bar(N skills changed since last sync 加 Push all);Editor 存檔成功後 dirty bit 立刻翻 true;Push 後 dirty 翻 false、lastSynced 更新。不做存檔即推送的 auto-push。

理由:phase 1 沒 drift 偵測,「忘了按 Sync」會持續到 phase 2 才被抓到。集中度從 N 個按鈕變 1 個 sticky bar,使用者不會漏。同時保留 explicit push(per-skill 與 push all 兩種粒度),避免 auto-push 的驚嚇感與磁碟 I/O 浪費。

替代方案 A:存檔即 auto-push 三家。捨棄理由:磁碟 I/O 浪費 + 缺乏「我準備好了」的控制點。
替代方案 B:只有 per-skill Push,沒有 sticky bar。捨棄理由:N 個 skill 改過時要逐一點 push,煩躁度高。

**決策 6:Initial import = 手動精靈 + 首次啟動 dismissable banner(被動偵測,主動觸發)**

選擇:Skills 頁掛載時以 canonical_skills_list 拉清單,同時呼叫 skill_import_scan_quick 數三家 agent 目錄子目錄數(不讀內容,快)。若 canonical 清單為空且任一 agent 目錄含子目錄,顯示 dismissable banner(Detected N existing skills 加 Import 加 Dismiss)。點 Import 進精靈(細掃 + 候選清單 + 同名衝突 diff + 使用者勾選 + apply)。Dismiss 持久化,不再提示直到使用者主動清除。

理由:純 startup auto-import 會卡 splash 並違反「使用者掌控」;純手動則使用者首次體驗看到空頁面困惑。被動偵測 + 主動提示是 IDE 業界標準。

替代方案:第一次啟動強制跑 import wizard。捨棄理由:強制流程在「使用者就是不想 import,直接寫新 canonical」場景會煩人。

**決策 7:AGENT.md(subagent definition)子系統不動**

選擇:現有的 list_agents / write_agent / delete_agent 三條 command + 內部 helper 保留;對應前端 wrapper、UI 不動。本 change 只移除 skill 三條 command(list_skills / write_skill / delete_skill)。

理由:三家 agent 的 subagent 規範跨家對照尚未做(schema-reference 只研究 skills),貿然動 subagent 子系統會踩到「我以為三家 subagent 都長一樣」的 placeholder 風險(schema-reference 已踩過一次教訓)。Scope 紀律。

替代方案:同時重寫 subagent 子系統。捨棄理由:scope 撐到 20+ tasks,且基礎研究(subagent schema reference)沒做,設計依據不足。

**決策 8:Settings agent paths 可覆寫,預設值來自 schema-reference spec,路徑驗證拒絕越界 traversal**

選擇:Settings 頁新增 collapsible Agent Paths 區,三家各兩條(global / project)共 6 個欄位,預設值來自 schema-reference spec(Anthropic `~/.claude/skills/` 與 `.claude/skills/`、Codex `~/.agents/skills/` 與 `.agents/skills/`、Gemini `~/.gemini/skills/` 與 `.gemini/skills/`)。設定持久化到 `~/.claude/settings.json` 自訂 key。每個欄位旁顯示偵測到的 skill 數。路徑驗證:reject 含上層目錄段、reject 絕對路徑 traversal、normalize separator。失敗時 fall back 到 spec 預設並 surface warning。

理由:schema-reference spec 預期會隨 vendor 變動 stale(Gemini 轉 Antigravity CLI 已知時程內會發生),使用者需要 escape hatch 而不必等下次 Glyphic release。Path 驗證避免 fan-out 寫到 sandbox 外造成資料外洩。

替代方案:寫死路徑、不開放覆寫。捨棄理由:vendor 路徑漂移會把使用者鎖死在 stale Glyphic 版本。

## Implementation Contract

**Behavior(本 change 完成後使用者觀察到的結果):**

- 使用者打開 Skills 頁,看到 canonical skill 清單(scope filter 切 global / project)。
- 點任一 skill 進編輯器,Properties 區是視覺化表單(text input / multi-select / boolean toggle / enum dropdown 對應 canonical 欄位),Body 區是 textarea。無 raw YAML 介面。
- Edit 後存檔,列上出現紅點 dirty 標記,頂端 sticky bar 出現 N skills changed 加 Push all。
- 點 Push all 或 per-skill Push,三家(或 skill agents 欄位指定的 subset)目錄出現 / 更新對應檔案:`.claude/skills/<name>/SKILL.md`(kebab-case frontmatter)、`.agents/skills/<name>/SKILL.md` 加 `.agents/skills/<name>/agents/openai.yaml`(拆檔)、`.gemini/skills/<name>/SKILL.md`(極簡 frontmatter)。Push 後 dirty 紅點消失,lastSynced 顯示時間戳。
- 首次啟動偵測到 `.claude/skills/` 等位置有檔案時,Skills 頁頂部顯示 dismissable banner;點 Import 進精靈;Dismiss 後不再提示。
- 設定頁 Agent Paths 區可覆寫 6 個 agent skill 目錄路徑,改完即時影響 fan-out 寫入位置與 import 偵測範圍。
- AGENT.md / subagent 子系統 UI 完全不變。

**Interface / 資料契約:**

新增 Tauri commands(註冊到 lib.rs invoke_handler):

- canonical CRUD:`canonical_skills_list(scope, project_path?)` 回 `Vec<CanonicalSkill>`;`canonical_skills_read(scope, project_path?, name)` 回 `CanonicalSkill`;`canonical_skills_write(scope, project_path?, name, frontmatter, body)` 回 unit;`canonical_skills_delete(scope, project_path?, name)` 回 unit
- fan-out sync:`skill_sync_one(scope, project_path?, name)` 回 `Vec<SyncResult>`;`skill_sync_all(scope, project_path?)` 回 `Vec<SyncResult>`
- import:`skill_import_scan_quick(scope, project_path?)` 回 `ImportScanQuick`;`skill_import_scan(scope, project_path?)` 回 `Vec<ImportCandidate>`;`skill_import_apply(scope, project_path?, selections)` 回 unit
- agent paths config:`agent_paths_get()` 回 `AgentPathsConfig`;`agent_paths_set(config)` 回 unit

移除 Tauri commands:list_skills / write_skill / delete_skill。list_agents / write_agent / delete_agent 保留不動。

核心資料型別(Rust):

- CanonicalSkill { name: String, description: String, agents: Vec of String(子集 anthropic/codex/gemini), frontmatter_extras: serde_yaml Value(其餘 optional 欄位通透保存), body: String, dirty: bool, last_synced: Option of DateTime }
- SyncResult { agent: String, scope: String, target_path: String, success: bool, error: Option of String }
- ImportCandidate { source_path: String, source_agent: String, skill_name: String, body_preview: String, conflict: Option of ConflictInfo }
- ConflictInfo { canonical_path: String, canonical_body_preview: String, diff_summary: String }
- ImportSelection { candidate: ImportCandidate, resolution: ImportResolution(KeepCanonical / OverwriteCanonical / Skip / Rename) }
- AgentPathsConfig { anthropic: AgentPathPair, codex: AgentPathPair, gemini: AgentPathPair }
- AgentPathPair { global: String, project_relative: String }

Frontmatter dirty / last_synced 持久化:每個 canonical skill 目錄底下放 sync-meta JSON 檔(被 gitignore 排除,使用者本機狀態而非 source of truth)。

**Failure modes:**

- Frontmatter parse error(YAML 語法錯):canonical_skills_read 回 Err,前端在列表標 broken skill;Editor 顯示「無法解析 frontmatter」placeholder 加原檔開啟連結。
- Fan-out target 目錄不存在:renderer 自動 create_dir_all,不視為錯誤。
- Fan-out target 目錄不可寫(permission denied 或 disk full):SyncResult.success = false 加 error,前端在該 agent badge 顯示紅色錯誤標,其他 agent 同步繼續。
- Import wizard 同名衝突:阻塞至使用者選 resolution;Skip 也算選擇。
- Agent path 設定含上層目錄 traversal 或絕對路徑越界:agent_paths_set 回 Err,Settings 頁標欄位紅框,fall back 到舊值。
- glyphic skills 目錄不存在:第一次 canonical_skills_write 時自動建立;canonical_skills_list 對不存在目錄回空 Vec。
- 三家 path 都被 detect 為空但 canonical 也空:banner 不顯示(沒得 import)。

**Acceptance criteria:**

- npm run check exit 0(baseline diff = 0)。
- cargo build exit 0,不引入新 warning。
- 手動 smoke(npm run tauri dev):
  1. 新建 canonical skill(global scope),glyphic skills 目錄下出現 SKILL.md,內容含 snake_case YAML。
  2. Edit frontmatter agents 為三家全選、Push all,三個目錄各出現一份 rendered file,Anthropic 為 kebab-case、Codex 為 SKILL.md 加 openai.yaml 兩檔、Gemini 為極簡 frontmatter。
  3. 改 canonical body,列上紅點出現、頂端 bar 顯示 1 skill changed、Push 後紅點消失。
  4. 預先放一份 fake-skill 到 claude skills 目錄,啟動 app 看到 banner、跑 import 後 canonical 出現 agents anthropic 的 fake-skill。
  5. Settings 改 Gemini path 為 agents skills alias,重新 Push 後檔案落在新路徑。
- spectra validate multi-agent-skills-foundation valid;spectra analyze Critical / Warning = 0。

**Scope boundaries:**

- **In scope**:canonical CRUD(global 加 project)、三家 fan-out renderer 單向 push、initial import 精靈 加 banner、Settings agent paths 可覆寫、pending-push UI、frontmatter 視覺化編輯器、UI form 與 canonical YAML 雙向 translation layer、Skills 頁完整重寫、舊 skill commands 移除。
- **Out of scope**:雙向 drift / reverse sync、cross-agent normalize 警示、per-agent override、AGENT.md / subagent 子系統重寫、第 4 家 agent UI 暴露、CodeMirror 或 Markdown body 語法高亮、skill 社群分享、bulk operations。

## Risks / Trade-offs

- **[Risk] Path traversal 攻擊面**:使用者自訂 agent paths 含上層目錄段可能讓 fan-out 寫到 sandbox 外。Mitigation:agent_paths_set 嚴格驗證(normalize、reject 上層目錄段、reject 絕對路徑 escape user home / project root)。本 change 觸發 /spectra-audit(讀寫使用者檔案系統 加 處理使用者輸入路徑)。
- **[Risk] Frontmatter schema 版本演進**:三家 vendor 都會持續加欄位,canonical schema 跟不上時 frontmatter_extras 雖能 passthrough,但 UI 不會暴露新欄位給使用者編輯。Mitigation:本 change 接受此限制,日後可加 generic Custom field UI 區;raw YAML debug 入口目前被決策 4 拒絕,可後續評估。
- **[Risk] Windows / Unix 路徑分隔符不一致**:Mitigation:全部用 std PathBuf;UI 顯示統一以斜線呈現,寫檔讓 OS native。
- **[Risk] 雙資料源誤解**:使用者可能不確定 glyphic skills 與 claude skills 哪邊是 source of truth。Mitigation:首次 import 流程明確告知 claude skills 變成 output target;Skills 頁 footer 加 Source of truth 永久提示。
- **[Risk] UI form 元件爆炸**:canonical 有約 15 個 optional 欄位。Mitigation:Properties 區拆 required 與 collapsible Advanced,Advanced 預設折疊。
- **[Trade-off] 不做 auto-push 換取磁碟 I/O 友善,代價是使用者需主動點 Push**:接受,sticky bar 提示足夠強。
- **[Trade-off] 不暴露 raw YAML 編輯**:進階使用者要 raw 編必須跳出 app 改主檔(主檔可 git 追蹤,跳出去編是正常工作流)。接受。

**安全敏感性評估:** 本 change 需要 /spectra-audit。涉及讀寫使用者檔案系統(glyphic / claude / agents / gemini skills 目錄)、處理使用者輸入(自訂 agent paths)、可被 path traversal 利用。Audit 重點:(1) agent_paths_set 路徑驗證、(2) canonical_skills_write 不被 skill name 注入越界(例如 name 含上層目錄段)、(3) fan-out renderer 寫檔前再做一次 sandbox check、(4) import 精靈不被惡意 source path 利用(讀檔前 normalize)。

**第三方依賴變動:**

- Cargo:新增 serde_yaml(約 50KB,MIT/Apache-2.0 雙授權,frontmatter parse 用)。`last_synced` timestamp 改用 std `SystemTime` + 內聯 civil-from-days 計算 ISO-8601,**不引入 chrono**(原 design 預估但實作評估不必要,純整數運算 ~15 行)。對 bundle size 影響小於 1%。
- npm:無新增。

---

## Mid-Apply Addenda (recorded 2026-05-22 during smoke pass)

These extend the design while implementation was in progress, after live smoke-testing surfaced gaps. Recorded inline rather than via `/spectra-ingest` because each is a small specification refinement, not a re-scoping.

**Addendum A: Product rename `Glyphic` → `Felina`**

Project forked from upstream `Glyphic` and is now rebranded `Felina` for our use. This revises **決策 1**:
- Canonical storage prefix `.glyphic/skills/` → **`.felina/skills/`** (global at `~/.felina/skills/`, project at `<project>/.felina/skills/`).
- Settings key in `~/.claude/settings.json`: `glyphic.agentPaths` → **`felina.agentPaths`**.
- Sync-meta sidecar filename: `.glyphic-sync-meta.json` → **`.felina-sync-meta.json`**.
- Cargo package `glyphic` → `felina`; lib name `glyphic_lib` → `felina_lib`; Tauri identifier `com.caio.glyphic` → `com.pershing.felina`; product name + window title → `Felina`; localStorage keys (`glyphic-theme`, `glyphic-locale`, `glyphic-onboarded`) renamed to `felina-*`; sidebar / onboarding / settings UI strings updated.

Out of scope of this rename (Billy's token-analytics persistence): `~/.glyphic/tokens.db` and `~/.claude/glyphic-settings.json` remain on the old name to avoid orphaning existing token-history data. A migration task can land separately.

**Addendum B: Bundled-files passthrough (extends Fan-Out Requirement)**

The three vendors' skill formats all support bundled siblings (`scripts/`, `references/`, `assets/`, `examples/`, `agents/`). The original Fan-Out Requirement described only `SKILL.md` rendering, which would silently truncate any imported skill that relied on bundled files. The implementation now:

1. **On import** (`skill_import_apply`): copies the entire source skill directory tree into canonical, except `SKILL.md` (which is rewritten with normalised required fields) and the local sync-meta sidecar.
2. **On fan-out** (after each successful render): mirrors all canonical siblings into each agent target directory, except `SKILL.md` (the renderer wrote the right per-agent mapping) and the sidecar.

Codex's split-file output (`agents/openai.yaml`) is written **after** the bundled copy, so canonical's `agents/` dir merges cleanly with the renderer's output. Symlinks in canonical bundled dirs are ignored on copy (safer than blind follow).

This addition refines the **Fan-Out to Agent Targets** Requirement to read "render the canonical SKILL.md + mirror bundled siblings", without changing any of the existing scenarios.

**Addendum C: UX revisions during smoke**

- **SkillEditor Save button** moved to the editor header (next to Delete) to keep it always reachable without scrolling — the bottom-anchored Save broke responsive layout on small windows.
- **Per-skill Push button always enabled** (re-labels to "Re-push" when not dirty) — the original `disabled when !dirty` blocked re-pushing imported skills (which arrive with `dirty=false` from sync-meta).
- **Reload button** gained a spinner + `Reloading…` state so the action has a clear visual ack.
- **Last push results panel** added below the import banner: per-target ✓/✗ + target path + error string. Lives in `SkillsPage`, reads from `useSkillsStore().lastSyncResults`.

These three are UI-only revisions and do not alter any Requirement's wire format.

**Addendum D: Gemini path probe**

Per the Open Question from Session-5 handoff (re-verified during apply against `antigravity.google/docs/skills` + `sickn33/antigravity-awesome-skills` README): Antigravity CLI uses `~/.gemini/antigravity/skills/<name>/SKILL.md` for global skills, which is **not** the path documented in the current `agent-skills-schema` spec. Implementation:

- Default `AgentPathsConfig.gemini.global` still ships as `~/.gemini/skills` (spec text unchanged this cycle; see `agent-skills-schema` spec patch as a follow-up).
- `skill_import_scan_quick` / `skill_import_scan` **additionally** probe `~/.gemini/antigravity/skills/` in global scope so users on Antigravity see their skills regardless of which CLI they used.
- Settings → Agent Paths override is the documented escape hatch (決策 8 already mandates this).

Gemini-cli's consumer sunset date is **2026-06-18**; spec text update should land before then.

**Addendum E: Smoke verification — programmatic backend contracts + user UI spot-check**

Task 8.2's original acceptance read "five smoke steps manually confirmed OK". In practice the user manually completed only step #4 (import banner / wizard, which surfaced the bundled-files gap that Addendum B fixed); steps #1 / #2 / #3 / #5 remained unverified at end-of-apply, blocking the change from being declared user-accepted.

This addendum splits smoke verification into two layers so steps stop relying on a single full-UI dry run:

- **Backend contracts** — automated. Each step's observable backend contract is encoded as a `cargo test --lib` regression so future refactors can't silently regress the behavior.

  | Smoke step | Behavior | Test |
  | --- | --- | --- |
  | #1 New canonical (write + read round-trip) | `canonical_skills_write` creates `.felina/skills/<name>/SKILL.md`, frontmatter required fields preserved, extras pass through | `canonical_skills::tests::write_creates_dir_and_round_trips_through_read` (already present) |
  | #2 Push to all three agents + bundled siblings | `skill_sync_one` with `agents=[anthropic,codex,gemini]` and bundled `scripts/`+`references/` produces SKILL.md + mirrored siblings in every target; sync-meta sidecar does NOT leak into rendered targets | new — `fan_out::tests::fan_out_to_three_agents_mirrors_bundled_siblings` |
  | #3 Dirty → push → clean transition | A canonical sidecar pre-set `dirty=true` flips to `dirty=false` with populated `last_synced` after a successful `skill_sync_one`; the change surfaces through `canonical_skills_list` | new — `fan_out::tests::sync_meta_dirty_flips_false_after_successful_push` |
  | #5 Agent path traversal reject | `agent_paths_set` rejects `AgentPathPair` containing `..` segments or absolute / drive-letter `projectRelative` | `agent_paths::tests::validate_rejects_traversal` (already present) |

- **UI spot-check** — user-driven, single pass. The user runs `npm run tauri dev` once and confirms there are no visual / interaction regressions in: SkillEditor Save button position (Addendum C #1), bundled-files visibility after push (Addendum B), Per-skill Push button label flip (Addendum C #2), Reload spinner (Addendum C #3), Settings → Agent Paths Gemini path edit + reject feedback. This is not encoded as a test; the contract is "no regressions observed by the user".

Revised acceptance for task 8.2 (recorded retroactively here rather than mutating the completed task): three automated gates green (npm check, cargo build, spectra validate/analyze) **AND** the four cargo tests above passing **AND** user-confirmed UI spot-check. Task 8.3 (added during ingest) captures the work that completes this revised contract — the [x] mark on 8.2 is preserved as the historical "everything that was checkable at the time" record, with 8.3 as the proper completion gate before `/spectra-archive`.

In scope of this addendum: the smoke acceptance restructure described above.
Out of scope: any deeper UI integration testing harness (e.g. Playwright / Tauri WebDriver) — Felina has no test runner for the frontend layer and adding one is its own change.

**Addendum F: UI spot-check fixes (regressions found during Addendum E execution)**

Running the smoke spot-check surfaced four issues that were below the task-8.2 self-audit threshold but degrade the user experience. Fixed in this change to keep S3 honest before archive:

1. **SkillEditor full-width form controls.** Body (Markdown) textarea, Description textarea, and Name input rendered at their intrinsic widths and overflowed the editor pane (clipped by the surrounding `overflow-hidden` card). Fix: add `w-full` to all three; add `resize-y` to the Body textarea so the user can adjust height. Behavior: form controls now span the editor's full width regardless of window size.

2. **Agent paths validation error → confirm-required modal.** Path-traversal / absolute-path rejections from `agent_paths_set` previously rendered as a small inline tile inside the collapsible section, which the user reported as easy to miss given the section's vertical density. Fix: replace the inline `<div>` with a centered modal (role=`alertdialog`, aria-modal) that displays the full error message in monospace + a single "OK" button. Backdrop is intentionally non-clickable — dismissal requires the OK click ("不會自動消失"). The success ("Saved.") message stays inline; only errors go modal.

3. **New / edited canonical surfaces as `dirty=true`.** `canonical_skills_write` previously left the per-skill `.felina-sync-meta.json` sidecar alone, so freshly-created or freshly-edited skills appeared with `dirty=false` and the per-skill Push button mis-labelled as `Re-push` (and the pending-push bar didn't surface them). Fix: `canonical_skills_write` now writes sync-meta with `dirty=true` after a successful SKILL.md write, preserving any existing `last_synced` timestamp (so the UI can still report "last pushed at …" after an edit). This is a backend semantic patch, not a UI tweak — the optimistic frontend `upsertEntry({...dirty:true})` was being clobbered by `loadEntries()`'s disk read; making the disk side authoritative removes the race.

4. **Skill delete confirmation → shared `ConfirmDialog`.** Skill deletion used `window.confirm()` (browser-native), which clashes visually with the rest of the page. Fix: route deletion through the existing `shared/ConfirmDialog` component with a Delete-button-styled confirm and an explicit message noting that agent-side copies are NOT touched. `window.alert` for the rare delete-failure case stays for now; replacing it would warrant its own shared `AlertDialog` extraction.

Verification: covered by task 8.4 + user re-spot-check. New cargo regression for #3: `canonical_skills::tests::write_marks_canonical_dirty_in_sync_meta` (first write → dirty=true with no `last_synced`; second write on a previously-synced skill → dirty=true with prior `last_synced` preserved).

In scope: the four fixes above.
Out of scope: shared `AlertDialog` component extraction for `window.alert` callsites; broader form-control width audit beyond SkillEditor (other pages may have the same pattern but were not reported).

**Addendum G: Skills page layout + page-scaffold height contract fix**

A second UI spot-check pass found the Skills list/editor columns scrolled the whole page instead of scrolling independently, the pending-push bar overlapped text while scrolling, the column bottom borders were clipped below the fold, and pushed/dirty ordering was unstable. Root cause for the border clipping was a latent scaffold bug, not Skills-specific.

Fixes:

1. **Skills page two-column scroll.** `SkillsPage` body is now `h-full flex flex-col min-h-0`; the list/editor grid is `flex-1 min-h-0` with each column `overflow-y-auto`. Each column scrolls independently instead of growing the page.
2. **PendingPushBar de-stickied.** Was `sticky top-0 z-10 -mx-6` with a translucent background, which overlapped scrolled content. Now a normal-flow rounded banner in the fixed header region.
3. **Page-scaffold height contract (affects all routed pages).** The router Outlet wrapper (`src/router.tsx`) was `flex-1 overflow-hidden` (not a flex column) while holding `PageHeader` + `PageBody` siblings; `PageBody` used `h-full`, so its height (100% of the container) plus the header's height exceeded the container and the bottom was clipped by `overflow-hidden`. Fix: wrapper → `flex-1 overflow-hidden flex flex-col min-h-0`; `PageBody` (`shared/PageScaffold`) → `flex-1 min-h-0` instead of `h-full`. This is a shared-scaffold change; verified the other four routed pages (settings, tokens, templates, memory) render correctly under a flex-col parent (each is a single in-flow `h-full` child or a PageBody page).
4. **Skill list ordering: dirty-on-top.** `SkillList` sorts entries so skills with unpushed changes (and broken-frontmatter rows) float to the top, alphabetical within each group. Decided over a recency (last-pushed) ordering after discussion — surfacing "what still needs pushing" is more useful than "what was just pushed".

**UI Consistency / Component Reuse** (lesson captured for future UI changes — recorded to KB `kb-ui-consistency-design` + `kb-react-pagebody-layout`):
- Reuse shared components: `shared/ConfirmDialog` for confirm/alert modals, `shared/PageScaffold` `PageHeader`/`PageBody`, the established modal pattern (`fixed inset-0 z-50` + backdrop + centered card).
- No browser-native `window.confirm` / `window.alert` (clashes with app style).
- Blocking errors → modal; non-blocking success/info → inline banner.
- Form controls default `w-full`.
- Page layout invariant: routed page = `PageHeader` + `PageBody`; body fills via `flex-1 min-h-0`; internal-scroll panels each carry their own `overflow-y-auto`.

Verification: covered by task 8.5 + user re-spot-check (Skills bottom borders visible, independent column scroll, no pending-bar overlap, dirty-on-top ordering, and no regression on settings/tokens/templates/memory). `npm run check` exit 0.

In scope: the four fixes above plus capturing the UI-consistency convention.
Out of scope: applying the `w-full` / modal conventions retroactively to non-Skills pages that were not reported as broken; baking the UI-consistency checklist into the Spectra design.md template (skill-level change, not this change).

**Addendum H: Import correctness — unique detection count + multi-source deferral**

Smoke surfaced two import-semantics bugs (reported 2026-05-22). Setup: `.claude/skills` had 6 skills, `.agents/skills` (Codex) had 2 of those same names, canonical empty.

1. **Detection over-counted (showed 8, should be 6).** `skill_import_scan_quick` computed `total = anthropic + codex + gemini` — a per-folder sum that double-counts a skill present in multiple agent folders. Fix: `total` is now the count of UNIQUE skill names across all agents (a name in both `.claude` and `.agents` is one importable skill). Per-agent counts remain distinct-names-within-that-agent (Settings badges stay correct). Building blocks: `skill_names_at` / `distinct_count`.

2. **Multi-source skills imported with the wrong agent tag.** `skill_import_scan` emitted one `ImportCandidate` per `(agent, skill)` pair; both candidates for a shared name wrote to the same canonical path in `skill_import_apply`, so the last one applied won and `ensure_required_fields` tagged `agents: [source_agent]` only — e.g. a skill in both `.claude` and `.agents` ended up tagged `[codex]` alone. 

   Decided scope cut (2026-05-22 discussion): the *correct* multi-source resolution — choosing which source's content wins, unioning agents, per-agent customization — is the upcoming target-control change's territory (it replaces the `agents` frontmatter field with a per-skill target list). Implementing union in this change would be throwaway. So this change does the honest minimum: **detect and defer**, never silently mis-tag.
   - `skill_import_scan` now groups candidates by skill name (`group_by_name`). A name found in exactly one agent folder stays importable (`deferred = None`). A name found in 2+ folders collapses to ONE row with `deferred = Some({ agents, reason })`.
   - The wizard greys out deferred rows (60% opacity), shows "found in <agents>" + the reason note, and renders no resolution controls. Deferred candidates are excluded from the apply selection; `skill_import_apply` also skips any `deferred` candidate defensively. Apply is disabled when every candidate is deferred.

Wire-shape change: `ImportCandidate` gains `deferred: DeferredMultiSource | null` (`{ agents: AgentId[]; reason: string }`) in both `skill_import.rs` and `types/skills.ts`.

Verification (task 8.6): cargo `commands::skill_import::tests::group_by_name_defers_multi_source_keeps_single_source` (single-source importable, multi-source one deferred row with unioned agents), `distinct_count_dedupes_shared_names` (bug 1 dedup), `apply_skips_deferred_candidate` (apply refuses deferred). Plus user spot-check: detection count shows unique number; multi-source skills greyed + annotated; single-source imports correctly with its agent tag.

In scope: unique-count fix + multi-source detection/deferral + wizard greying.
Out of scope: actually importing multi-source skills (deferred to target-control change); orphan pruning when an agent is de-selected from a skill's tags (separate known issue, recorded in product-backlog, also target-control territory).
