## ADDED Requirements

### Requirement: Import Wizard Candidate Ordering and Collapse

The Import Wizard SHALL sort candidates by decision priority: multi-source deferred candidates first, then single-source candidates with conflicts, then candidates with validation errors, then clean single-source candidates. Within each priority group, candidates SHALL be sorted alphabetically by skill name. The wizard SHALL render each candidate row in a collapsed state by default, showing only the skill name, source agent, and status indicators. The user SHALL be able to expand individual rows to see body preview and diff summary.

#### Scenario: Wizard sorts by decision priority

- **WHEN** the Import Wizard loads candidates that include multi-source, conflicted, validation-error, and clean skills
- **THEN** multi-source deferred candidates SHALL appear first
- **AND** single-source candidates with conflicts SHALL appear second
- **AND** candidates with validation errors SHALL appear third
- **AND** clean single-source candidates SHALL appear last
- **AND** within each group, candidates SHALL be sorted alphabetically by skill name

##### Example: four-type mixed candidate list

| Skill Name | Type | Expected Position |
| ----- | ----- | ----- |
| beta-helper | multi-source (anthropic, codex) | 1 |
| alpha-tool | conflict with canonical | 2 |
| gamma-broken | validation error | 3 |
| delta-clean | clean single-source | 4 |

#### Scenario: Candidates are collapsed by default

- **WHEN** the Import Wizard opens with candidates
- **THEN** each candidate row SHALL show skill name, source agent label, and status indicator
- **AND** body preview and diff summary SHALL NOT be visible until the user expands the row

### Requirement: Skills Page Browse Project Import

The Skills page SHALL provide a Browse entry point that allows the user to select a known project and view that project's agent-dir skill inventory using the same ManagedInventory component and import logic as the Projects page. The Browse flow SHALL NOT maintain a separate import implementation.

#### Scenario: User browses a project from Skills page

- **WHEN** the user activates the Browse project import entry on the Skills page
- **THEN** the system SHALL display a list of known projects from the known-projects store
- **AND** the user SHALL be able to select one project
- **AND** the system SHALL display that project's skill inventory using the ManagedInventory component

#### Scenario: Import from browsed project uses same logic as Projects page

- **WHEN** the user imports a skill from the browsed project inventory
- **THEN** the import SHALL execute the same backend command and resolution flow as importing from the Projects page
- **AND** the imported skill SHALL appear in the canonical skill list after import
