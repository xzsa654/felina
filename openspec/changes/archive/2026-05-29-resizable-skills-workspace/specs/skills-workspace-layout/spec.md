## ADDED Requirements

### Requirement: Resizable Skills Workspace

The system SHALL provide a resizable horizontal layout on the Skills page. The left pane (Skill List) and the right pane (Skill Editor) SHALL be separated by a draggable handle. The left pane SHALL support a minimum and maximum width to prevent unusable layouts.

#### Scenario: User resizes the workspace panels

- **WHEN** the user hovers over the boundary between the Skill List and the Skill Editor
- **THEN** the system SHALL display a resize cursor
- **WHEN** the user drags the boundary
- **THEN** the widths of the left and right panes SHALL adjust dynamically

### Requirement: Collapsible Skill List

The Skill List pane SHALL be collapsible. When the pane is resized below its minimum display width or when explicitly toggled, it SHALL collapse entirely, allowing the Skill Editor to consume the full available horizontal space.

#### Scenario: User collapses the list by dragging

- **WHEN** the user drags the resize boundary to the left past the minimum width threshold
- **THEN** the Skill List SHALL collapse
- **AND** the Skill Editor SHALL expand to fill the remaining width

### Requirement: Persistent Layout Preferences

The system SHALL persist the user's customized layout sizes. When the user resizes the panes and later navigates away or reloads the application, the system SHALL restore the previously set pane dimensions.

#### Scenario: Layout width is restored on reload

- **GIVEN** the user has resized the Skill List to occupy 40% of the screen width
- **WHEN** the user reloads the application and navigates to the Skills page
- **THEN** the Skill List SHALL still occupy 40% of the screen width
