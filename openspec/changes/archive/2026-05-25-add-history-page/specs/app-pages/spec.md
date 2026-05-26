## MODIFIED Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly six pages in its navigation: `skills`, `settings`, `templates`, `tokens`, `memory`, and `history`. The route table in `src/router.tsx`, the `NAV_ITEMS` array and `Page` type union in `src/lib/stores/navigation.ts`, and the `PAGE_TITLES` / `PAGE_DESCRIPTIONS` maps in `src/lib/components/layout/Header.tsx` MUST all be consistent and contain exactly these six entries and no others.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `settings`, `templates`, `tokens`, `memory`, and `history`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx`, the `NAV_ITEMS` ids and `Page` type members in `src/lib/stores/navigation.ts`, and the keys of `PAGE_TITLES` / `PAGE_DESCRIPTIONS` in `src/lib/components/layout/Header.tsx`
- **THEN** all four sources SHALL contain exactly the set `{skills, settings, templates, tokens, memory, history}`
- **AND** none SHALL contain a page id outside this set

#### Scenario: User invokes the Command Palette

- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the palette SHALL list only the six registered pages as navigation targets
- **AND** entries for any removed or retained-but-unregistered page MUST NOT appear

##### Example: command palette navigation entries

- **GIVEN** the History page is registered
- **WHEN** the palette renders its navigation section from `NAV_ITEMS`
- **THEN** the visible navigation entries are exactly: Skills & Agents, Settings, Templates, Tokens, Memory, History
