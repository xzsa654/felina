## MODIFIED Requirements

### Requirement: Hub UI Presentation

The Hub page SHALL read the market server base URL from the persisted setting (via the Market Server URL Read Command) instead of using a hardcoded `http://localhost:3100` constant. The fetch call to `/api/skills` SHALL use this configured URL. All other presentation behavior SHALL remain unchanged.

#### Scenario: Viewing the Hub page

- **WHEN** the Hub page loads
- **THEN** the UI SHALL fetch the list of skills from the configured market server URL and render them as glassmorphism cards without using HTML tables
