## Context

Projects page 的 right column 目前由 `ManagedInventory` 組出 row。它已同時呼叫 `skill_import_scan(projectPath)` 與 `canonical_skills_list`：前者提供 selected project 內的 agent-native skill files，後者提供 global canonical skills 與 targets。現況只把 canonical targets 用於 `managed` 判斷與 import conflict 判斷，per-agent chips 則只吃 project-local scan 結果。

相關 KB：`kb-frontend-identity-migration-display-vs-storage` 提醒跨 UI surface 需要區分 canonical identity 與 display identity。本 change 的比對必須使用 canonical directory identity，避免 parsed YAML `name` drift 讓 Projects page 與 Skills page 選取行為不一致。

## Goals / Non-Goals

**Goals:**

- 讓 Projects page 的 per-agent chips 成為 selected project 視角的 skill availability summary，而不是只顯示 project-local files。
- 對同名 global canonical skill，把 enabled/tracked target agents 合併進 chip present 狀態。
- 保留 `Managed` label 原語意：只有 target 指向 selected project 才是 Managed。
- 讓同名 global canonical 但未指向 selected project 的 row 可導向 Skills page，而不是主要呈現 overwrite import。
- 保持 backend IPC contract 不變。

**Non-Goals:**

- 不新增 backend command。
- 不在 Projects page 編輯 targets、推送 skill、刪除 skill 或建立 manage toggle。
- 不改 `skill_import_scan` 的 scan scope 或 Rust 行為。
- 不把 disabled、detached、forked targets 視為可用 agent。
- 不重新設計整個 Projects page table 或 Skills page TargetEditor。

## Decisions

### Frontend-only inventory merge

`ManagedInventory` 已經擁有完成此 summary 所需的兩份資料：project-local scan 與 global canonical list。新增 backend command 只會包裝現有資料流，形成 pass-through interface，刪掉它不會破壞核心 domain 行為。因此本 change 在前端抽出一個純 helper 來建構 rows，讓合併規則可測、可讀，並避免新增 Tauri invoke layer。

替代方案：新增 Rust command 回傳 project inventory。拒絕原因：目前沒有新 filesystem source、沒有安全邊界變化，也沒有需要 Rust-only normalization 的資料；現有 `normalizeProjectPath` 已處理前端 project path identity。

### Availability chips use local presence union enabled tracked targets

每個 agent chip 的 present 狀態由兩種來源聯集而成：selected project 內對應 agent directory 的同名 `SKILL.md`，以及同名 global canonical skill 上該 agent 的 enabled/tracked target。Project target 與 global target 都能讓該 agent 在這個 project summary 中被視為可用，但 disabled、detached、forked target 不算 present。

這裡不要求 target 已有 `lastSync`。Target list 是 Skills page 目前的可用性/管理意圖來源；sync freshness 仍屬 Skills page 的 sync info 與 Coverage matrix 責任。

### Managed label remains project-target ownership

`Managed` 不等於「同名 global canonical 存在」。只有 canonical target 指向 selected project 時才顯示 Managed。若 project-local row 有同名 global canonical，但 canonical 只含 global targets，row 維持 Unmanaged；差異在於 action 變成導向 Skills page，而非主要呈現 import overwrite。這避免使用者誤以為 Felina 已經把 selected project 加入 target 管理，同時也避免一鍵 overwrite 既有 canonical。

### Canonical directory identity is the matching key

Project scan 的 skill name 來自 agent skill folder name；global canonical 的穩定 identity 來自 `SkillListEntry.canonicalId` / `skillListEntryCanonicalId`。合併與 deep-link 都使用 canonical directory identity，不使用 parsed frontmatter `skill.name` 做主鍵。Display text 可以仍顯示 row skill name，但 action key 必須能選到 Skills page 的 canonical entry。

## Implementation Contract

**Behavior:**

- Projects page row set includes project-local names, project-targeted canonical names, and same-named global canonical names when a project-local row exists.
- Per-agent chips show present when the skill name is present in the selected project's corresponding agent directory, or when the same-named canonical skill has an enabled tracked target for that agent.
- Disabled targets, detached targets, forked targets, and absent targets do not set chips present.
- `Managed` is true only when a canonical target has `scope=project` and normalized `project` equals the selected project path.
- An Unmanaged row with same-named canonical exists opens Skills page selection for that canonical skill and does not show the normal import button as the primary action.

**Interface / data shape:**

- Keep existing IPC wrappers: `api.skillImport.scan(projectPath)` and `api.canonicalSkills.list()`.
- Add a frontend row-building helper under `src/lib/components/projects/managed-inventory.ts` or equivalent project component utility. It accepts project path, `ImportCandidate[]`, and `SkillListEntry[]`, and returns rows with at least:
  - `skillName`
  - `managed`
  - `canonicalId` or `null`
  - `canonicalExists`
  - `agentsPresent: Set<AgentId>` or an equivalent serializable shape for tests
  - `candidate`
  - `deferred`
- Use `normalizeProjectPath` for project target comparison.
- Use `skillListEntryCanonicalId` for canonical matching and navigation key.

**Failure modes:**

- If `canonical_skills_list` fails, existing error handling may still show the load error and clear rows; this change does not add a partial fallback mode.
- Broken canonical entries may participate by `canonicalId` / name for matching only when they appear in `SkillListEntry`; they have no targets, so they do not add target-derived chip presence.
- Multi-source project-local candidates remain deferred and non-importable.

**Acceptance criteria:**

- Add focused tests for the row-building helper covering:
  - project-local claude plus same-named canonical codex/gemini enabled tracked global targets produces all three chips present and Managed false;
  - disabled/detached/forked targets do not add chip presence;
  - project target for selected project sets Managed true and adds that agent chip even if the project-local file is absent;
  - canonicalId mismatch safety: parsed `skill.name` drift does not become the match key.
- Run `npm run check` successfully.
- Manual `npm run tauri dev` verification: Projects page shows the merged chip summary for a fixture or real project with project-local + same-named global canonical targets, and row click opens Skills page for same-named canonical rows.

**In Scope:**

- `ManagedInventory` row construction and rendering states.
- A small project-local helper module and tests if the project test setup supports it; otherwise helper extraction plus TypeScript-level compile verification.
- i18n copy only if a new visible label or tooltip is introduced.

**Out of Scope:**

- Backend scan changes.
- New Tauri commands.
- Target mutation from Projects page.
- Import wizard behavior changes outside the Projects page row action.
- Sync freshness visualization or lastSync icons in Projects page.

## Risks / Trade-offs

- [Risk] Users may read global target chip presence as proof that the file was pushed and fresh. → Mitigation: this change keeps sync freshness out of Projects page and leaves freshness indicators in Skills page; copy/tooltips must avoid saying "synced".
- [Risk] Adding same-name canonical rows to the action ranking could alter table order. → Mitigation: spec defines exact sort priority and tests cover representative ordering.
- [Risk] Identity drift between parsed name and directory name could produce duplicate-looking rows. → Mitigation: canonical matching uses `skillListEntryCanonicalId`, following the KB identity migration rule.
- [Risk] Helper extraction creates extra indirection for one component. → Mitigation: helper owns real behavior (row merge/ranking) and exists to make the bug testable; it is not a pass-through wrapper.

## Migration Plan

No data migration is required. Existing canonical skills, targets, and project-local agent skill files are reinterpreted at render time.

Rollback is reverting the frontend helper/rendering change and the `projects-view` spec delta; no persisted data shape changes.

## Open Questions

None. The user confirmed the intended summary behavior: project-local rows must reflect same-name global canonical target agents in the chip summary.
