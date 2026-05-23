## ADDED Requirements

### Requirement: Known Projects Model

The system SHALL provide a known-projects list that unions three sources and exposes each project's origin. The persistent store SHALL be a JSON file at `~/.felina/known-projects.json` with shape `{ projects: [string] }`, holding only explicitly user-added project root paths. At list time the system SHALL merge three sources: the current selected project working directory (source `cwd`), every project hash directory under `~/.claude/projects/` that resolves to an existing path via the Project Path Resolution rule (source `detected`), and every entry in the JSON `projects` array (source `saved`). The merged result SHALL be deduplicated by normalized path (absolute path, forward-slash separators, no trailing slash, case-folded on Windows) and each resulting entry SHALL carry the set of sources that contributed it. A project hash that resolves as unresolved SHALL NOT appear in the list.

#### Scenario: Three sources merge and deduplicate

- **WHEN** the current working directory is `C:/proj/foo`, `~/.claude/projects/` contains a hash resolving to `C:/proj/foo` and another resolving to `C:/proj/bar`, and the JSON file lists `C:/proj/baz`
- **THEN** the list SHALL contain exactly three entries: `C:/proj/foo`, `C:/proj/bar`, and `C:/proj/baz`
- **AND** the entry for `C:/proj/foo` SHALL carry both the `cwd` and `detected` sources
- **AND** the entry for `C:/proj/baz` SHALL carry the `saved` source

#### Scenario: Unresolved hash is excluded

- **WHEN** `~/.claude/projects/` contains a hash directory that the Project Path Resolution rule reports as unresolved
- **THEN** that hash SHALL NOT contribute any entry to the known-projects list

#### Scenario: Missing or malformed store yields cwd and detected only

- **WHEN** `~/.felina/known-projects.json` does not exist, is not valid JSON, or lacks a `projects` key
- **THEN** the system SHALL treat the saved source as empty and SHALL return only `cwd` and `detected` entries without raising an error

### Requirement: Known Projects Mutation

The system SHALL allow adding and removing explicit (saved-source) projects, mutating only the JSON store. Adding a project SHALL append its path to the `projects` array unless an entry with the same normalized path already exists, in which case the operation SHALL be a no-op. Removing a project SHALL delete the entry whose normalized path matches the argument and SHALL leave other entries untouched. Add and remove SHALL NOT affect the `cwd` or `detected` sources.

#### Scenario: Adding an existing project is idempotent

- **WHEN** the JSON store already lists `C:/proj/foo` and the system is asked to add `C:/proj/foo/` (trailing slash) or `c:/proj/foo` (different case on Windows)
- **THEN** the store SHALL remain unchanged with a single `C:/proj/foo` entry

#### Scenario: Removing a saved project deletes only that entry

- **WHEN** the JSON store lists `C:/proj/foo` and `C:/proj/bar` and the system is asked to remove `C:/proj/foo`
- **THEN** the store SHALL list only `C:/proj/bar`
