## MODIFIED Requirements

### Requirement: Multi-Source Import Interaction

UPDATE the multi-source conflict resolution from inline radio buttons to an Inline Drawer with Selectable Cards.

#### Scenario: Multi-source skill triggers Inline Drawer

- **GIVEN** a discovered skill has multiple source candidates (e.g., both `.claude/skills/` and `.gemini/skills/` contain the same skill name)
- **WHEN** the user clicks the Import button on that row
- **THEN** an Inline Drawer SHALL expand below the row displaying one Selectable Card per source candidate
  - Each card SHALL show the source agent icon, file path, and source metadata
  - The selected card SHALL be visually distinguished with an accent border
  - A confirm button at the bottom of the Drawer SHALL execute the import with the selected source

#### Scenario: Drawer exclusive open behavior

- **GIVEN** an Inline Drawer is open for one discovered skill
- **WHEN** the user clicks Import on a different discovered skill
- **THEN** the previous Drawer SHALL close and the new Drawer SHALL open
  - Pressing Escape or clicking outside the Drawer SHALL close it without importing
