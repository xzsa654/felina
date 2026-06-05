## MODIFIED Requirements

### Requirement: Hub UI Presentation

The Hub page SHALL fetch market skills from the configured market server URL and present them in a browsing experience optimized for selection and preview. Before a selection is made, the page SHALL show the market skill list as the primary content. After the user selects a market skill, the page SHALL render a two-pane layout: a left pane containing the market skill list and a right pane containing a readonly preview for the selected market skill.

The Hub preview SHALL reuse the Skills page browsing mental model where practical, but it SHALL NOT use the editable Skill editor for market content. Market content is remote/read-only until installed.

The Hub preview SHALL provide install/update action only. It SHALL NOT expose a server-side delete action even though the `delete_market_skill` Tauri command exists, because server-side delete affects every Hub user and falls outside this change's scope.

The Hub page SHALL provide a refresh control whose interaction shape mirrors `SkillsPage.handleReload` (button position in PageHeader actions, spinner with brief residual animation, disabled state during reload) but whose behavior is restricted to readonly browsing: refresh SHALL refetch the market list and re-derive installed state, and SHALL NOT trigger drift scan, import-count refresh, or canonical-entries reload. Refresh SHALL preserve the current selection.

#### Scenario: Selecting a market skill opens split preview

- **GIVEN** the Hub page has loaded market skills `code-review` and `doc-writer`
- **WHEN** the user selects `code-review`
- **THEN** the page SHALL show a left pane with the market skill list
- **AND** the page SHALL show a right pane preview for `code-review`
- **AND** the preview SHALL be readonly

#### Scenario: Preview displays install-relevant metadata

- **GIVEN** the selected market skill has `name`, `version`, `description`, and `contentHash`
- **WHEN** the preview renders
- **THEN** it SHALL display the skill name, version when present, description when present, and local install state
- **AND** it SHALL provide the install or update action when the local content is not up to date
- **AND** it SHALL display the up-to-date state when the local directory hash matches `contentHash`

### Requirement: Installed State Display

The Hub page SHALL derive installed state by recomputing the local canonical directory hash via `get_skill_directory_hash(name)` and comparing it against the market skill `contentHash`. The local hash SHALL be derived live from the on-disk content at the time the comparison runs; the Hub SHALL NOT depend on any cached `directoryHash` field inside `.felina-sync-meta.json`. Installed state SHALL be visible in both the market skill list and the selected market skill preview. After install succeeds, the Hub page SHALL recompute the local hash and re-derive installed state without requiring an app restart.

#### Scenario: Install recomputes hash and refreshes preview state

- **GIVEN** `code-review` is selected in the Hub preview and is not up to date
- **WHEN** the user installs `code-review` and the install command returns success
- **THEN** the Hub page SHALL recompute the local directory hash for `code-review` by calling `get_skill_directory_hash`
- **AND** the selected preview SHALL update to the up-to-date state only if the recomputed hash equals the market `contentHash`
- **AND** the left list row for `code-review` SHALL show the same derived installed state
- **AND** the Hub page SHALL NOT optimistically mark `code-review` as up-to-date based on install success alone

#### Scenario: Refresh preserves selection and re-derives installed state

- **GIVEN** the Hub split view is open with `code-review` selected
- **WHEN** the user clicks the refresh button
- **THEN** the Hub page SHALL refetch the market skill list
- **AND** SHALL recompute the local directory hash for each listed skill
- **AND** SHALL keep `code-review` as the selected skill
- **AND** SHALL NOT invoke drift scan, import count refresh, or canonical entries reload

#### Scenario: Local edit after install is detected on refresh

- **GIVEN** `code-review` was installed from Hub and shows up-to-date
- **AND** the user edits `~/.felina/skills/code-review/SKILL.md` outside the Hub
- **WHEN** the user clicks the Hub refresh button
- **THEN** the recomputed local directory hash SHALL differ from the market `contentHash`
- **AND** the list row and preview SHALL show the install/update affordance instead of up-to-date
