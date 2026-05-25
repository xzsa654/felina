## ADDED Requirements

### Requirement: Router uses Memory Router

The system SHALL use `createMemoryRouter` from react-router to manage client-side routing. The router SHALL NOT depend on browser History API or URL protocols, ensuring compatibility with Tauri's `tauri://` resource serving.

#### Scenario: Application starts on dashboard

- **WHEN** the application launches
- **THEN** the router SHALL navigate to the `/dashboard` route by default

#### Scenario: Root path redirects to dashboard

- **WHEN** the router resolves path `/`
- **THEN** the system SHALL redirect to `/dashboard`

### Requirement: All pages are lazy-loaded

The system SHALL load each page component as a separate code chunk using `React.lazy()`. No page component SHALL be imported statically in the router configuration file.

#### Scenario: Page chunk loads on first navigation

- **WHEN** the user navigates to a page for the first time
- **THEN** the system SHALL dynamically import that page's JavaScript chunk

#### Scenario: Suspense fallback shown during load

- **WHEN** a lazy page chunk is being fetched
- **THEN** the system SHALL display a `<PageLoader />` spinner in place of the page content

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
| `analytics` | `/analytics` |
| `templates` | `/templates` |
| `sessions` | `/sessions` |
| `pipelines` | `/pipelines` |
| `token-savings` | `/token-savings` |
| `context-engine` | `/context-engine` |
| `keybindings` | `/keybindings` |

### Requirement: Sidebar uses Link-based navigation

The Sidebar component SHALL use react-router `<Link>` elements (or `useNavigate`) for navigation. The Sidebar SHALL NOT call a Zustand `navigateTo` action for page switching.

#### Scenario: User clicks a sidebar nav item

- **WHEN** the user clicks a navigation item in the Sidebar
- **THEN** the router SHALL navigate to the corresponding route path without a full page reload

#### Scenario: Active route item is highlighted

- **WHEN** the current route matches a sidebar item's path
- **THEN** that sidebar item SHALL be visually highlighted as the active page

### Requirement: RouterProvider wraps the application

The application root (`App.tsx`) SHALL render a `<RouterProvider router={router}>` as the routing context. The `PAGE_MAP` static object and Zustand `currentPage` state SHALL be removed.

#### Scenario: Application renders with RouterProvider

- **WHEN** the React application mounts
- **THEN** `<RouterProvider>` SHALL be present in the component tree, providing routing context to all descendant components
