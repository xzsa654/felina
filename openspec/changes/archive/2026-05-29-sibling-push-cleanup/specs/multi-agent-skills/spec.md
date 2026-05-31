## MODIFIED Requirements

### Requirement: Push Cleans Orphan Sibling Files

The fan-out push flow SHALL remove sibling files from the agent-side skill directory when those files were present in the previous push baseline (`sibling_hashes`) but no longer exist in the canonical skill directory. Files on the agent side that are NOT in the push baseline SHALL NOT be removed.

#### Scenario: Push removes orphan sibling

- **GIVEN** the previous push recorded `script/old.py` in `sibling_hashes`
- **AND** the canonical skill directory no longer contains `script/old.py`
- **WHEN** the skill is pushed to the target
- **THEN** `script/old.py` SHALL be deleted from the agent-side skill directory

#### Scenario: Push preserves agent-side manual additions

- **GIVEN** the agent-side skill directory contains `notes.txt` that was NOT in the previous `sibling_hashes`
- **WHEN** the skill is pushed to the target
- **THEN** `notes.txt` SHALL NOT be deleted

#### Scenario: Push with legacy meta (no sibling hashes) skips cleanup

- **GIVEN** the sync meta's `sibling_hashes` is `None` (legacy meta, pre-sibling-tracking push)
- **WHEN** the skill is pushed to the target
- **THEN** no sibling files SHALL be deleted from the agent-side directory

#### Scenario: Push with empty sibling hashes baseline skips cleanup

- **GIVEN** the sync meta's `sibling_hashes` is `Some({})` (previous push had no siblings)
- **WHEN** the skill is pushed to the target
- **THEN** no sibling files SHALL be deleted from the agent-side directory (no baseline records to match against)

### Requirement: Push Preview Lists Orphan Siblings

The push preview SHALL include a list of sibling files that will be removed during the push (orphan siblings).

#### Scenario: Push preview shows orphan siblings

- **GIVEN** the canonical directory has removed sibling files that were in the previous push baseline
- **WHEN** the user requests a push preview
- **THEN** the preview SHALL list the orphan sibling paths to be removed
