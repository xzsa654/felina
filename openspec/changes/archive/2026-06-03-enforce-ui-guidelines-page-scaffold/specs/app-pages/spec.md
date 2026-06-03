## ADDED Requirements

### Requirement: Top-Level Page Scaffold Usage

All top-level registered navigation pages (including `tokens`, `memory`, `history`, and `felina-settings`) SHALL wrap their primary content within the standard `PageHeader` and `PageBody` layout components to ensure structural and visual consistency across the app. Ad-hoc padding div wrappers for page headers MUST NOT be used for top-level pages.

#### Scenario: Top-level page rendering

- **WHEN** the user navigates to any top-level page
- **THEN** the page SHALL render its title and optional actions within a `PageHeader`
- **AND** the page SHALL render its scrollable content within a `PageBody`

### Requirement: Unified Glassmorphism List Treatment

The main workflow lists in `skills`, `projects`, `memory`, and `history` SHALL use a unified glassmorphism visual treatment for normal, hovered, and selected list rows. These rows MUST use translucent backgrounds, low-opacity borders, and backdrop blur to allow the app background grid to remain visible. Main workflow list rows MUST NOT use hard left or right borders, fully solid selected backgrounds, or fully solid hover backgrounds as their primary state indicator.

#### Scenario: User views main workflow lists

- **WHEN** the user navigates to `skills`, `projects`, `memory`, or `history`
- **THEN** each page's main workflow list rows SHALL use translucent row backgrounds and subtle low-opacity borders
- **AND** selected rows SHALL use a brighter translucent accent treatment
- **AND** hovered rows SHALL use a translucent hover treatment with backdrop blur
- **AND** the row state treatment SHALL remain visually consistent across those pages

#### Scenario: Tokens analytics tables remain out of scope

- **WHEN** the user navigates to `tokens`
- **THEN** analytics data tables SHALL remain functionally unchanged by this requirement
- **AND** this requirement SHALL NOT require table-to-list conversion for token analytics components
