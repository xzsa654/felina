## ADDED Requirements

### Requirement: Resolve bundled sidecar tokscale binary

When no explicit binary override is set and the PATH lookup (including Windows `.cmd` variants) fails with not-found, the system SHALL attempt the bundled sidecar tokscale binary located in the same directory as the main executable, before falling back to npx. A sidecar candidate SHALL only be used when the file exists. The explicit override, PATH, and npx behaviors MUST remain unchanged.

#### Scenario: clean machine uses the sidecar

- **WHEN** the refresh runs on a machine with no tokscale on PATH and no Node.js, and the sidecar binary exists next to the main executable
- **THEN** the system SHALL execute the sidecar binary
- **THEN** the refresh SHALL collect tokscale data instead of reporting `missing_binary`

#### Scenario: PATH installation takes precedence over the sidecar

- **WHEN** the refresh runs and a tokscale binary is resolvable via PATH
- **THEN** the system SHALL use the PATH binary and SHALL NOT execute the sidecar

#### Scenario: missing sidecar preserves current behavior

- **WHEN** the refresh runs in a development environment where the sidecar file does not exist
- **THEN** the resolution chain SHALL behave exactly as before this change (PATH → npx → `missing_binary`)

#### Scenario: failing sidecar falls back to npx

- **WHEN** the sidecar binary exists but its execution fails
- **THEN** the system SHALL continue with the npx fallback without aborting the refresh

##### Example: full resolution order

| Step | Candidate | Condition |
| ---- | --------- | --------- |
| 1 | explicit override (env) | set → used exclusively, no fallback |
| 2 | PATH `tokscale` (+ `.cmd` on Windows) | found → use |
| 3 | sidecar next to main executable | file exists → use |
| 4 | `npx --yes tokscale@latest` (+ `.cmd` on Windows) | found → use |
| 5 | — | report `missing_binary` |
