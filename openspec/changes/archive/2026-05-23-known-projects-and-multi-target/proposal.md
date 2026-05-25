## Why

`path-bug-and-target-model` 已建立 per-skill target 資料模型(sync-meta v2),但 target 清單仍由 SKILL.md 的 `agents` 欄位衍生,使用者無法顯式控制「這個 skill 推到哪幾家 agent、哪個 scope、哪個 project」。同時,專案 scope 目前只能操作當前 cwd 的 project,沒有「已知 project」清單可供跨 project 選擇。

本 change 是 Phase 1.5「目標自由度」系列的第 (a) 步:建立 Known Projects 三來源模型作為 project 選擇來源,並把 fan-out target 從「agents 欄位衍生」升級為「使用者顯式編輯的 target 清單」。為了可獨立 ship,跨 project 的實際 push 與 coverage view 留給 (b),destructive 的 cascade-delete prompt 與 dry-run 留給 (c);本 change 的 target editor 只操作 global 與當前 project,並提供顯式 orphan prune 動作。

## What Changes

1. **Known Projects 三來源模型**:新增 `~/.felina/known-projects.json`(shape `{ projects: [path] }`,只存 L3 使用者顯式加入的 project)。runtime 合併三來源 — L1 當前 cwd、L2 從 `~/.claude/projects/<hash>` auto-detect(用 path-bug-and-target-model 修好的 resolver)、L3 JSON — 以 normalized path dedupe,每個 project 標記其來源(可多重)。

2. **Per-skill target editor(顯式 target 清單)**:Skills 頁新增 target editor — list 列出現有 targets、`[+ Add target]` dialog 選 agent + scope + project。新建 skill 預設 **empty targets**(不再從 agents 衍生)。建立 skill 時 TargetEditor 以 buffered 模式同步顯示,使用者可在 Save 前選定 targets。每個 target row 用 segmented control 切 `Tracked / Disabled`,`Detached`(Phase 2: drift detection)與 `Forked`(Phase 2: overlay rendering)均為 disabled 佔位。TargetEditor 位於 SkillEditor 上方,確保 targets 是首要可見資訊。

3. **`agents` 欄位於 target 驅動上退役**:`canonical_skills_write` 不再呼叫衍生對齊邏輯;新建 skill 寫入 empty-targets sidecar。`read_sync_meta_v2` 移除「v2 + 空 targets → 從 agents backfill」的 heuristic。v1 sidecar 的 backfill 保留為一次性 legacy migration(首次讀取時觸發)。SkillEditor 的 agents checkbox 自表單移除。

4. **顯式 orphan prune**:新增 `[Prune orphans]` 動作 — 掃描各 agent skill 目錄,找出 canonical target 清單已不含(或 mode 已改為 Disabled)的殘留 SKILL.md,列出後由使用者確認再刪除;刪除後同步清除 sync-meta 中對應的 `lastSync` 記錄。不在 toggle Disabled 時自動刪除。

5. **Dirty 語意統一**:`dirty` 旗標只在有 pushable target（enabled + tracked）時為 true。無 target 的 skill 不顯示 Push 按鈕或 PendingPushBar。`skill_targets_set` 與 `mark_sync_meta_dirty` 統一採用此判定邏輯。SkillList 移除 Re-push 按鈕（dirty=false 時不顯示任何 push 控制項）。

6. **syncOne 刷新修正**:`syncOne` push 後改為呼叫 `loadEntries()` 從後端讀回完整 sync-meta（包含 `lastSync` per-target 記錄），取代先前的 partial optimistic update，確保 Sync info bar 即時更新。

7. **SkillList agent chips 來源**:skill list 的 agent chip 改為從 `skill.targets` 取得（去重），而非舊的 `skill.agents` frontmatter 欄位。

## Non-Goals

- 不啟用跨 project 的實際 push:target editor 的 `[+ Add target]` dialog 在本 change 只允許 scope=global 與 scope=project + project=當前 project;跨 project target row 與 `[Add cross-project target]` 留給 (b) `cross-project-push-and-coverage`。
- 不實作 coverage matrix view(留 (b))。
- 不實作 push dry-run、push-time drift check(留 (c) `skill-sync-lifecycle`)。
- 不實作 canonical delete 的 Cascade / Detach / Cancel prompt(留 (c));本 change 的 orphan prune 是獨立的顯式按鈕,不是刪 skill 時的連動 prompt。
- 不實作 `forked` mode 的 overlay 渲染(Phase 2);UI 只顯示 disabled 佔位。
- 不做 multi-source import 解析、任意路徑 import、scope 互移(留 (c))。

## Capabilities

### New Capabilities

- `known-projects`: 三來源(cwd / auto-detected / explicit)的已知 project 清單模型,作為 project scope 操作與後續跨 project 選擇的來源。

### Modified Capabilities

- `multi-agent-skills`: `Per-Skill Target Model` 改為使用者顯式編輯的 target 清單(empty default,移除 agents-derived 與相關 backfill heuristic);`Visual Frontmatter Editor` 移除 agents 控制項(agents 退為 metadata);新增 `Per-Skill Target Editor` 與 `Explicit Orphan Prune` 行為需求。

## Impact

- Affected specs: known-projects (new), multi-agent-skills (modified)
- Affected code:
  - New:
    - src-tauri/src/commands/known_projects.rs
    - src/lib/components/skills/TargetEditor.tsx
    - src/lib/components/skills/AddTargetDialog.tsx
  - Modified:
    - src-tauri/src/paths.rs
    - src-tauri/src/commands/canonical_skills.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/commands/fan_out/mod.rs
    - src/lib/tauri/commands.ts
    - src/lib/types/skills.ts
    - src/lib/stores/skills-store.ts
    - src/lib/components/skills/SkillEditor.tsx
    - src/lib/components/skills/SkillsPage.tsx
  - Removed:
    (none)
