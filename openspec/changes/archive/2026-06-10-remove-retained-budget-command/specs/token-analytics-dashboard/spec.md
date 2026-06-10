## ADDED Requirements

### Requirement: Agent quota panel TTL persistence

The `AgentQuotaPanel` SHALL render a TTL selector with the options `30`, `60`, `90`, `120`, `150` seconds. Selecting an option SHALL persist the value through `set_felina_quota_ttl` and SHALL govern the panel's quota refetch interval. On reload, the panel SHALL initialize the selector from `get_felina_quota_ttl`.

#### Scenario: Selecting a TTL persists across reloads

- **WHEN** the user selects `30s` in the TTL dropdown and reloads the `/tokens` page
- **THEN** the dropdown SHALL display `30s` after reload
- **THEN** `~/.felina/settings.json` SHALL contain `quotaTtlSeconds: 30`

#### Scenario: Panel fallback when TTL has never been set

- **WHEN** the user opens the `/tokens` page on a machine where `~/.felina/settings.json` does not contain `quotaTtlSeconds`
- **THEN** the dropdown SHALL display `60s`
