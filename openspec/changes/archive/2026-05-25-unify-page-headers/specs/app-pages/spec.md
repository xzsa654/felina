## MODIFIED Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly seven pages in its navigation: `skills`, `projects`, `settings`, `templates`, `tokens`, `memory`, and `history`. The route table in `src/router.tsx` and the `NAV_ITEMS` array plus `Page` type union in `src/lib/stores/navigation.ts` MUST all be consistent and contain exactly these seven entries and no others. The app SHALL NOT render a shared application-level title bar above the page content; page titles are owned by each page (see the Page Title Provision requirement), so there is no `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map to keep consistent.

The `skills` and `projects` pages SHALL be siblings; the prior pattern of using an in-page Global/Project toggle on the Skills page to switch between two canonical-scope views SHALL be removed. The Skills page SHALL show only global canonical master files; the Projects page SHALL show a per-project managed-inventory view defined by the `projects-view` capability.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `projects`, `settings`, `templates`, `tokens`, `memory`, and `history`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx` and the `NAV_ITEMS` ids plus `Page` type members in `src/lib/stores/navigation.ts`
- **THEN** both sources SHALL contain exactly the set `{skills, projects, settings, templates, tokens, memory, history}`
- **AND** neither SHALL contain a page id outside this set
- **AND** there SHALL be no `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map in the codebase acting as a third navigation-consistency source

#### Scenario: User invokes the Command Palette

- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the palette SHALL list only the seven registered pages as navigation targets
- **AND** entries for any removed or retained-but-unregistered page MUST NOT appear

#### Scenario: Skills page does not show a canonical-scope toggle

- **WHEN** the user opens the Skills page
- **THEN** the page header SHALL NOT render a Global/Project toggle
- **AND** the page SHALL list canonical skills sourced exclusively from `~/.felina/skills/`

## ADDED Requirements

### Requirement: Page Title Provision

The app SHALL NOT render a shared application-level header bar above the routed page content; the `AppLayout` in `src/router.tsx` SHALL NOT mount a global title/description component, and `src/lib/components/layout/Header.tsx` SHALL NOT exist. Each registered page SHALL render its own title within its own component. Pages under active development (`skills`, `projects`, `tokens`) SHALL render their existing in-page title (the `PageScaffold` `PageHeader` for `skills` and `projects`, the in-page heading for `tokens`). Legacy pages pending redevelopment (`settings`, `memory`, `history`) SHALL each render at least a minimal in-page title so that no registered page is title-less.

#### Scenario: No global header bar above page content

- **WHEN** an inspector reads `AppLayout` in `src/router.tsx`
- **THEN** it SHALL NOT mount a shared header/title component above the `<Outlet />`
- **AND** the file `src/lib/components/layout/Header.tsx` MUST NOT exist

#### Scenario: Every registered page shows exactly one title

- **WHEN** the user navigates to any of `skills`, `projects`, `settings`, `templates`, `tokens`, `memory`, or `history`
- **THEN** the page SHALL display its title exactly once
- **AND** no page SHALL display two stacked page-level titles

#### Scenario: Legacy pages retain a placeholder title

- **WHEN** the user opens `settings`, `memory`, or `history`
- **THEN** each page SHALL display a non-empty in-page title
- **AND** that title MAY be a minimal hardcoded heading not wired to the i18n system, because these pages are pending redevelopment
