## MODIFIED Requirements

### Requirement: Routes defined for all 18 pages

The system SHALL define routes for all registered application pages. Each route path SHALL follow the pattern `/<page-id>` where `<page-id>` matches an identifier in the `Page` type union. The route table MUST NOT register `/settings` or `/templates`.

#### Scenario: Navigating to a valid page path

- **WHEN** the router navigates to a path matching a defined route (e.g. `/skills`)
- **THEN** the corresponding page component SHALL be rendered within the main content area

#### Scenario: Removed legacy paths are not registered

- **WHEN** a developer inspects the route table in `src/router.tsx`
- **THEN** no entry SHALL exist for `/settings` or `/templates`
- **AND** no redirect SHALL be registered for those paths

##### Example: page-to-path mapping (post-removal)

| Page ID | Route Path |
|---------|------------|
| `skills` | `/skills` |
| `projects` | `/projects` |
| `felina-settings` | `/felina-settings` |
| `tokens` | `/tokens` |
| `memory` | `/memory` |
| `history` | `/history` |
