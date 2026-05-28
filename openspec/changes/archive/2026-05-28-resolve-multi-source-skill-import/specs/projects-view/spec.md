## ADDED Requirements

### Requirement: Multi-Source Inline Source Selection

The ManagedInventory component SHALL replace the greyed-out multi-source text indicator with an expandable inline source selection UI. When a skill name appears in multiple agent directories, the user SHALL be able to expand the row, view each source's agent label and file path, select one source, and import it to Felina using the existing import resolution flow.

#### Scenario: Multi-source row is expandable

- **WHEN** the ManagedInventory displays a skill that exists in multiple agent directories
- **THEN** the row SHALL show the skill name with a multi-source indicator and an expand control
- **AND** the row SHALL NOT be greyed out or disabled

#### Scenario: User selects a source and imports

- **WHEN** the user expands a multi-source row and selects one of the available sources
- **THEN** the system SHALL enable the import action for the selected source
- **AND** importing SHALL use the existing SelectSource resolution to write the selected content to canonical

### Requirement: Import Button Label Accuracy

The ManagedInventory import button label SHALL read "Import to Felina" (en) / "匯入至 Felina" (zh-TW) instead of "Import to global" / "匯入至 Global". The label SHALL accurately reflect that the import destination is the Felina canonical skill store, not a specific agent's global directory.

#### Scenario: Button label in English locale

- **WHEN** the locale is English and a single-source importable skill is displayed
- **THEN** the import button label SHALL read "Import to Felina"

#### Scenario: Button label in Traditional Chinese locale

- **WHEN** the locale is zh-TW and a single-source importable skill is displayed
- **THEN** the import button label SHALL read "匯入至 Felina"
