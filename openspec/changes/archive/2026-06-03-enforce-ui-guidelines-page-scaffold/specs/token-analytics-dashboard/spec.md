## MODIFIED Requirements

### Requirement: TokensPage replaces AnalyticsPage

The system SHALL provide a `TokensPage` React component at route `/tokens` that replaces the legacy `AnalyticsPage`. The page SHALL be loaded via `React.lazy()` code splitting. The page SHALL use `PageHeader` and `PageBody` components for its layout structure. The page's navigation tabs SHALL be placed within the `bottomSlot` property of the `PageHeader`.

#### Scenario: User navigates to /tokens

- **WHEN** the user navigates to `/tokens`
- **THEN** the TokensPage SHALL render with a loading spinner during lazy load
- **THEN** the page SHALL display the token analytics dashboard after data loads
- **AND** the page's structural layout SHALL consist of a `PageHeader` containing tabs and a `PageBody`
