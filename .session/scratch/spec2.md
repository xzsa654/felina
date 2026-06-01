## ADDED Requirements

### Requirement: Inline resolution for staging name conflicts

The system SHALL detect if a skill moved to the staging queue has the same name as an existing canonical skill. When a conflict is detected, the system SHALL NOT block the movement but SHALL immediately display an inline conflict resolution UI on that skill's card in the staging queue, offering "Overwrite" and "Rename" options. The system MUST disable the final "Import" execution button as long as any unresolved conflicts remain in the staging queue.

#### Scenario: Staging a skill with no conflict
- **WHEN** user moves a skill to staging and its name does not match any existing skill
- **THEN** the skill card displays a "Ready" state
- **AND** no conflict UI is shown

#### Scenario: Staging a skill with a name conflict
- **WHEN** user moves a skill to staging and its name matches an existing skill
- **THEN** the skill card displays a conflict warning
- **AND** expands to show "Overwrite" and "Rename" options
- **AND** the final Import button becomes disabled

#### Scenario: User resolves conflict by renaming
- **WHEN** user selects "Rename" on a conflicted skill and provides a new unique name
- **THEN** the conflict warning is cleared
- **AND** the skill is marked as Ready
