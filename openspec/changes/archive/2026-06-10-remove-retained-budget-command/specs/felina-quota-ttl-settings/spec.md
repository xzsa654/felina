## ADDED Requirements

### Requirement: Felina quota TTL IPC

The system SHALL expose two Tauri commands, `get_felina_quota_ttl` and `set_felina_quota_ttl`, that read and write a shared quota cache TTL value used by both the frontend AgentQuotaPanel and the backend `ccusage::quota_cache_ttl` function. The persisted value SHALL live in `~/.felina/settings.json` under the top-level key `quotaTtlSeconds`. The default fallback value SHALL be `60` seconds. The accepted value range SHALL be `30` to `3600` seconds inclusive.

#### Scenario: Reading TTL when settings file is absent

- **WHEN** `get_felina_quota_ttl` is invoked and `~/.felina/settings.json` does not exist
- **THEN** the system SHALL return `60`

#### Scenario: Reading TTL when settings file is present

- **WHEN** `get_felina_quota_ttl` is invoked and `~/.felina/settings.json` contains a valid `quotaTtlSeconds` value
- **THEN** the system SHALL return that value

##### Example: round-trip

- **GIVEN** `~/.felina/settings.json` contains `{ "agentPaths": { ... }, "quotaTtlSeconds": 90 }`
- **WHEN** `get_felina_quota_ttl` is invoked
- **THEN** the system returns `90`

#### Scenario: Writing TTL preserves other settings fields

- **WHEN** `set_felina_quota_ttl(120)` is invoked on a settings file that already contains an `agentPaths` object
- **THEN** the system SHALL persist `quotaTtlSeconds: 120` while leaving `agentPaths` unchanged

##### Example: preserved fields

- **GIVEN** `~/.felina/settings.json` contains `{ "agentPaths": { "anthropic": { "global": "~/.claude/skills" } } }`
- **WHEN** `set_felina_quota_ttl(120)` is invoked
- **THEN** the file contains `{ "agentPaths": { "anthropic": { "global": "~/.claude/skills" } }, "quotaTtlSeconds": 120 }`

#### Scenario: Writing TTL creates the file when absent

- **WHEN** `set_felina_quota_ttl(45)` is invoked and `~/.felina/settings.json` does not exist
- **THEN** the system SHALL create the file containing `{ "quotaTtlSeconds": 45 }`

#### Scenario: Writing out-of-range TTL is rejected

- **WHEN** `set_felina_quota_ttl(seconds)` is invoked with `seconds < 30` or `seconds > 3600`
- **THEN** the system SHALL return an error and SHALL NOT modify the settings file

##### Example: boundary cases

| Input seconds | Outcome |
| ------------- | ------- |
| 29 | Err, file unchanged |
| 30 | Ok, value persisted |
| 60 | Ok, value persisted |
| 3600 | Ok, value persisted |
| 3601 | Err, file unchanged |

### Requirement: Backend quota cache uses Felina settings

The backend `ccusage::quota_cache_ttl` function SHALL derive its TTL value from the same `quotaTtlSeconds` field in `~/.felina/settings.json` that the frontend AgentQuotaPanel writes through `set_felina_quota_ttl`. The frontend AgentQuotaPanel and the backend `ccusage` quota cache window SHALL be governed by the same persisted value.

#### Scenario: Backend and frontend share the TTL value

- **WHEN** the user persists a TTL of `90` seconds via the AgentQuotaPanel dropdown
- **THEN** subsequent backend quota fetches SHALL treat cached results older than `90` seconds as stale
