## Why

multi-agent-skills-foundation change 用 SKILL.md frontmatter 的 `agents` 欄位直接驅動 fan-out，語意僅能表達「把這個 skill 推到當前 scope 的這幾家 agent」。後續要支援的目標自由度（只推某幾家、跨 scope、跨 project、移除 target 時清孤兒、push 前 dry-run、覆蓋率視圖）都需要一個 per-skill 的目標清單資料模型，而 `agents` 欄位無法承載這些狀態。

同時，Windows 上 `~/.claude/projects/` 的 hash 反解只對目前活躍 project 正確（讀得到 `.jsonl` 的 `cwd`），其餘歷史 project 退化成 `C//...` 無效路徑，導致 project-scope 的偵測與未來的「自動偵測已知 project」不可靠。

本 change 是「目標自由度」系列的第一步：修復 path 反解、建立 per-skill target 資料模型（sync-meta schema v2）、把 fan-out 改由 target 清單驅動。為了可獨立 ship，target 清單在本 change 仍由既有 `agents` 欄位衍生（行為等價），不引入新的 target 編輯 UI（留給後續 change）。

## What Changes

1. **Path 反解修復**：`~/.claude/projects/<hash>` 還原 cwd 時，於既有「讀 `.jsonl` 的 `cwd`」之外，補 Windows 單字母 drive-letter 還原（`C--...` → `C:/...`）與 drive-letter 起頭的 segment resolve；全部失敗則回報 unresolved，不再產生含 `C//` 的無效路徑。
2. **Per-skill target 資料模型（sync-meta schema v2）**：`.felina-sync-meta.json` 升級為帶 `version` 的 schema v2，新增 `targets` 清單，每筆為 `{ agent, scope, project?, enabled, mode }`；`mode` enum 為 `tracked` / `detached`，並預留 `forked`（不實作）。`last_sync` 改為 per-target 索引並預留 `base_snapshot`（不寫值）。schema 讀取相容 v1（無 `targets` 者走 backfill）。
3. **既有 skill backfill**：讀取既有 skill（有 `agents` 欄位、sidecar 無 `targets`）時，對每個 `agents` 項目 × 該 skill 自身 scope 衍生一筆 `tracked` target，保留既有的「推當前 scope 對應 agent」行為。
4. **Fan-out 由 targets 驅動**：`skill_sync_one` / `skill_sync_all` 改讀 target 清單決定寫入目標，跳過 `enabled=false` 或 `mode=detached` 的 target；本 change 中 target 來源等同 `agents` 欄位衍生，行為與目前一致。

## Non-Goals

- 不新增 target 編輯 UI（per-agent 取捨、跨 project 選擇等）——留給後續 known-projects-and-multi-target change。
- 不實作「新建 skill 預設空 targets + 顯式加入」的模型；本 change 維持由 `agents` 欄位衍生，確保可獨立 ship。
- 不實作 forked overlay 客製化；schema 只預留 `forked` enum 與 `base_snapshot` 欄位。
- 不做 import 多來源解析、orphan prune、drift 臨檢、cascade/detach 刪除、Known Projects、任意路徑匯入、scope 互移——皆屬後續兩個 change。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: 新增 per-skill target 資料模型（sync-meta v2）與既有 skill backfill 規則；fan-out 改由 target 清單驅動而非直接讀 `agents` 欄位；專案 path 反解在 Windows drive-letter 與多歷史 project 下回傳正確 cwd 或標記 unresolved。

## Impact

- Affected specs: multi-agent-skills (modified)
- Affected code:
  - Modified:
    - src-tauri/src/paths.rs
    - src-tauri/src/commands/canonical_skills.rs
    - src-tauri/src/commands/fan_out/mod.rs
    - src/lib/types/skills.ts
  - New:
    (none)
  - Removed:
    (none)
