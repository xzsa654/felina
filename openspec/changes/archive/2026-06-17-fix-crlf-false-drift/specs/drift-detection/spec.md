## ADDED Requirements

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
