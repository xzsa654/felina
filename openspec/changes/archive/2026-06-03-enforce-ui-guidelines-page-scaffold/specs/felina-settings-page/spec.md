## MODIFIED Requirements

### Requirement: Felina Settings Page

The app SHALL provide a Felina Settings page at route `/felina-settings`. This page SHALL render within the standard app layout (with Sidebar visible) and SHALL be lazy-loaded. The page SHALL NOT appear in the Sidebar navigation list (`NAV_ITEMS`). The page SHALL display its own in-page title. The page SHALL contain an Agent Paths section, a Custom Project Paths section, a Data Pruning section, and a Skill Library section. The page SHALL use `PageHeader` and `PageBody` components to structure its content.

#### Scenario: User navigates to Felina Settings

- **WHEN** the app navigates to `/felina-settings`
- **THEN** the page renders with all four sections: Agent Paths, Custom Project Paths, Data Pruning, and Skill Library
- **AND** the page structure SHALL use `PageHeader` and `PageBody`
