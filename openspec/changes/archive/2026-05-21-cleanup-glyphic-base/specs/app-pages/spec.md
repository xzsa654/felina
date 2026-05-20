## ADDED Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly four pages in its navigation: `skills`, `settings`, `templates`, and `memory`. The route table in `src/router.tsx`, the `NAV_ITEMS` array and `Page` type union in `src/lib/stores/navigation.ts`, and the `PAGE_TITLES` / `PAGE_DESCRIPTIONS` maps in `src/lib/components/layout/Header.tsx` MUST all be consistent and contain exactly these four entries and no others.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `settings`, `templates`, and `memory`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx`, the `NAV_ITEMS` ids and `Page` type members in `src/lib/stores/navigation.ts`, and the keys of `PAGE_TITLES` / `PAGE_DESCRIPTIONS` in `src/lib/components/layout/Header.tsx`
- **THEN** all four sources SHALL contain exactly the set `{skills, settings, templates, memory}`
- **AND** none SHALL contain a page id outside this set

#### Scenario: User invokes the Command Palette

- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the palette SHALL list only the four registered pages as navigation targets
- **AND** entries for any removed or retained-but-unregistered page MUST NOT appear

##### Example: command palette navigation entries

- **GIVEN** the cleanup is complete
- **WHEN** the palette renders its navigation section from `NAV_ITEMS`
- **THEN** the visible navigation entries are exactly: Skills & Agents, Settings, Templates, Memory

### Requirement: Retained-for-Reference Components

The repository SHALL retain the frontend components and Rust command modules for the pages `hooks`, `instructions`, `mcp`, and `rules` even though they are not registered in navigation. The Rust modules MUST remain declared in `src-tauri/src/commands/mod.rs` so the files compile, but MUST NOT be registered in the `invoke_handler!` macro in `src-tauri/src/lib.rs`. These pages MUST NOT appear in `src/router.tsx`, `NAV_ITEMS`, the `Page` type, or the Header maps.

#### Scenario: Codebase audit for retained components

- **WHEN** an inspector greps `src/lib/components/` for the names `hooks`, `instructions`, `mcp`, `rules`
- **THEN** each name SHALL match an existing component directory containing the page module file
- **AND** each corresponding Rust file under `src-tauri/src/commands/` SHALL exist and compile

#### Scenario: Retained pages absent from navigation

- **WHEN** an inspector reads `src/router.tsx` and `src/lib/stores/navigation.ts`
- **THEN** the page ids `hooks`, `instructions`, `mcp`, `rules` MUST NOT appear in the route table, `NAV_ITEMS`, or the `Page` type union

#### Scenario: Build verification of unregistered commands

- **WHEN** the developer runs `cargo build` inside `src-tauri/`
- **THEN** the build SHALL succeed with exit code 0
- **AND** the build output MUST NOT contain `unused` warnings for the retained command modules

### Requirement: Removed Pages and Subsystems

The repository SHALL NOT contain any code for the following removed pages: `dashboard`, `plugins`, `git`, `pipelines`, `sessions`, `terminal`, `analytics`, `token-savings`, `context-engine`, `keybindings`. The repository SHALL NOT contain the Rust binaries `glyphic-filter` and `glyphic-ctx`, nor the modules `src-tauri/src/pty.rs`, `src-tauri/src/filter/`, `src-tauri/src/ctx/`. The removed page ids MUST NOT appear in `src/router.tsx`, `NAV_ITEMS`, the `Page` type, or the Header maps.

#### Scenario: Filesystem audit confirms removal

- **WHEN** an inspector lists `src/lib/components/`
- **THEN** none of the directories `dashboard`, `plugins`, `git`, `pipelines`, `sessions`, `terminal`, `analytics`, `token-savings`, `context-engine`, `keybindings` SHALL be present

#### Scenario: Removed pages absent from navigation sources

- **WHEN** an inspector reads `src/router.tsx`, `src/lib/stores/navigation.ts`, and `src/lib/components/layout/Header.tsx`
- **THEN** none of the removed page ids SHALL appear in the route table, `NAV_ITEMS`, the `Page` type union, or the `PAGE_TITLES` / `PAGE_DESCRIPTIONS` maps

#### Scenario: Cargo binary audit

- **WHEN** an inspector reads `src-tauri/Cargo.toml`
- **THEN** the `[[bin]]` entries for `glyphic-filter` and `glyphic-ctx` MUST NOT exist
- **AND** files `src-tauri/src/bin/glyphic_filter.rs` and `src-tauri/src/bin/glyphic_ctx.rs` MUST NOT exist

### Requirement: No Svelte Residue

The repository SHALL NOT contain Svelte framework artifacts. The files `svelte.config.js` and `src/App.svelte` MUST NOT exist. No `*.svelte.ts` store files SHALL exist in `src/lib/stores/`. The `README.md` SHALL NOT advertise Svelte as the frontend framework.

#### Scenario: Svelte residue audit

- **WHEN** an inspector runs `git ls-files` and filters for `\.svelte$`, `\.svelte\.ts$`, or `svelte\.config`
- **THEN** the result SHALL be empty

#### Scenario: README badge audit

- **WHEN** an inspector reads the badge section of `README.md`
- **THEN** the framework badge SHALL identify React (not Svelte)
- **AND** the Tech Stack table row for Frontend SHALL list React

### Requirement: Build Baseline

The cleanup SHALL NOT regress the build relative to a pre-cleanup baseline. Running `npm run check` MUST NOT introduce any TypeScript error that is not already present in the baseline captured before cleanup began. The `npm run check` baseline is currently non-zero because of out-of-scope work-in-progress under `src/lib/components/tokens/`; the cleanup is therefore measured by diff against the baseline, not by a green exit code. Running `cargo build` inside `src-tauri/` MUST NOT introduce any new error or warning relative to its baseline and MUST produce only the default binary `glyphic`; when the local machine lacks the MSVC linker toolchain, this Rust verification MAY be deferred to a machine or CI environment that can build, and the deferral MUST be recorded in the change notes.

#### Scenario: TypeScript baseline preserved

- **WHEN** the developer runs `npm run check` after the cleanup
- **THEN** every TypeScript error present in the output MUST also be present in the baseline captured before the cleanup work began
- **AND** the cleanup MUST NOT add any TypeScript error absent from that baseline

#### Scenario: Page type consistency holds after narrowing

- **WHEN** the `Page` type union in `src/lib/stores/navigation.ts` is narrowed to the four registered pages
- **THEN** `npm run check` SHALL report no errors in `src/lib/components/layout/Header.tsx` arising from `PAGE_TITLES` or `PAGE_DESCRIPTIONS` missing or excess keys

#### Scenario: Rust build produces only glyphic binary

- **WHEN** the developer runs `cargo build` inside `src-tauri/` on a machine with the MSVC linker toolchain available
- **THEN** the build SHALL NOT introduce any new error or warning relative to its baseline
- **AND** the only executable produced in `target/debug/` SHALL be `glyphic` (or `glyphic.exe` on Windows)
- **AND** if no MSVC linker toolchain is available locally, this verification MAY be deferred to a build-capable machine or CI and the deferral recorded in the change notes
