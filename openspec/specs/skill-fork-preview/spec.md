# skill-fork-preview Specification

## Purpose

TBD - created by archiving change 'skill-fork-preview'. Update Purpose after archive.

## Requirements

### Requirement: Fork Mode Activation

The system SHALL allow a target to be switched from Auto or Manual mode to Forked mode via the TargetPopover mode selector. When a target is switched to Forked mode, the system SHALL compute the SHA-256 hash of the current canonical SKILL.md content and record it as the base_snapshot in the target last_sync entry. If the target has no existing last_sync entry, the system SHALL create one with pushed_hash set to the canonical hash and at set to the current timestamp.

#### Scenario: Switch target from Auto to Forked

- **WHEN** user changes a target mode from Auto to Forked in the TargetPopover mode selector
- **THEN** the target mode SHALL be set to forked in the sync-meta sidecar
- **AND** the base_snapshot field SHALL contain the SHA-256 hash of the current canonical SKILL.md content
- **AND** the target SHALL remain enabled

#### Scenario: Fork target with no prior push history

- **GIVEN** a target that has never been pushed (no last_sync entry for this target key)
- **WHEN** user switches the target to Forked mode
- **THEN** the system SHALL create a last_sync entry with pushed_hash equal to the canonical hash, at equal to the current timestamp, and base_snapshot equal to the canonical hash


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
### Requirement: Forked Target Push Exclusion

The system SHALL NOT push canonical content to targets in Forked mode. This preserves any agent-side customizations made after forking.

#### Scenario: Push skips Forked target

- **GIVEN** a skill with two targets: one in Auto mode and one in Forked mode
- **WHEN** the skill is pushed (either via auto-push on save or manual push)
- **THEN** the Auto target SHALL receive the updated canonical content
- **AND** the Forked target SHALL NOT be modified


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
### Requirement: Fork Agent Content Reading

The system SHALL provide a command skill_fork_read_agent_content that reads the agent-side SKILL.md content for a Forked target. The command SHALL return both the raw file content (including frontmatter) and the body content (frontmatter stripped). The command SHALL reject calls for targets not in Forked mode.

#### Scenario: Read forked target content

- **GIVEN** a target in Forked mode with an agent-side SKILL.md that has been customized
- **WHEN** skill_fork_read_agent_content is called with the canonical_id and target_key
- **THEN** the response SHALL contain body (Markdown without frontmatter) and raw (full file content)

#### Scenario: Reject read for non-forked target

- **GIVEN** a target in Auto mode
- **WHEN** skill_fork_read_agent_content is called for that target
- **THEN** the command SHALL return an error indicating the target is not in forked mode

#### Scenario: Agent-side file missing

- **GIVEN** a target in Forked mode whose agent-side SKILL.md has been deleted
- **WHEN** skill_fork_read_agent_content is called
- **THEN** the command SHALL return an error indicating the agent-side file was not found


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
### Requirement: Fork Diff Preview

The system SHALL provide a command skill_fork_diff_preview that computes a unified diff between canonical and forked content, along with a fork status classification. The diff SHALL use the canonical body as old text and forked body as new text. When base_snapshot is available, the system SHALL use it to classify the fork status.

#### Scenario: Diff with base_snapshot available

- **GIVEN** a Forked target with a recorded base_snapshot
- **WHEN** skill_fork_diff_preview is called
- **THEN** the response SHALL contain canonical_body, forked_body, base_body, has_base as true, unified diff hunks, and a fork_status

#### Scenario: Diff without base_snapshot

- **GIVEN** a Forked target whose base_snapshot is missing (legacy or corrupted)
- **WHEN** skill_fork_diff_preview is called
- **THEN** has_base SHALL be false
- **AND** the diff SHALL be computed as a two-way diff between canonical and forked content


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
### Requirement: Fork Status Classification

The system SHALL classify each Forked target into one of four statuses based on hash comparisons:

- **clean**: canonical hash equals base_snapshot AND forked hash equals pushed_hash (no changes on either side since fork)
- **edited**: canonical hash equals base_snapshot AND forked hash differs from pushed_hash (agent-side has local edits)
- **canonicalAhead**: canonical hash differs from base_snapshot AND forked hash equals pushed_hash (canonical updated, fork untouched)
- **diverged**: canonical hash differs from base_snapshot AND forked hash differs from pushed_hash (both sides changed)

#### Scenario: Fork status classification matrix

##### Example: All four statuses

| canonical hash vs base_snapshot | forked hash vs pushed_hash | fork_status    |
| ------------------------------- | -------------------------- | -------------- |
| equal                           | equal                      | clean          |
| equal                           | different                  | edited         |
| different                       | equal                      | canonicalAhead |
| different                       | different                  | diverged       |

#### Scenario: Missing base_snapshot fallback

- **GIVEN** a Forked target with no base_snapshot
- **WHEN** fork status is computed
- **THEN** the status SHALL default to edited (conservative assumption that changes exist)


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
### Requirement: Unfork Confirmation

The system SHALL display a destructive confirmation dialog when a user attempts to switch a target from Forked mode back to Auto or Manual mode. The confirmation SHALL warn that the next push operation will overwrite agent-side customizations with canonical content.

#### Scenario: Unfork with confirmation

- **WHEN** user changes a Forked target mode to Auto or Manual
- **THEN** a confirmation dialog SHALL appear before the mode change is applied
- **AND** the dialog SHALL warn that agent-side modifications will be overwritten on next push

#### Scenario: User cancels unfork

- **GIVEN** the unfork confirmation dialog is displayed
- **WHEN** user cancels the dialog
- **THEN** the target SHALL remain in Forked mode with no changes


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
### Requirement: Fork Preview Dialog

The system SHALL provide a ForkPreviewDialog modal accessible via a Preview Fork button in the TargetPopover. The dialog SHALL display three tabs: Preview (rendered Markdown of the forked agent-side content), Raw (monospace display of the full agent-side file), and Diff (unified diff between canonical and forked content using the existing hunk renderer). The dialog header SHALL display the skill name, target key, and fork status badge.

#### Scenario: Open fork preview from popover

- **GIVEN** a target in Forked mode
- **WHEN** user clicks the Preview Fork button in the TargetPopover
- **THEN** the ForkPreviewDialog SHALL open showing the Preview tab with rendered Markdown of the agent-side content

#### Scenario: Switch to diff tab

- **GIVEN** ForkPreviewDialog is open
- **WHEN** user selects the Diff tab
- **THEN** unified diff hunks SHALL be displayed using the same visual style as PullConfirmDialog (red for deletions, green for additions)

#### Scenario: No base_snapshot indicator

- **GIVEN** ForkPreviewDialog is open for a target without base_snapshot
- **WHEN** the Diff tab is displayed
- **THEN** an informational banner SHALL indicate that the fork base point is unknown and a full two-way diff is shown


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
### Requirement: Fork Status Chip Display

Target chips SHALL display fork status using semantic icons and theme colors. The system SHALL render:
- forked-clean: fork icon with info color
- forked-edited: fork icon with delta indicator and info color
- forked-ahead: fork icon with warning indicator and warning color
- forked-diverged: fork icon with warning indicator and deeper warning color

#### Scenario: Forked chip rendering

##### Example: Four fork statuses

| fork_status    | icon | color class                                  |
| -------------- | ---- | -------------------------------------------- |
| forked-clean   | ⑂    | text-info border-info/30 bg-info/5           |
| forked-edited  | ⑂Δ   | text-info border-info/30 bg-info/5           |
| forked-ahead   | ⑂⚠   | text-warning border-warning/30 bg-warning/5  |
| forked-diverged| ⑂⚠   | text-warning border-warning/40 bg-warning/10 |

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