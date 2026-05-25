## Context

multi-agent-skills-foundation change 已建立 canonical 儲存（`~/.felina/skills/`、`<project>/.felina/skills/`）、三家 fan-out、per-skill sidecar `.felina-sync-meta.json`（目前只存 `dirty` + `last_synced`）。fan-out 直接讀 SKILL.md frontmatter 的 `agents` 欄位決定寫哪幾家。

`src-tauri/src/paths.rs` 的 `project_hash_to_path` 反解 `~/.claude/projects/<hash>`：先讀資料夾內 `.jsonl` 第一行的 `cwd`，否則 naive `hash.replace('-', '/')` 或 segment resolve。naive 對 Windows 路徑會把 `C--MyProject-...` 變成 `C//MyProject/...`（drive-letter 的 `:` 拿不回來），segment resolve 又寫死 POSIX `/` 起頭，於是非活躍 project（讀不到 `cwd`）反解失敗。

本 change 為「目標自由度」系列第一步，只做資料模型與 path 修復，不動 UI 自由度。技術棧：Tauri v2 + React 19 / TS + Rust；後端 cargo test 守 regression。

## Goals / Non-Goals

**Goals:**

- 建立 per-skill target 清單資料模型（sync-meta schema v2），作為後續目標自由度的地基。
- fan-out 改由 target 清單驅動，但行為與現況等價（target 由 `agents` 欄位衍生）。
- 修復 Windows / 多歷史 project 的 hash 反解，正確還原 cwd 或明確標記 unresolved。
- schema 預留 Phase 2 鉤子（`forked` mode、`base_snapshot`），避免未來 breaking change。

**Non-Goals:**

- 不新增 target 編輯 UI、不支援 per-agent 取捨 / 跨 project 選擇（後續 change）。
- 不引入「新建預設空 targets」模型；本 change target 一律由 `agents` 欄位衍生。
- 不實作 forked overlay、import 多來源、prune、drift 臨檢、cascade/detach、Known Projects。

## Decisions

### sync-meta schema v2 與 target 結構

`.felina-sync-meta.json` 升級為 `{ version: 2, targets: [...], last_sync: { <targetKey>: {...} }, dirty }`。每筆 target 為 `{ agent, scope, project?, enabled, mode }`，`mode` enum 為 `tracked`（push 覆蓋）/ `detached`（跳過）/ `forked`（預留，本 change 不實作渲染）。`last_sync` 以 target key 索引 `{ pushed_hash, base_snapshot?, at }`，`base_snapshot` 為 Phase 2 fork 預留、本 change 不寫值。

理由：target 清單放 sidecar 而非 frontmatter，保持三家輸出 frontmatter 純淨；`version` 欄位讓 v1→v2 可辨識並 backfill。替代方案（frontmatter targets、中央 registry）會污染輸出或造成 rename/merge 維護負擔，捨棄。

### 既有 skill 的 v1 → v2 backfill

讀取 sidecar 時若 `version` 缺失或無 `targets`（v1），對 skill 的每個 `agents` 欄位項目 × 該 skill 自身 scope 衍生一筆 `{ agent, scope, project(若 project scope), enabled: true, mode: tracked }` target。保留既有的 `dirty` / `last_synced`（併入 v2 結構）。確保既有 skill 升級後 fan-out 目標不變。

### 本 change target 來源等同 agents 欄位（不引入空預設）

新建或編輯 skill 時，target 清單仍由 SkillEditor 既有的 `agents` 勾選衍生，而非空清單。理由：target 編輯 UI 在後續 change 才實作；若本 change 就讓 targets 預設空，會出現「新 skill 無法 push 且無 UI 可加 target」的斷檔。本 change 維持行為等價，「預設空 + 顯式加」模型隨後續 target 編輯器一起導入。

### fan-out 由 target 清單驅動

`skill_sync_one` / `skill_sync_all` 改為先取得 skill 的 target 清單（v2 讀取或 v1 backfill），逐 target 寫入；跳過 `enabled=false` 或 `mode=detached`。push 成功後更新對應 `last_sync[targetKey].pushed_hash` 與 `at`，並在全 target 成功時清 `dirty`。本 change 中因 target 由 agents 衍生，可觀察行為與現況一致。

### Path 反解修復（Windows drive-letter + unresolved fallback）

`project_hash_to_path` 維持「優先讀 `.jsonl` 的 `cwd`」。naive fallback 改為：偵測單字母 drive-letter 開頭（hash 形如 `C--rest`）時還原為 `C:/` + 其餘段以 `/` 連接；segment resolve 支援 drive-letter 起頭而非寫死 `/`。三者皆無法對應到實際存在目錄時，回報 unresolved（以 `Option`/明確旗標表示），呼叫端不得把無效字串當路徑使用。

理由：後續 change 的「自動偵測已知 project」依賴正確反解；寧可標 unresolved 也不回傳 `C//...`。

## Implementation Contract

**Behavior（可觀察）**：升級後既有 skill 的 push 目標與現況相同（agents 欄位 → 衍生 targets）；fan-out 跳過 detached/disabled target；非活躍 / 歷史 project 的 hash 在 Windows 上反解為正確 `C:\...` 路徑，或在無法判定時被標為 unresolved 而非無效路徑。對使用者而言，本 change 無新增 UI；既有建立 / 編輯 / push 動線行為不變。

**Interface / data shape**：
- sync-meta v2 JSON：`{ version: 2, targets: [{ agent, scope, project?, enabled, mode }], last_sync: { <targetKey>: { pushed_hash, base_snapshot?, at } }, dirty }`。
- Rust：`canonical_skills.rs` 新增 v2 結構與 v1 backfill 的讀寫；`fan_out/mod.rs` 改由 targets 驅動；`paths.rs` 的 `project_hash_to_path` 補 drive-letter 解碼並新增 unresolved 表示。
- TS：`src/lib/types/skills.ts` 新增 `SkillTarget` / `TargetMode` 型別（供後續 change 使用），與後端 wire 形狀對齊。

**Failure modes**：sidecar 讀取失敗或為 v1 → backfill 不報錯；hash 無法反解 → unresolved，呼叫端略過該 project；fan-out 單一 target 失敗不中止其他 target（沿用既有 per-target 隔離）。

**Acceptance criteria**：
- cargo test：(a) `project_hash_to_path` 對 `C--MyProject-Pershing-felina` 形 hash 還原為 `C:` 起頭路徑、對無法對應者回 unresolved；(b) sync-meta v1（無 targets）讀取後 backfill 出與 agents 欄位一致的 tracked targets；(c) v2 序列化 / 反序列化 round-trip 保留 mode 與 last_sync；(d) fan-out 由 targets 驅動、跳過 detached/disabled、push 後更新 per-target pushed_hash。
- `npm run check` exit 0；`cargo build` 無新 warning；`spectra validate` / `analyze` 無 Critical / Warning。
- 既有 multi-agent-skills-foundation 的 cargo test 全數不退化。

**Scope boundaries**：
- In scope：path 反解修復、sync-meta v2 模型 + backfill、fan-out 切換為 targets 驅動、對齊的 TS 型別。
- Out of scope：target 編輯 UI、Known Projects、import 多來源、prune、drift 臨檢、cascade/detach、forked overlay、任意路徑匯入、scope 互移。

## Risks / Trade-offs

- [v1 → v2 migration] → 既有 sidecar 無 `targets` → 以 agents 欄位 backfill；cargo test 覆蓋，確保升級後 push 目標不變。
- [drive-letter 解碼仍可能誤判含 `--` 的資料夾名] → 無法對應到實際目錄者一律標 unresolved，不猜測、不回傳無效路徑。
- [target 由 agents 衍生是暫時設計] → 後續 change 導入 target 編輯器時會改為獨立來源；schema 已能承載，屆時只需改寫入來源，不需 breaking schema。
