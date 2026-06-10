## ADDED Requirements

### Requirement: Resolve Windows command shims for tokscale invocation

On Windows, when spawning a bare command name (not an explicit user-provided path) for the tokscale source or its npx fallback, and the initial spawn fails with a not-found error, the system SHALL retry the spawn using the `.cmd` variant of the command name. Explicit binary paths provided via the tokscale binary override MUST NOT be retried with name variants. On non-Windows platforms the spawn behavior MUST remain unchanged. The retry MUST NOT route execution through a shell interpreter.

#### Scenario: npm-installed tokscale shim is found on Windows

- **WHEN** the refresh runs on Windows and `tokscale` is installed globally via npm (exposing only a `tokscale.cmd` shim on PATH)
- **THEN** the system SHALL retry with `tokscale.cmd` after the bare `tokscale` spawn fails with not-found
- **THEN** the refresh SHALL collect tokscale data instead of reporting `missing_binary`

#### Scenario: npx fallback shim is found on Windows

- **WHEN** the refresh runs on Windows, `tokscale` is absent, and Node.js is installed (exposing `npx.cmd` on PATH)
- **THEN** the system SHALL retry the fallback with `npx.cmd` after the bare `npx` spawn fails with not-found
- **THEN** the npx fallback SHALL execute instead of reporting `missing_binary`

#### Scenario: explicit binary override is not variant-retried

- **WHEN** the refresh runs with an explicit tokscale binary path override and that path does not exist
- **THEN** the system SHALL NOT attempt `.cmd` or other name variants
- **THEN** the refresh SHALL report `missing_binary` for the tokscale source

#### Scenario: neither tokscale nor Node.js is installed on Windows

- **WHEN** the refresh runs on Windows and the bare names and `.cmd` variants of both `tokscale` and `npx` fail with not-found
- **THEN** the refresh SHALL report `missing_binary` with a message indicating both the binary and the npx fallback are unavailable

##### Example: resolution order on Windows

| Attempt | Command | Result | Next step |
| ------- | ------- | ------ | --------- |
| 1 | `tokscale` | not-found | retry variant |
| 2 | `tokscale.cmd` | not-found | npx fallback |
| 3 | `npx --yes tokscale@latest` | not-found | retry variant |
| 4 | `npx.cmd --yes tokscale@latest` | not-found | report `missing_binary` |
