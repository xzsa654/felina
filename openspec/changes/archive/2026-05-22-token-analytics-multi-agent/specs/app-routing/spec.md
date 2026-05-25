## MODIFIED Requirements

### Requirement: Routes defined for all 18 pages

The system SHALL define routes for all application pages. Each route path SHALL follow the pattern `/<page-id>` where `<page-id>` matches the existing `Page` type identifiers.

#### Scenario: Navigating to a valid page path

- **WHEN** the router navigates to a path matching a defined route (e.g. `/settings`)
- **THEN** the corresponding page component SHALL be rendered within the main content area

##### Example: page-to-path mapping

| Page ID | Route Path |
|---------|------------|
| `dashboard` | `/dashboard` |
| `settings` | `/settings` |
| `hooks` | `/hooks` |
| `instructions` | `/instructions` |
| `memory` | `/memory` |
| `mcp` | `/mcp` |
| `skills` | `/skills` |
| `rules` | `/rules` |
| `plugins` | `/plugins` |
| `git` | `/git` |
| `terminal` | `/terminal` |
| `tokens` | `/tokens` |
| `templates` | `/templates` |
| `sessions` | `/sessions` |
| `pipelines` | `/pipelines` |
| `token-savings` | `/token-savings` |
| `context-engine` | `/context-engine` |
| `keybindings` | `/keybindings` |

## ADDED Requirements

### Requirement: Legacy analytics route redirects to tokens

The system SHALL redirect the path `/analytics` to `/tokens`.

#### Scenario: User navigates to old analytics URL

- **WHEN** the router resolves path `/analytics`
- **THEN** the system SHALL redirect to `/tokens`

## REMOVED Requirements

### Requirement: Analytics page route

**Reason**: Replaced by the new TokensPage at `/tokens` with full token analytics dashboard.
**Migration**: Navigate to `/tokens` instead of `/analytics`.

#### Scenario: Old route redirects

- **WHEN** the user navigates to `/analytics`
- **THEN** the router SHALL redirect to `/tokens` instead of rendering the old AnalyticsPage
