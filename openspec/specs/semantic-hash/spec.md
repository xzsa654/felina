# semantic-hash Specification

## Purpose

TBD - created by archiving change 'semantic-hash-refactor'. Update Purpose after archive.

## Requirements

### Requirement: Semantic Normalization

Before calculating the hash of a skill for drift detection or synchronization tracking, the system SHALL normalize the content to ensure that semantically identical files produce identical hashes. The system SHALL first normalize all line endings by replacing `\r\n` and standalone `\r` with `\n`. The system SHALL then parse the YAML frontmatter, sort its keys alphabetically, and serialize it back, then append the `trim()`med body content.

#### Scenario: Normalizing identical meaning with different formatting

- **GIVEN** a file with frontmatter `agents: [claude, gemini]`
- **AND** another file with frontmatter `agents:` followed by `- gemini` and `- claude` on separate lines
- **AND** both files have the same body but one has trailing whitespace
- **WHEN** the system calculates their semantic hash
- **THEN** both files SHALL produce the identical SHA-256 hash output

#### Scenario: CRLF and LF produce identical hash

- **GIVEN** a SKILL.md file with LF line endings
- **AND** an identical file where all line endings are CRLF
- **WHEN** the system calculates their semantic hash
- **THEN** both files SHALL produce the identical SHA-256 hash output

##### Example: CRLF body normalization

| Body content (hex representation) | Expected hash input |
| --------------------------------- | ------------------- |
| `line1\r\nline2\r\n` | `line1\nline2` (after trim) |
| `line1\nline2\n` | `line1\nline2` (after trim) |
| `line1\rline2\r` | `line1\nline2` (after trim) |


<!-- @trace
source: fix-crlf-false-drift
updated: 2026-06-17
code:
  - src-tauri/src/commands/fan_out/mod.rs
-->

---
### Requirement: Lazy Migration of Legacy Hashes

The system SHALL NOT automatically force a migration or mass-overwrite of existing raw SHA-256 hashes stored in the synchronization metadata. Instead, the system SHALL evaluate old raw hashes against new semantic hashes naturally during synchronization, treating any mismatches as a standard `BlockedDrift`.

#### Scenario: Overwriting legacy hashes on sync

- **GIVEN** a target with a legacy raw SHA-256 hash stored in its metadata
- **WHEN** the system performs a drift check using the new semantic hash algorithm
- **THEN** it SHALL report a drift due to hash mismatch
- **AND WHEN** the user subsequently performs a push operation to that target
- **THEN** the system SHALL overwrite the metadata with the new semantic hash

<!-- @trace
source: semantic-hash-refactor
updated: 2026-05-28
code:
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/_catalog.json
-->