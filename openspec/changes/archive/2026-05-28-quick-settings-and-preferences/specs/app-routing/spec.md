## ADDED Requirements

### Requirement: Felina Settings route

The router SHALL define a `/felina-settings` route within the app layout. The route SHALL lazy-load the `FelinaSettingsPage` component. This route SHALL NOT be included in the `NAV_ITEMS` array or the `Page` type union. The route SHALL use the same `LazyPage` wrapper and `Suspense` fallback pattern as other routes.

#### Scenario: User navigates to felina-settings

- **WHEN** the router resolves path `/felina-settings`
- **THEN** the system SHALL lazy-load and render the FelinaSettingsPage component within the app layout

#### Scenario: Felina Settings route not in NAV_ITEMS

- **WHEN** an inspector reads the `NAV_ITEMS` array in navigation store
- **THEN** no entry with id `felina-settings` SHALL be present
