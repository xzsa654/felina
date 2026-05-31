## ADDED Requirements

### Requirement: Block-Level Info Dialog

The system SHALL provide a block-level info dialog that explains complex terminology and operations for specific UI sections without cluttering the main interactive area.

#### Scenario: User views Target Editor help

- **GIVEN** the user is viewing a skill in the Skills page
- **WHEN** the user clicks the help icon next to the "TARGETS" section header
- **THEN** a dialog SHALL appear
- **AND** the dialog SHALL explain "Auto/Manual/Disabled" sync modes, "Pull" (appears on drift), and "Repoint" (re-target project folder)
- **AND** the dialog SHALL be dismissible by clicking a close button or clicking outside the dialog

#### Scenario: User views Managed Inventory help

- **GIVEN** the user is viewing the Managed Inventory in the Projects page
- **WHEN** the user clicks the help icon next to the section header
- **THEN** a dialog SHALL appear
- **AND** the dialog SHALL explain the "Multi Source" state
- **AND** the dialog SHALL be dismissible
