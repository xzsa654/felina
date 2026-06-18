## ADDED Requirements

### Requirement: Batch Drift Scan Handles Stale Sibling Baselines

The batch drift scan SHALL compare sibling file hashes across the recorded last-sync baseline, the current canonical skill directory, and the current agent-side skill directory when evaluating sibling drift for Auto and Manual targets. If the current canonical sibling hashes and current agent-side sibling hashes are identical, the scan SHALL NOT report sibling drift solely because the recorded baseline differs.

#### Scenario: Canonical and agent siblings match with stale recorded baseline

- **GIVEN** a skill target has recorded sibling hashes from an older push
- **AND** the canonical skill directory contains sibling file `scripts/tool.py` with hash `H2`
- **AND** the agent-side skill directory contains sibling file `scripts/tool.py` with hash `H2`
- **AND** the recorded baseline contains sibling file `scripts/tool.py` with hash `H1`
- **WHEN** the batch drift scan evaluates the target
- **THEN** the target SHALL NOT be reported as `Drifted` due to `scripts/tool.py`

##### Example: stale baseline table

| File | Recorded baseline | Canonical current | Agent-side current | Expected scan result |
| ---- | ----------------- | ----------------- | ------------------ | -------------------- |
| `scripts/tool.py` | `H1` | `H2` | `H2` | not `Drifted` |

#### Scenario: Agent-side sibling still drifts when it differs from canonical

- **GIVEN** a skill target has recorded sibling hashes from the last successful push
- **AND** the canonical skill directory contains sibling file `references/guide.md` with hash `H1`
- **AND** the agent-side skill directory contains sibling file `references/guide.md` with hash `H2`
- **WHEN** the batch drift scan evaluates the target
- **THEN** the target SHALL be reported as `Drifted`

#### Scenario: Agent-side sibling addition still drifts when canonical lacks the file

- **GIVEN** a skill target has recorded sibling hashes from the last successful push
- **AND** the canonical skill directory does not contain sibling file `notes/local.md`
- **AND** the agent-side skill directory contains sibling file `notes/local.md`
- **WHEN** the batch drift scan evaluates the target
- **THEN** the target SHALL be reported as `Drifted`
