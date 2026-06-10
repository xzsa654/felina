# Tokscale-backed Token Ingestion

## Architecture

Token analytics uses **two independent data sources** stored in the same `token_events` table, separated by the `source` column:

| Source | Data origin | Granularity | Strengths | Weaknesses |
|--------|-------------|-------------|-----------|------------|
| `tokscale_export` | `tokscale graph --json --no-spinner` (API billing data) | Daily buckets (midnight UTC) | Accurate token/cost numbers | No hourly breakdown, no project/session fields |
| `felina_parser` | Local JSONL session files (file scanner) | Per-message timestamps | Hourly distribution, project & session IDs | Inflated token counts (cumulative context per message) |

## Mixed Source Selection

Analytics queries are **not** single-source. Different views use different sources based on what data they need:

| View | Source | Reason |
|------|--------|--------|
| Dashboard Daily / Weekly / Monthly | `tokscale_export` | Accurate billing totals |
| Dashboard Hourly heatmap | `felina_parser` | Needs per-hour timestamps |
| Day detail: Model breakdown | `tokscale_export` | Accurate per-model counts |
| Day detail: Hourly chart | `felina_parser` | Needs hourly distribution |
| Day detail: Project breakdown | `felina_parser` | tokscale has no project field |
| Day detail: Top Sessions | `felina_parser` | tokscale has no session IDs |

Resolution logic in `aggregator.rs`:
- `default_analytics_source(Daily/Weekly/Monthly)` → prefers `tokscale_export` if it has rows, falls back to `active_source`
- `default_analytics_source(Hourly)` → uses `active_source` (which is `felina_parser` since tokscale has no hourly data)
- `auto_dated` → `pick_dated_source()` selects the source with the most `timestamp > 0` rows (typically `felina_parser`), except for model breakdown which explicitly prefers `tokscale_export`

## Refresh Flow

```
User clicks Refresh
  │
  ├─ Invalidate dated-source cache
  ├─ Run tokscale ingestion
  │   ├─ Resolve binary: FELINA_TOKSCALE_BIN → tokscale (PATH) → npx tokscale@latest
  │   ├─ Run tokscale graph --no-spinner
  │   ├─ Parse JSON output → ReconciliationRecord[]
  │   ├─ Unknown agents → silently skipped (does NOT fail the batch)
  │   ├─ DELETE FROM token_events WHERE source='tokscale_export'
  │   ├─ INSERT new records
  │   └─ Set active_source = 'tokscale_export'
  │
  ├─ If tokscale succeeded:
  │   └─ run_parser_scan() (best-effort, errors silently ignored)
  │       └─ INSERT OR IGNORE INTO token_events WHERE source='felina_parser'
  │
  └─ If tokscale failed + allow_parser_fallback:
      └─ refresh_parser_fallback()
          └─ Scan JSONL, write to source='parser_fallback', mark fallback_used=true
```

**Important**: `replace_tokscale_records()` does `DELETE` then `INSERT` — full replacement on every refresh. `felina_parser` uses `INSERT OR IGNORE` with unique key `(source, agent, session_id, timestamp, model)` — existing rows are never updated.

## Binary Resolution

Felina resolves the tokscale binary in this order:

1. `FELINA_TOKSCALE_BIN` env var (absolute path)
2. `tokscale` found in system `PATH`
3. `npx --yes tokscale@latest` as last-resort fallback

**Windows `.cmd` shim retry**: `std::process::Command::new` does not resolve `.cmd` shims, but npm-installed CLIs expose only `tokscale.cmd` / `npx.cmd` on Windows. When spawning a bare command name (no path separator, no extension) fails with not-found on Windows, Felina retries once with the `.cmd` variant. Explicit binary paths (e.g. `FELINA_TOKSCALE_BIN`) are never variant-retried. Resolution order on Windows:

| Attempt | Command | On not-found |
| ------- | ------- | ------------ |
| 1 | `tokscale` | retry variant |
| 2 | `tokscale.cmd` | npx fallback |
| 3 | `npx --yes tokscale@latest` | retry variant |
| 4 | `npx.cmd --yes tokscale@latest` | report `missing_binary` |

tokscale is listed as a devDependency in `package.json` (`npm install` puts it at `node_modules/.bin/tokscale`).

**Setup (macOS / Linux)**:
```bash
export FELINA_TOKSCALE_BIN="$PWD/node_modules/.bin/tokscale"
```

**Setup (Windows PowerShell)**:
```powershell
$env:FELINA_TOKSCALE_BIN = "$PWD\node_modules\.bin\tokscale.cmd"
```

If `FELINA_TOKSCALE_BIN` is not set but `node_modules/.bin` is in `PATH`, the default `tokscale` lookup will find it.

## Unknown Agent Handling

When tokscale reports an agent not in Felina's `AgentId` enum (`claude-code`, `codex-cli`, `gemini-cli`), the ingestion layer **skips that single record** with a stderr warning instead of failing the entire batch:

```
tokscale ingestion: skipping unknown agent 'opencode' (model=big-pickle, events=7)
tokscale ingestion: skipped 1 record(s) from unknown agents
```

Known agents continue to be ingested normally. If ALL records are skipped, it returns `unsupported_schema`.

## Data Retention & Pruning

**Auto-prune is disabled.** Refresh no longer deletes old data automatically.

Users manage retention manually from **Felina Settings page**:

- **Prune old data**: Select retention period (30/60/90/180/365 days), deletes dated records (`timestamp > 0`) older than the cutoff
- **Delete all data**: Clears the entire `token_events` table, including aggregate rows (`timestamp = 0`)

Backend commands:
- `prune_token_events(retention_days: u64)` → `DELETE FROM token_events WHERE timestamp > 0 AND timestamp < cutoff`
- `delete_all_token_events()` → `DELETE FROM token_events`

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

## Scan Cursor

The `felina_parser` uses an mtime-based cursor in the `scan_state` table to skip files that haven't changed since the last scan. After deleting parser data manually, the cursor must also be cleared to force a full rescan:

```bash
sqlite3 ~/.felina/tokens.db "DELETE FROM scan_state;"
```

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/tokens/aggregator.rs` | Source selection, refresh orchestration, analytics queries |
| `src-tauri/src/tokens/tokscale.rs` | Tokscale binary execution, skip-unknown-agent, JSON parsing |
| `src-tauri/src/tokens/tokscale_ingestion.rs` | Record → TokenEvent conversion, replace_tokscale_records |
| `src-tauri/src/tokens/storage.rs` | SQL schema, CRUD, prune/delete, active_source management |
| `src-tauri/src/tokens/scan_state.rs` | Persistent mtime cursor for parser scanner |
| `src-tauri/src/tokens/scanner.rs` | File system scanner (felina_parser source) |
| `src-tauri/src/tokens/parsers/` | Claude Code, Codex CLI, Gemini CLI JSONL parsers |
| `src/lib/components/settings/DataPruningSection.tsx` | Manual prune UI |
