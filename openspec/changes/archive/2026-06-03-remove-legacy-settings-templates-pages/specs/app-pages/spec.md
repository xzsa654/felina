## MODIFIED Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly the following pages in its navigation: `skills`, `projects`, `tokens`, `memory`, and `history`. The route table in `src/router.tsx`, the `NAV_ITEMS` array and `Page` type union in `src/lib/stores/navigation.ts` MUST all be consistent and contain exactly these entries (excluding any retained-for-reference modules, which MUST NOT appear in navigation). The legacy `settings` and `templates` pages MUST NOT appear in any of these sources.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `projects`, `tokens`, `memory`, and `history`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx` with the `NAV_ITEMS` ids and `Page` type members in `src/lib/stores/navigation.ts`
- **THEN** all sources SHALL contain exactly the set `{skills, projects, tokens, memory, history}` for registered navigation pages
- **AND** none SHALL contain `settings` or `templates` as a page id

#### Scenario: Legacy pages absent after removal

- **WHEN** an inspector greps the repository for `SettingsPage`, `TemplatesPage`, or `TemplateGallery` component references
- **THEN** no active page module SHALL import or render them
- **AND** the files `src/lib/components/settings/SettingsPage.tsx`, `src/lib/components/templates/TemplatesPage.tsx`, and `src/lib/components/shared/TemplateGallery.tsx` SHALL NOT exist

## REMOVED Requirements

### Requirement: Settings Page Agent Paths Section

**Reason**: The legacy `SettingsPage` is being removed. Felina-specific settings are owned by `FelinaSettingsPage` (`/felina-settings`), which is covered by the `felina-settings-page` capability and is out of scope for this requirement.

**Migration**: Any agent-paths configuration UI requirements SHALL be addressed under the `felina-settings-page` capability if needed in the future. No replacement is provided in this change.

#### Scenario: Removal verification

- **WHEN** an inspector audits `src/lib/components/` after this change ships
- **THEN** no `settings/` directory containing `SettingsPage.tsx` SHALL exist
- **AND** no requirement governing an Agent Paths section under the legacy SettingsPage SHALL remain in any active spec
