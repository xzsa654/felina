## MODIFIED Requirements

### Requirement: Router uses Memory Router

The system SHALL use `createMemoryRouter` from react-router to manage client-side routing. The router SHALL NOT depend on browser History API or URL protocols, ensuring compatibility with Tauri's `tauri://` resource serving. The router SHALL register `/history` as a top-level route and SHALL support query parameters on that memory-router path.

#### Scenario: Application starts on skills

- **WHEN** the application launches
- **THEN** the router SHALL navigate to the `/skills` route by default

#### Scenario: Root path redirects to skills

- **WHEN** the router resolves path `/`
- **THEN** the system SHALL redirect to `/skills`

#### Scenario: User navigates to History

- **WHEN** the router resolves path `/history`
- **THEN** the system SHALL lazy-load and render the History page

#### Scenario: User opens a History deep link

- **WHEN** the router resolves path `/history?agent=codex-cli&session=abc123`
- **THEN** the system SHALL render the History page
- **AND** the History page SHALL receive `agent=codex-cli` and `session=abc123` from the route search parameters
