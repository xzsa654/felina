## ADDED Requirements

### Requirement: Target Chips Metadata Row

The SkillEditor SHALL display a Target Chips row between the Description and the tab bar when editing an existing skill. The row SHALL NOT appear when creating a new skill. Each target SHALL be rendered as a compact chip displaying agent, scope, and mode. Clicking a chip SHALL expand the full TargetEditor inline. A plus button at the end of the chip row SHALL open the AddTargetDialog.

#### Scenario: Chips display target summary

- **GIVEN** a skill with two targets (Anthropic global auto, Gemini project manual)
- **WHEN** the user selects the skill
- **THEN** two chips appear: one showing "anthropic · global · auto" and one showing "gemini · project · manual"

#### Scenario: Chip click expands full editor

- **WHEN** the user clicks any target chip
- **THEN** the compact chip row is replaced by the full TargetEditor with mode toggles, action buttons, and drift status

#### Scenario: Collapse returns to chips

- **WHEN** the user collapses the expanded TargetEditor
- **THEN** the full editor is hidden and the compact chip row reappears

#### Scenario: Plus button opens add dialog

- **WHEN** the user clicks the plus button at the end of the chip row
- **THEN** the AddTargetDialog opens

#### Scenario: New skill hides chips

- **WHEN** the user is creating a new skill
- **THEN** the Target Chips row is not rendered

#### Scenario: Expanded editor has height limit

- **WHEN** the TargetEditor is expanded and has many targets
- **THEN** the expanded area is constrained to a maximum height with internal scrolling
