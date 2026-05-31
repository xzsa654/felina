## MODIFIED Requirements

### Requirement: Resizable Skills Workspace

The skills workspace layout SHALL present the SkillEditor in a document-centric layout when editing an existing skill. The layout SHALL consist of a sticky Document Header (skill name as a large heading, description, and action buttons), a tab bar (Content and Settings), and a scrollable content area below.

The Document Header SHALL display the skill name as a large, non-editable heading. When creating a new skill, the name field SHALL be an editable input styled to match the heading appearance. The description SHALL appear directly below the name as a subdued-color editable textarea without visible borders. Action buttons (Save, Rename, Delete, Cancel) SHALL be positioned at the right side of the name row.

The tab bar SHALL provide Content and Settings tabs using the project's existing underline tab style. The Content tab SHALL contain the Markdown body editor with edit/preview toggle. The Settings tab SHALL contain Agent Fields and Advanced Extras sections, displayed without a collapse toggle since tab isolation makes collapsing redundant.

The Document Header and tab bar SHALL be sticky (fixed at the top of the editor panel) while the content area scrolls independently.

When the editor is in broken raw mode (YAML parse failure), the Document Header and tab bar SHALL be hidden, showing only the error-styled action bar and full-width raw textarea.

When the editor has unsaved changes, a dirty indicator SHALL appear next to the skill name.

#### Scenario: Existing skill displays document header

- **WHEN** the user selects an existing skill in the skill list
- **THEN** the editor displays the skill name as a large heading
- **AND** the description appears below as subdued text
- **AND** Save, Rename, and Delete buttons appear at the right of the name row

#### Scenario: New skill displays editable name

- **WHEN** the user starts creating a new skill
- **THEN** the name field is an editable input styled as a large heading
- **AND** Cancel and Save buttons appear in the action bar

#### Scenario: Tab switching between Content and Settings

- **WHEN** the user clicks the Settings tab
- **THEN** the Markdown body editor is hidden
- **AND** Agent Fields and Advanced Extras sections are displayed

#### Scenario: Sticky header during scroll

- **WHEN** the content area has enough content to scroll
- **THEN** the Document Header and tab bar remain fixed at the top
- **AND** only the content below the tab bar scrolls

#### Scenario: Broken raw mode hides tabs

- **WHEN** a skill has broken YAML frontmatter
- **THEN** the Document Header and tab bar are not rendered
- **AND** only the error action bar and raw textarea are shown

#### Scenario: Dirty indicator appears on unsaved changes

- **WHEN** the user modifies the description or body without saving
- **THEN** a dirty indicator appears next to the skill name
- **AND** the indicator disappears after saving
