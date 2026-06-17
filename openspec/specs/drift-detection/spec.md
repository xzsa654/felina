# drift-detection Specification

## Purpose

TBD - created by archiving change 'drift-detection-and-conflict-ui'. Update Purpose after archive.

## Requirements

### Requirement: Batch Drift Scan API

The batch drift scan SHALL classify Forked targets into four sub-statuses (clean, edited, canonicalAhead, diverged) rather than treating them as non-drifted. The drift scan SHALL compute fork status by comparing canonical hash against base_snapshot and forked hash against pushed_hash. Forked targets SHALL NOT trigger pull-back suggestions regardless of their fork status.

#### Scenario: Drift scan results used for SkillList indicator

- **GIVEN** the drift scan has completed and returned DriftStatus per skill per target
- **WHEN** the SkillList is rendered
- **THEN** each skill entry SHALL reflect whether any of its targets are in Drifted state based on the scan results

#### Scenario: Drift scan classifies forked target

- **GIVEN** a skill with a Forked target whose agent-side content differs from pushed_hash
- **WHEN** the batch drift scan runs
- **THEN** the Forked target SHALL be classified with fork_status edited
- **AND** the target SHALL NOT be classified as drifted (drift is for Auto/Manual targets only)

#### Scenario: Drift scan with forked-diverged target

- **GIVEN** a Forked target where both canonical has changed since base_snapshot and agent-side has changed since pushed_hash
- **WHEN** the batch drift scan runs
- **THEN** the Forked target SHALL be classified with fork_status diverged


<!-- @trace
source: skill-fork-preview
updated: 2026-06-09
code:
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/types/index.ts
  - src/lib/components/skills/sync-status-utils.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/tauri/commands.ts
  - .session/felina_development_report.md
  - src/lib/components/skills/ForkPreviewDialog.tsx
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - src/lib/types/skills.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/canonical_skills.rs
  - .session/release-notes-v1.0.0.md
  - LANGUAGE.md
  - .session/felina_hackathon_ppt_spec_report.md
  - src/lib/components/skills/SyncInfoBar.tsx
tests:
  - tests/sync-status-utils.test.ts
-->

---
### Requirement: Shared Drift Check Function

MODIFY scenario:

#### Scenario: check_drift detects sibling file changes

- **GIVEN** a skill has been pushed with sibling files and their hashes recorded in sync meta
- **WHEN** an agent-side sibling file's content has been modified since the last push
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift detects sibling file deletion

- **GIVEN** a skill has been pushed with sibling files and their hashes recorded in sync meta
- **WHEN** an agent-side sibling file that existed at push time has been deleted
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift detects new sibling file on agent side

- **GIVEN** a skill has been pushed with sibling hashes recorded in sync meta
- **WHEN** a new file exists in the agent-side skill directory that was not present at push time
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift treats missing sibling hashes as legacy (no comparison)

- **GIVEN** the sync meta was written before sibling hash tracking was introduced
- **WHEN** the `sibling_hashes` field is absent from the sync meta (`None`)
- **THEN** `check_drift` SHALL skip sibling comparison entirely
- **AND** `check_drift` SHALL NOT report drift due to agent-side sibling files

#### Scenario: check_drift detects agent-side additions when push had no siblings

- **GIVEN** a skill was pushed with no sibling files (`sibling_hashes` is `Some({})`)
- **WHEN** a new file is added on the agent side
- **THEN** `check_drift` SHALL return drifted status


<!-- @trace
source: sibling-drift-detection
updated: 2026-05-29
code:
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/skill_library.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/mod.rs
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/types/skills.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src/lib/tauri/commands.ts
  - docs/tokscale-backed-token-ingestion.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/Cargo.toml
-->

---
### Requirement: Sibling Hash Line Ending Normalization

When computing hashes for sibling files (non-SKILL.md files in a skill directory), the system SHALL attempt to decode each file as UTF-8. If the file is valid UTF-8, the system SHALL normalize line endings by replacing `\r\n` and standalone `\r` with `\n` before computing the SHA-256 hash. If the file is not valid UTF-8 (binary), the system SHALL hash the raw bytes without modification.

#### Scenario: Text sibling with CRLF does not cause false drift

- **GIVEN** a sibling file `agents/openai.yaml` was pushed with LF line endings
- **AND** git checkout converted the agent-side copy to CRLF
- **WHEN** the system checks sibling drift
- **THEN** the sibling SHALL NOT be reported as drifted

##### Example: UTF-8 vs binary handling

| File | Content | UTF-8 valid? | Hash input |
| ---- | ------- | ------------ | ---------- |
| `helper.sh` | `#!/bin/sh\r\necho hi\r\n` | yes | `#!/bin/sh\necho hi\n` |
| `icon.png` | binary data with `0x0D 0x0A` bytes | no | raw bytes unchanged |

#### Scenario: Binary sibling preserves exact hash

- **GIVEN** a binary sibling file (e.g., an image) containing byte sequence `0x0D 0x0A`
- **WHEN** the system computes the sibling hash
- **THEN** the system SHALL hash the raw bytes without line ending normalization

<!-- @trace
source: fix-crlf-false-drift
updated: 2026-06-17
code:
  - src-tauri/src/commands/fan_out/mod.rs
-->

---
### Requirement: Drift Scan Performance Optimization

ADD scenario:

#### Scenario: Sibling hash computation runs in parallel with SKILL.md check

- **WHEN** the batch drift scan processes a target that requires hash computation
- **THEN** sibling file hashes SHALL be computed as part of the same parallel work unit as the SKILL.md hash
- **AND** the combined result SHALL reflect both SKILL.md and sibling drift status


<!-- @trace
source: sibling-drift-detection
updated: 2026-05-29
code:
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/skill_library.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/mod.rs
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/types/skills.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src/lib/tauri/commands.ts
  - docs/tokscale-backed-token-ingestion.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/Cargo.toml
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