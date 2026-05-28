## ADDED Requirements

### Requirement: Semantic Normalization

Before calculating the hash of a skill for drift detection or synchronization tracking, the system SHALL normalize the content to ensure that semantically identical files produce identical hashes. The system SHALL parse the YAML frontmatter, sort its keys alphabetically, and serialize it back, then append the `trim()`med body content.

#### Scenario: Normalizing identical meaning with different formatting

- **GIVEN** a file with frontmatter `agents: [claude, gemini]`
- **AND** another file with frontmatter `agents:` followed by `- gemini` and `- claude` on separate lines
- **AND** both files have the same body but one has trailing whitespace
- **WHEN** the system calculates their semantic hash
- **THEN** both files SHALL produce the identical SHA-256 hash output

### Requirement: Lazy Migration of Legacy Hashes

The system SHALL NOT automatically force a migration or mass-overwrite of existing raw SHA-256 hashes stored in the synchronization metadata. Instead, the system SHALL evaluate old raw hashes against new semantic hashes naturally during synchronization, treating any mismatches as a standard `BlockedDrift`.

#### Scenario: Overwriting legacy hashes on sync

- **GIVEN** a target with a legacy raw SHA-256 hash stored in its metadata
- **WHEN** the system performs a drift check using the new semantic hash algorithm
- **THEN** it SHALL report a drift due to hash mismatch
- **AND WHEN** the user subsequently performs a push operation to that target
- **THEN** the system SHALL overwrite the metadata with the new semantic hash
