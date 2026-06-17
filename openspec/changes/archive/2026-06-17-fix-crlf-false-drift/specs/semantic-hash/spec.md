## MODIFIED Requirements

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
