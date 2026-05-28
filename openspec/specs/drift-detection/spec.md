# drift-detection Specification

## Purpose

TBD - created by archiving change 'drift-detection-and-conflict-ui'. Update Purpose after archive.

## Requirements

### Requirement: Batch Drift Scan API

The system SHALL provide a `skill_drift_scan` IPC command that scans all canonical skills' enabled tracked targets for drift in a single call. For each target, the command SHALL read the agent-side SKILL.md file, compute its semantic hash, and compare it against the `pushed_hash` stored in the skill's sync-meta sidecar. The command SHALL return a mapping of skill name to per-target drift status. The command SHALL NOT render canonical content, write any files, or modify sync-meta.

#### Scenario: Scan detects drifted target

- **WHEN** a canonical skill has an enabled tracked target whose agent-side SKILL.md semantic hash differs from the stored `pushed_hash`
- **THEN** the scan SHALL return `drifted` status for that target

##### Example: three targets with mixed drift states

| Skill | Target | Agent-side hash | Pushed hash | Status |
| ----- | ------ | --------------- | ----------- | ------ |
| code-review | anthropic:global | abc123 | abc123 | synced |
| code-review | codex:global | def456 | xyz789 | drifted |
| helper | gemini:global | (file missing) | ghi012 | missing |

#### Scenario: Scan skips disabled and detached targets

- **WHEN** a skill target has `enabled: false` or `mode: detached`
- **THEN** the scan SHALL NOT read the agent-side file for that target
- **AND** the scan SHALL NOT include that target in the result

#### Scenario: Scan handles target with no push history

- **WHEN** a skill target has no `last_sync` entry (never pushed)
- **THEN** the scan SHALL return `no-push-history` status for that target


<!-- @trace
source: drift-detection-and-conflict-ui
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/agent-skill-market-complete.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillImportWizard.tsx
-->

---
### Requirement: Shared Drift Check Function

The fan-out module SHALL expose a reusable `check_drift` function that compares an agent-side file's semantic hash against a stored `pushed_hash`. The batch drift scan API and the existing push preview SHALL both use this function. The function SHALL NOT perform rendering; it SHALL only read the agent-side file and compare hashes.

#### Scenario: check_drift returns synced when hashes match

- **WHEN** the agent-side file's semantic hash equals the stored `pushed_hash`
- **THEN** `check_drift` SHALL return synced status

#### Scenario: check_drift returns drifted when hashes differ

- **WHEN** the agent-side file's semantic hash differs from the stored `pushed_hash`
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift returns missing when file does not exist

- **WHEN** the agent-side file does not exist on disk
- **THEN** `check_drift` SHALL return missing status


<!-- @trace
source: drift-detection-and-conflict-ui
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/agent-skill-market-complete.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillImportWizard.tsx
-->

---
### Requirement: Drift Scan Performance Optimization

The `check_drift` function SHALL first compare the agent-side file's filesystem modification time (mtime) against the `last_sync.at` timestamp. If the file's mtime is less than or equal to the push timestamp, `check_drift` SHALL return synced without reading the file content or computing a hash. When mtime indicates a potential change (mtime > push timestamp), `check_drift` SHALL read the file and compute the semantic hash. The batch drift scan SHALL process targets that require hash computation in parallel using a thread pool.

#### Scenario: mtime fast path skips hash for unmodified files

- **WHEN** an agent-side SKILL.md has mtime earlier than the stored `last_sync.at` timestamp
- **THEN** `check_drift` SHALL return synced status
- **AND** `check_drift` SHALL NOT read the file content or compute a semantic hash

#### Scenario: mtime indicates potential change triggers hash

- **WHEN** an agent-side SKILL.md has mtime later than the stored `last_sync.at` timestamp
- **THEN** `check_drift` SHALL read the file and compute the semantic hash
- **AND** `check_drift` SHALL compare the hash against `pushed_hash` to determine synced or drifted

#### Scenario: Batch scan parallelizes hash computation

- **WHEN** multiple targets require hash computation (mtime > push timestamp)
- **THEN** the batch scan SHALL compute hashes in parallel using a thread pool
- **AND** the scan result SHALL be identical to sequential execution


<!-- @trace
source: drift-detection-and-conflict-ui
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/agent-skill-market-complete.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillImportWizard.tsx
-->

---
### Requirement: Frontend Drift Scan Trigger

The frontend SHALL trigger a drift scan at three points: after the skills store initializes on app startup, when the app window regains focus, and when the user activates the manual reload action. The scan result SHALL be stored in the skills store and consumed by CoverageMatrix and TargetEditor. The frontend SHALL NOT use a file system watcher.

#### Scenario: Drift scan runs on app startup

- **WHEN** the Skills page mounts and the skills store loads entries for the first time
- **THEN** the store SHALL call the drift scan API and store the result

#### Scenario: Drift scan runs on window refocus

- **WHEN** the app window regains focus after being in the background
- **THEN** the store SHALL call the drift scan API and update the stored result

#### Scenario: Drift scan runs on manual reload

- **WHEN** the user clicks the reload button on the Skills page
- **THEN** the store SHALL call the drift scan API and update the stored result

<!-- @trace
source: drift-detection-and-conflict-ui
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/agent-skill-market-complete.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillImportWizard.tsx
-->