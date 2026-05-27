## ADDED Requirements

### Requirement: Skill Markdown Preview

The system SHALL provide a Markdown preview mode for skill content to enhance readability. This preview mode SHALL be available in both the Skill Editor main content area and the Sync Target inspection modal. The preview mode SHALL render the Markdown text using the existing application Markdown rendering component.

#### Scenario: Toggling preview in Skill Editor

- **WHEN** a user opens a skill in the Skill Editor
- **THEN** the editor SHALL provide a toggle between "Edit" and "Preview" modes for the Markdown body
- **AND WHEN** the user selects "Preview"
- **THEN** the raw Markdown text SHALL be rendered as formatted HTML

#### Scenario: Default preview in Sync Target modal

- **WHEN** a user opens the Sync Target inspection modal
- **THEN** the skill content SHALL be rendered in Markdown preview mode by default
- **AND** the modal SHALL provide a toggle to view the raw source if desired

##### Example: Markdown rendering

- **GIVEN** a skill contains a Markdown table and bold text
- **WHEN** the user switches to Preview mode
- **THEN** the text is rendered as an HTML table and bold `<strong>` text instead of raw `|` and `**` characters
