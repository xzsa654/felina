## ADDED Requirements

### Requirement: Application starts without updater configuration

The application SHALL initialize and present its main window without requiring a `plugins.updater` section in `src-tauri/tauri.conf.json`. The Tauri builder in the backend entry module SHALL NOT register `tauri_plugin_updater`, and the capability set SHALL NOT grant any `updater:*` permission.

#### Scenario: Release build launches with no updater config

- **WHEN** a release build produced from a configuration that contains no `plugins.updater` section is launched
- **THEN** the main window SHALL open normally and the process SHALL NOT terminate with a `PluginInitialization` panic

#### Scenario: No updater plugin surface in the codebase

- **WHEN** the repository sources are inspected
- **THEN** `src-tauri/Cargo.toml` SHALL NOT depend on `tauri-plugin-updater`, `package.json` SHALL NOT depend on `@tauri-apps/plugin-updater`, and `src-tauri/capabilities/default.json` SHALL NOT list `updater:default`

### Requirement: Distribution is manual installer based

Application updates SHALL be distributed as manually installed packages (.msi/.exe/.dmg). The frontend SHALL NOT render any in-app update banner or invoke updater APIs.

#### Scenario: App layout renders without update banner

- **WHEN** the application layout mounts
- **THEN** the layout SHALL render the sidebar and routed page content without an `UpdateBanner` component, and no call to `@tauri-apps/plugin-updater` SHALL occur
