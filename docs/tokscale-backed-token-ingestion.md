# Tokscale-backed Token Ingestion

## Migration Strategy

Token refresh now treats `tokscale_export` as the production ingestion source. A successful tokscale refresh replaces only rows with `source = 'tokscale_export'`, writes a new `source_generation`, and sets `token_ingestion_state.active_source` to `tokscale_export`.

Legacy Felina parser rows are retained with `source = 'felina_parser'` and `source_generation = 'legacy'`. Analytics queries read only the active source, so legacy parser totals and tokscale totals are not added together after migration.

By default, Felina first invokes an installed `tokscale` binary with `graph --no-spinner` so production refreshes preserve dated buckets for daily and monthly analytics. If no local binary is available and no override is configured, it falls back to `npx --yes tokscale@latest graph --no-spinner` so refresh totals match the current tokscale CLI behavior. Set `PATH=/path/to/tokscale` to force a specific local binary and disable the npm fallback.

Tokscale rows are accepted only when required machine-readable fields are present and valid: client/agent, provider, model, input, output, cache read, cache write, and message count. Reasoning is preserved when present and treated as `0` when tokscale omits it. Missing or invalid required fields return `unsupported_schema` instead of writing partial zero-filled production records.

Aggregate tokscale rows without timestamps are stored with timestamp `0` and displayed as the `all` scope bucket. They are not rewritten to the refresh time, so date filters and time-series views do not imply fake per-event timing.

Parser fallback is explicit. The default `refresh_token_data` path attempts tokscale and returns an observable failure status if tokscale is unavailable or invalid; it does not automatically run the legacy parsers. The diagnostic fallback path writes rows with `source = 'parser_fallback'` and marks the refresh result with `fallback_used = true`.

## Rollback

Because legacy rows are retained, rollback is an active-source switch rather than a destructive restore. To read pre-migration parser-backed analytics again, set the active source back to `felina_parser`:

```bash
sqlite3 ~/.felina/tokens.db "INSERT OR REPLACE INTO token_ingestion_state (key, value) VALUES ('active_source', 'felina_parser');"
```

To return to tokscale-backed analytics after a successful refresh:

```bash
sqlite3 ~/.felina/tokens.db "INSERT OR REPLACE INTO token_ingestion_state (key, value) VALUES ('active_source', 'tokscale_export');"
```

If a tokscale refresh fails, the storage replacement transaction is not committed and the previous active source remains readable.

## Smoke Result

Mocked smoke coverage was run through token unit tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml tokens::
```

Result: 40 token tests passed.

Verified scenarios:

- `analytics_response_uses_active_tokscale_source_without_legacy_totals` confirms `/tokens` analytics totals, cache metrics, model breakdown, agent breakdown, and time series are derived from tokscale rows while legacy rows remain isolated.
- `active_source_can_roll_back_to_legacy_parser_rows` confirms rollback to `felina_parser` makes old parser-backed analytics readable again.
- `refresh_success_reports_tokscale_source_and_message_count` confirms refresh diagnostics expose `active_source = tokscale_export`, `status = ok`, and tokscale `messageCount` as parsed event count.
- `refresh_reports_tokscale_failure_without_automatic_parser_fallback` confirms a tokscale command failure preserves the last active source, returns `status = command_failed`, and does not enable fallback by default.
- `unsupported_schema_for_missing_required_tokscale_fields_even_with_tokens` confirms schema drift does not become partial zero-filled production data.
- `all_scope_tokscale_rows_are_labeled_all_not_refresh_day` confirms aggregate rows without timestamps are not assigned to refresh time.
- `source_is_part_of_unique_identity` confirms legacy and tokscale rows with matching event identity can coexist by source.
