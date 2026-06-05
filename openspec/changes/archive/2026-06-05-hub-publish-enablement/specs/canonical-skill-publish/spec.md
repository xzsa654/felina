## ADDED Requirements

### Requirement: Publish Canonical Skill Command

The Felina backend SHALL provide a Tauri command `publish_canonical_skill(name)` that packages a canonical skill and uploads it to the configured market server. The command SHALL validate `name` against the canonical skill identifier ruleset (ASCII alphanumeric, hyphens, underscores, dots; non-empty) before any filesystem or network access, rejecting invalid names with an Err string. The command SHALL read the skill directory at `~/.felina/skills/<name>/`, compute the directory_hash using the existing fan_out::directory_hash function, package the directory as a tar.gz in memory **excluding any `.felina-sync-meta.json` files at any depth** so publisher-local target metadata does not leak to installers, retrieve the market server base URL via get_market_server_url(), URL-encode the name segment, and PUT the tar.gz to `<baseUrl>/api/skills/<encodedName>` with header X-Content-Hash carrying the directory_hash. Successful HTTP 2xx SHALL return Ok(()); other status codes SHALL return an Err string containing the HTTP status and the server-provided error body.

#### Scenario: Publish an existing canonical skill

- **WHEN** the frontend invokes publish_canonical_skill("code-review") and `~/.felina/skills/code-review/` exists with a valid SKILL.md
- **THEN** the command SHALL package the directory, PUT it to the market server, and return Ok(()) on HTTP 2xx

#### Scenario: Publish a non-existent canonical skill

- **WHEN** the frontend invokes publish_canonical_skill("does-not-exist") and no directory exists at `~/.felina/skills/does-not-exist/`
- **THEN** the command SHALL return an Err string explaining that the skill directory was not found, and SHALL NOT perform an HTTP request

#### Scenario: Server rejects with HTTP error

- **WHEN** publish_canonical_skill is invoked and the market server responds with a non-2xx status
- **THEN** the command SHALL return an Err string containing the HTTP status code and the server response body

#### Scenario: Sync-meta excluded from package

- **WHEN** publish_canonical_skill is invoked for a skill directory that contains a `.felina-sync-meta.json` file (and optionally `.felina-sync-meta.json` inside sub-directories)
- **THEN** the resulting tar.gz uploaded to the server SHALL NOT contain any `.felina-sync-meta.json` entry

#### Scenario: Invalid name is rejected

- **WHEN** publish_canonical_skill is invoked with a name containing characters outside the canonical skill identifier ruleset (e.g. `../escape`, empty string, `name with spaces`, path separators)
- **THEN** the command SHALL return an Err string identifying the invalid name and SHALL NOT touch the filesystem or perform an HTTP request

### Requirement: Delete Market Skill Command

The Felina backend SHALL provide a Tauri command `delete_market_skill(name)` that sends DELETE to the configured market server. The command SHALL validate `name` against the canonical skill identifier ruleset and URL-encode the name segment before constructing the URL `<baseUrl>/api/skills/<encodedName>`. HTTP 2xx and 404 SHALL both be treated as success.

#### Scenario: Delete succeeds

- **WHEN** the frontend invokes delete_market_skill("code-review") and the server responds 204
- **THEN** the command SHALL return Ok(())

#### Scenario: Delete on missing skill

- **WHEN** the frontend invokes delete_market_skill("never-existed") and the server responds 404
- **THEN** the command SHALL return Ok(())

#### Scenario: Delete fails with server error

- **WHEN** the frontend invokes delete_market_skill and the server responds with 5xx
- **THEN** the command SHALL return an Err string containing the HTTP status code

#### Scenario: Invalid name is rejected

- **WHEN** delete_market_skill is invoked with a name outside the canonical skill identifier ruleset
- **THEN** the command SHALL return an Err string identifying the invalid name and SHALL NOT perform an HTTP request
