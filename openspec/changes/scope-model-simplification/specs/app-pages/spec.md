## MODIFIED Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly five pages in its navigation: `skills`, `projects`, `settings`, `templates`, and `memory`. The route table in `src/router.tsx`, the `NAV_ITEMS` array and `Page` type union in `src/lib/stores/navigation.ts`, and the `PAGE_TITLES` / `PAGE_DESCRIPTIONS` maps in `src/lib/components/layout/Header.tsx` MUST all be consistent and contain exactly these five entries and no others.

The `skills` and `projects` pages SHALL be siblings; the prior pattern of using an in-page Global/Project toggle on the Skills page to switch between two canonical-scope views SHALL be removed. The Skills page SHALL show only global canonical master files; the Projects page SHALL show a per-project managed-inventory view defined by the `projects-view` capability.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `projects`, `settings`, `templates`, and `memory`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx`, the `NAV_ITEMS` ids and `Page` type members in `src/lib/stores/navigation.ts`, and the keys of `PAGE_TITLES` / `PAGE_DESCRIPTIONS` in `src/lib/components/layout/Header.tsx`
- **THEN** all four sources SHALL contain exactly the set `{skills, projects, settings, templates, memory}`
- **AND** none SHALL contain a page id outside this set

#### Scenario: User invokes the Command Palette

- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the palette SHALL list only the five registered pages as navigation targets
- **AND** entries for any removed or retained-but-unregistered page MUST NOT appear

#### Scenario: Skills page does not show a canonical-scope toggle

- **WHEN** the user opens the Skills page
- **THEN** the page header SHALL NOT render a Global/Project toggle
- **AND** the page SHALL list canonical skills sourced exclusively from `~/.felina/skills/`
