use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::tokens::types::{AgentId, ProgressSink, ScanProgress, TokenEvent};

pub const SOURCE_FELINA_PARSER: &str = "felina_parser";
pub const SOURCE_TOKSCALE_EXPORT: &str = "tokscale_export";
pub const SOURCE_PARSER_FALLBACK: &str = "parser_fallback";
const ACTIVE_SOURCE_KEY: &str = "active_source";
const CODEX_INPUT_CACHE_NORMALIZED_KEY: &str = "codex_input_cache_normalized_v1";
const TOKEN_IMPORT_COMPLETED_KEY: &str = "token_import_completed_v1";
const PARSER_UPSERT_BATCH_SIZE: usize = 5_000;

/// SQLite-backed cache for token events at `~/.felina/tokens.db`.
pub struct TokenStorage {
    db: Mutex<Connection>,
}

impl TokenStorage {
    /// Open or create the database at ~/.felina/tokens.db.
    pub fn new() -> Result<Self, String> {
        Self::with_path(Self::db_path())
    }

    /// Open storage at an explicit database path (for testing).
    pub fn with_path(db_path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create directory: {}", e))?;
        }

        if let Some(storage) = Self::try_init(&db_path)? {
            return Ok(storage);
        }
        // Corruption detected — delete file and WAL/SHM sidecars, retry once.
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
        Self::try_init(&db_path)?
            .ok_or_else(|| "Cannot recover token storage db after recreate".to_string())
    }

    fn db_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".felina")
            .join("tokens.db")
    }

    /// Open the database, create the schema, and verify the table is readable.
    ///
    /// Returns `Ok(None)` when SQLITE_NOTADB or SQLITE_CORRUPT is detected so
    /// the caller can delete the file and retry.
    fn try_init(db_path: &PathBuf) -> Result<Option<Self>, String> {
        let conn = Connection::open(db_path).map_err(|e| format!("Cannot open db: {}", e))?;

        if let Err(e) = conn.execute_batch("PRAGMA journal_mode=WAL;") {
            if Self::is_corrupt_error(&e) {
                return Ok(None);
            }
            return Err(format!("Cannot set WAL mode: {}", e));
        }

        if let Err(e) = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS token_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                cache_write_tokens INTEGER NOT NULL DEFAULT 0,
                reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                project TEXT,
                session_id TEXT,
                cost_usd REAL NOT NULL DEFAULT 0.0,
                source TEXT NOT NULL DEFAULT 'felina_parser',
                source_generation TEXT NOT NULL DEFAULT 'legacy',
                event_count INTEGER NOT NULL DEFAULT 1,
                UNIQUE(source, agent, session_id, timestamp, model)
            );
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON token_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_agent ON token_events(agent);
            CREATE INDEX IF NOT EXISTS idx_events_model ON token_events(model);
            CREATE INDEX IF NOT EXISTS idx_events_source ON token_events(source);
            CREATE INDEX IF NOT EXISTS idx_events_source_ts ON token_events(source, timestamp);
            CREATE TABLE IF NOT EXISTS token_ingestion_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        ) {
            if Self::is_corrupt_error(&e) {
                return Ok(None);
            }
            return Err(format!("Cannot create schema: {}", e));
        }
        Self::migrate_schema(&conn)?;

        // Verify token_events data pages are readable — sqlite_master can be
        // intact while the table's own pages are damaged.
        if let Err(e) = conn.query_row("SELECT count(*) FROM token_events", [], |_| Ok(())) {
            if Self::is_corrupt_error(&e) {
                return Ok(None);
            }
            return Err(format!("Token events table unreadable: {}", e));
        }

        Ok(Some(TokenStorage {
            db: Mutex::new(conn),
        }))
    }

    fn migrate_schema(conn: &Connection) -> Result<(), String> {
        let columns = conn
            .prepare("PRAGMA table_info(token_events)")
            .map_err(|e| format!("Cannot inspect token_events schema: {}", e))?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Cannot read token_events schema: {}", e))?
            .filter_map(|row| row.ok())
            .collect::<Vec<_>>();

        if !columns.iter().any(|column| column == "source") {
            conn.execute_batch(
                "ALTER TABLE token_events ADD COLUMN source TEXT NOT NULL DEFAULT 'felina_parser';",
            )
            .map_err(|e| format!("Cannot add token_events.source: {}", e))?;
        }
        if !columns.iter().any(|column| column == "source_generation") {
            conn.execute_batch("ALTER TABLE token_events ADD COLUMN source_generation TEXT NOT NULL DEFAULT 'legacy';")
                .map_err(|e| format!("Cannot add token_events.source_generation: {}", e))?;
        }
        if !columns.iter().any(|column| column == "event_count") {
            conn.execute_batch(
                "ALTER TABLE token_events ADD COLUMN event_count INTEGER NOT NULL DEFAULT 1;",
            )
            .map_err(|e| format!("Cannot add token_events.event_count: {}", e))?;
        }
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_events_source ON token_events(source);
             CREATE INDEX IF NOT EXISTS idx_events_source_ts ON token_events(source, timestamp);
             CREATE TABLE IF NOT EXISTS token_ingestion_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
             );",
        )
        .map_err(|e| format!("Cannot create token ingestion metadata: {}", e))?;
        Self::migrate_source_aware_unique_key(conn)?;
        Self::normalize_codex_input_cache_once(conn)?;
        Ok(())
    }

    fn normalize_codex_input_cache_once(conn: &Connection) -> Result<(), String> {
        let already_normalized = conn
            .query_row(
                "SELECT value FROM token_ingestion_state WHERE key = ?1",
                params![CODEX_INPUT_CACHE_NORMALIZED_KEY],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("Cannot read Codex input normalization state: {}", e))?
            .is_some();
        if already_normalized {
            return Ok(());
        }

        conn.execute(
            "UPDATE token_events
             SET input_tokens = input_tokens - cache_read_tokens
             WHERE source = ?1
               AND agent = 'codex-cli'
               AND cache_read_tokens > 0
               AND input_tokens >= cache_read_tokens",
            params![SOURCE_FELINA_PARSER],
        )
        .map_err(|e| format!("Cannot normalize Codex input/cache tokens: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO token_ingestion_state (key, value) VALUES (?1, '1')",
            params![CODEX_INPUT_CACHE_NORMALIZED_KEY],
        )
        .map_err(|e| format!("Cannot mark Codex input normalization: {}", e))?;
        Ok(())
    }

    fn migrate_source_aware_unique_key(conn: &Connection) -> Result<(), String> {
        if Self::has_source_aware_unique_key(conn)? {
            return Ok(());
        }

        conn.execute_batch(
            "ALTER TABLE token_events RENAME TO token_events_legacy_unique;
             CREATE TABLE token_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                cache_write_tokens INTEGER NOT NULL DEFAULT 0,
                reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                project TEXT,
                session_id TEXT,
                cost_usd REAL NOT NULL DEFAULT 0.0,
                source TEXT NOT NULL DEFAULT 'felina_parser',
                source_generation TEXT NOT NULL DEFAULT 'legacy',
                event_count INTEGER NOT NULL DEFAULT 1,
                UNIQUE(source, agent, session_id, timestamp, model)
             );
             INSERT OR IGNORE INTO token_events
                (id, agent, provider, model, timestamp, input_tokens, output_tokens,
                 cache_read_tokens, cache_write_tokens, reasoning_tokens, project,
                 session_id, cost_usd, source, source_generation, event_count)
             SELECT id, agent, provider, model, timestamp, input_tokens, output_tokens,
                 cache_read_tokens, cache_write_tokens, reasoning_tokens, project,
                 session_id, cost_usd, source, source_generation, event_count
             FROM token_events_legacy_unique;
             DROP TABLE token_events_legacy_unique;
             CREATE INDEX IF NOT EXISTS idx_events_timestamp ON token_events(timestamp);
             CREATE INDEX IF NOT EXISTS idx_events_agent ON token_events(agent);
             CREATE INDEX IF NOT EXISTS idx_events_model ON token_events(model);
             CREATE INDEX IF NOT EXISTS idx_events_source ON token_events(source);",
        )
        .map_err(|e| format!("Cannot migrate token_events unique key: {}", e))?;
        Ok(())
    }

    fn has_source_aware_unique_key(conn: &Connection) -> Result<bool, String> {
        let mut indexes = conn
            .prepare("PRAGMA index_list(token_events)")
            .map_err(|e| format!("Cannot inspect token_events indexes: {}", e))?;
        let rows = indexes
            .query_map([], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
            })
            .map_err(|e| format!("Cannot read token_events indexes: {}", e))?;

        for row in rows {
            let (name, unique) =
                row.map_err(|e| format!("Cannot read token_events index: {}", e))?;
            if unique == 0 {
                continue;
            }
            let mut info = conn
                .prepare(&format!("PRAGMA index_info({})", name))
                .map_err(|e| format!("Cannot inspect token_events index {}: {}", name, e))?;
            let columns = info
                .query_map([], |row| row.get::<_, String>(2))
                .map_err(|e| format!("Cannot read token_events index {}: {}", name, e))?
                .filter_map(|row| row.ok())
                .collect::<Vec<_>>();
            if columns == ["source", "agent", "session_id", "timestamp", "model"] {
                return Ok(true);
            }
        }

        Ok(false)
    }

    fn is_corrupt_error(e: &rusqlite::Error) -> bool {
        let msg = e.to_string().to_lowercase();
        msg.contains("not a database") || msg.contains("malformed") || msg.contains("i/o error")
    }

    /// Upsert token events (INSERT OR IGNORE on unique constraint).
    pub fn upsert_events(&self, events: &[TokenEvent]) -> Result<u64, String> {
        self.upsert_events_for_source(events, SOURCE_FELINA_PARSER, "legacy")
    }

    pub fn upsert_events_for_source(
        &self,
        events: &[TokenEvent],
        source: &str,
        generation: &str,
    ) -> Result<u64, String> {
        self.upsert_events_for_source_with_progress(events, source, generation, None, 0, 0)
    }

    pub(crate) fn upsert_events_for_source_with_progress(
        &self,
        events: &[TokenEvent],
        source: &str,
        generation: &str,
        progress_sink: Option<Arc<dyn ProgressSink>>,
        files_scanned: u64,
        files_total: u64,
    ) -> Result<u64, String> {
        let mut conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut inserted = 0u64;

        for chunk in events.chunks(PARSER_UPSERT_BATCH_SIZE) {
            let tx = conn
                .transaction()
                .map_err(|e| format!("Cannot begin parser upsert batch: {}", e))?;
            {
                let mut stmt = tx
                    .prepare_cached(
                        "INSERT OR IGNORE INTO token_events
                            (agent, provider, model, timestamp, input_tokens, output_tokens,
                             cache_read_tokens, cache_write_tokens, reasoning_tokens,
                             project, session_id, cost_usd, source, source_generation, event_count)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0.0, ?12, ?13, 1)",
                    )
                    .map_err(|e| format!("Cannot prepare parser upsert: {}", e))?;

                for event in chunk {
                    let result = stmt.execute(params![
                        event.agent.to_string(),
                        event.provider,
                        event.model,
                        event.timestamp,
                        event.input_tokens,
                        event.output_tokens,
                        event.cache_read_tokens,
                        event.cache_write_tokens,
                        event.reasoning_tokens,
                        event.project,
                        event.session_id,
                        source,
                        generation,
                    ]);
                    match result {
                        Ok(rows) => {
                            if rows > 0 {
                                inserted += 1;
                            }
                        }
                        Err(e) => {
                            eprintln!("Storage: error inserting event: {}", e);
                        }
                    }
                }
            }
            tx.commit()
                .map_err(|e| format!("Cannot commit parser upsert batch: {}", e))?;
            if let Some(sink) = progress_sink.as_ref() {
                sink.report(ScanProgress {
                    phase: "parser".to_string(),
                    files_scanned,
                    files_total,
                    events_ingested: inserted,
                });
            }
        }

        Ok(inserted)
    }

    pub fn replace_tokscale_events(
        &self,
        events: &[TokenEvent],
        generation: &str,
    ) -> Result<u64, String> {
        let records = events.iter().map(|event| (event, 1)).collect::<Vec<_>>();
        self.replace_tokscale_records(&records, generation)
    }

    pub fn replace_tokscale_records(
        &self,
        records: &[(&TokenEvent, u64)],
        generation: &str,
    ) -> Result<u64, String> {
        let mut conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Cannot begin tokscale replacement: {}", e))?;
        tx.execute(
            "DELETE FROM token_events WHERE source = ?1",
            params![SOURCE_TOKSCALE_EXPORT],
        )
        .map_err(|e| format!("Cannot clear prior tokscale events: {}", e))?;

        let mut inserted = 0u64;
        for (event, event_count) in records {
            let rows = tx
                .execute(
                    "INSERT OR IGNORE INTO token_events
                        (agent, provider, model, timestamp, input_tokens, output_tokens,
                         cache_read_tokens, cache_write_tokens, reasoning_tokens,
                         project, session_id, cost_usd, source, source_generation, event_count)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0.0, ?12, ?13, ?14)",
                    params![
                        event.agent.to_string(),
                        event.provider,
                        event.model,
                        event.timestamp,
                        event.input_tokens,
                        event.output_tokens,
                        event.cache_read_tokens,
                        event.cache_write_tokens,
                        event.reasoning_tokens,
                        event.project,
                        event.session_id,
                        SOURCE_TOKSCALE_EXPORT,
                        generation,
                        (*event_count).max(1),
                    ],
                )
                .map_err(|e| format!("Cannot insert tokscale event: {}", e))?;
            if rows > 0 {
                inserted += 1;
            }
        }

        tx.execute(
            "INSERT OR REPLACE INTO token_ingestion_state (key, value) VALUES (?1, ?2)",
            params![ACTIVE_SOURCE_KEY, SOURCE_TOKSCALE_EXPORT],
        )
        .map_err(|e| format!("Cannot set active source: {}", e))?;
        tx.commit()
            .map_err(|e| format!("Cannot commit tokscale replacement: {}", e))?;
        Ok(inserted)
    }

    pub fn set_active_source(&self, source: &str) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO token_ingestion_state (key, value) VALUES (?1, ?2)",
            params![ACTIVE_SOURCE_KEY, source],
        )
        .map_err(|e| format!("Cannot set active source: {}", e))?;
        Ok(())
    }

    pub fn active_source(&self) -> Result<String, String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let source = conn
            .query_row(
                "SELECT value FROM token_ingestion_state WHERE key = ?1",
                params![ACTIVE_SOURCE_KEY],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("Cannot read active source: {}", e))?
            .unwrap_or_else(|| SOURCE_FELINA_PARSER.to_string());
        Ok(source)
    }

    pub fn token_import_needs_import(&self) -> Result<bool, String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let completed = conn
            .query_row(
                "SELECT value FROM token_ingestion_state WHERE key = ?1",
                params![TOKEN_IMPORT_COMPLETED_KEY],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("Cannot read token import status: {}", e))?;
        Ok(completed.as_deref() != Some("1"))
    }

    pub fn mark_token_import_completed(&self) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO token_ingestion_state (key, value) VALUES (?1, '1')",
            params![TOKEN_IMPORT_COMPLETED_KEY],
        )
        .map_err(|e| format!("Cannot mark token import completed: {}", e))?;
        Ok(())
    }

    pub fn count_events_for_source(&self, source: &str) -> Result<u64, String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.query_row(
            "SELECT COUNT(*) FROM token_events WHERE source = ?1",
            params![source],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count as u64)
        .map_err(|e| format!("Cannot count source events: {}", e))
    }

    /// Get the most recent timestamp for an agent (for incremental scanning).
    pub fn max_timestamp(&self, agent: &AgentId) -> Result<i64, String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let result: Result<i64, _> = conn.query_row(
            "SELECT COALESCE(MAX(timestamp), 0) FROM token_events WHERE agent = ?1",
            params![agent.to_string()],
            |row| row.get(0),
        );
        result.map_err(|e| format!("Query error: {}", e))
    }

    /// Delete events whose timestamp is older than `retention_days` days ago.
    /// Returns the number of rows deleted.
    pub fn prune_older_than(&self, retention_days: u64) -> Result<u64, String> {
        let cutoff = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
            - (retention_days as i64 * 86400);

        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let deleted = conn
            .execute(
                "DELETE FROM token_events WHERE timestamp > 0 AND timestamp < ?1",
                params![cutoff],
            )
            .map_err(|e| format!("Cannot prune old events: {}", e))?;
        Ok(deleted as u64)
    }

    /// Delete all rows from `token_events` (both dated and aggregate).
    /// Returns the number of rows deleted.
    pub fn delete_all_events(&self) -> Result<u64, String> {
        let mut conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Cannot begin delete all events: {}", e))?;
        let deleted = tx
            .execute("DELETE FROM token_events", [])
            .map_err(|e| format!("Cannot delete all events: {}", e))?;
        tx.execute(
            "DELETE FROM token_ingestion_state WHERE key = ?1",
            params![TOKEN_IMPORT_COMPLETED_KEY],
        )
        .map_err(|e| format!("Cannot reset token import completion: {}", e))?;
        tx.commit()
            .map_err(|e| format!("Cannot commit delete all events: {}", e))?;
        Ok(deleted as u64)
    }

    /// Raw connection access for the aggregator (caller must handle locking).
    pub fn connection(&self) -> &Mutex<Connection> {
        &self.db
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_db(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("glyphic_storage_{}.db", name))
    }

    fn remove_test_db(path: &PathBuf) {
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    fn make_event(agent: AgentId, ts: i64, input: u64, output: u64, session: &str) -> TokenEvent {
        TokenEvent {
            agent,
            provider: "anthropic".into(),
            model: "claude-sonnet".into(),
            timestamp: ts,
            input_tokens: input,
            output_tokens: output,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            project: None,
            session_id: Some(session.into()),
        }
    }

    fn make_cached_codex_event(input: u64, cache_read: u64, session: &str) -> TokenEvent {
        TokenEvent {
            agent: AgentId::CodexCli,
            provider: "openai".into(),
            model: "gpt-5.5".into(),
            timestamp: 1000,
            input_tokens: input,
            output_tokens: 50,
            cache_read_tokens: cache_read,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            project: None,
            session_id: Some(session.into()),
        }
    }

    #[test]
    fn test_duplicate_events_not_inserted_parsed_vs_inserted_separate() {
        let db = temp_db("duplicate_events");
        remove_test_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("Failed to create storage");

        // First insert: 3 events
        let events1 = vec![
            make_event(AgentId::ClaudeCode, 1000, 100, 50, "sess-a"),
            make_event(AgentId::ClaudeCode, 1001, 200, 60, "sess-b"),
            make_event(AgentId::ClaudeCode, 1002, 300, 70, "sess-c"),
        ];
        let inserted1 = storage.upsert_events(&events1).expect("First upsert");
        assert_eq!(inserted1, 3, "First upsert should insert all 3 events");

        // Second upsert: same 3 events + 2 new ones = 5 total parsed
        let events2 = vec![
            make_event(AgentId::ClaudeCode, 1000, 100, 50, "sess-a"), // duplicate
            make_event(AgentId::ClaudeCode, 1001, 200, 60, "sess-b"), // duplicate
            make_event(AgentId::ClaudeCode, 1002, 300, 70, "sess-c"), // duplicate
            make_event(AgentId::ClaudeCode, 1003, 400, 80, "sess-d"), // new
            make_event(AgentId::ClaudeCode, 1004, 500, 90, "sess-e"), // new
        ];
        let parsed2 = events2.len() as u64;
        let inserted2 = storage.upsert_events(&events2).expect("Second upsert");

        // Only 2 new events should be inserted (the duplicates are ignored)
        assert_eq!(
            inserted2, 2,
            "Second upsert should insert only 2 new events"
        );
        assert!(
            parsed2 > inserted2,
            "Parsed count ({}) should be greater than inserted count ({}) on rescan",
            parsed2,
            inserted2
        );

        // Verify total in DB is 5
        let conn = storage.db.lock().unwrap();
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM token_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            total, 5,
            "DB should have 5 total events (3 + 2, no duplicates)"
        );
        drop(conn);
        remove_test_db(&db);
    }

    #[test]
    fn upsert_events_for_source_preserves_insert_or_ignore_counts() {
        let db = temp_db("source_insert_or_ignore_counts");
        remove_test_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("Failed to create storage");

        let first_batch = vec![
            make_event(AgentId::ClaudeCode, 1000, 100, 50, "sess-a"),
            make_event(AgentId::ClaudeCode, 1001, 200, 60, "sess-b"),
        ];
        let inserted = storage
            .upsert_events_for_source(&first_batch, SOURCE_PARSER_FALLBACK, "fallback")
            .expect("first source upsert");
        assert_eq!(inserted, 2);

        let second_batch = vec![
            make_event(AgentId::ClaudeCode, 1000, 100, 50, "sess-a"),
            make_event(AgentId::ClaudeCode, 1002, 300, 70, "sess-c"),
        ];
        let inserted = storage
            .upsert_events_for_source(&second_batch, SOURCE_PARSER_FALLBACK, "fallback")
            .expect("second source upsert");
        assert_eq!(inserted, 1);

        let conn = storage.db.lock().unwrap();
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM token_events WHERE source = ?1 AND source_generation = ?2",
                params![SOURCE_PARSER_FALLBACK, "fallback"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(total, 3);

        drop(conn);
        remove_test_db(&db);
    }

    #[test]
    fn token_import_status_uses_persisted_completion_flag() {
        let db = temp_db("token_import_status");
        remove_test_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("Failed to create storage");

        assert!(
            storage
                .token_import_needs_import()
                .expect("read initial import status"),
            "new storage should require first import"
        );

        storage
            .mark_token_import_completed()
            .expect("mark import completed");

        assert!(
            !storage
                .token_import_needs_import()
                .expect("read completed import status"),
            "completed import flag should skip first import"
        );

        remove_test_db(&db);
    }

    #[test]
    fn delete_all_events_resets_import_completion_but_preserves_active_source() {
        let db = temp_db("delete_resets_import_completion");
        remove_test_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("Failed to create storage");
        let event = make_event(AgentId::ClaudeCode, 1000, 100, 50, "sess-a");

        assert_eq!(storage.upsert_events(&[event]).expect("insert event"), 1);
        storage
            .set_active_source(SOURCE_TOKSCALE_EXPORT)
            .expect("set active source");
        storage
            .mark_token_import_completed()
            .expect("mark import completed");
        assert!(
            !storage
                .token_import_needs_import()
                .expect("completed import status"),
            "completed flag should skip import before delete"
        );

        let deleted = storage.delete_all_events().expect("delete all events");

        assert_eq!(deleted, 1);
        assert_eq!(
            storage
                .count_events_for_source(SOURCE_FELINA_PARSER)
                .expect("felina parser count"),
            0
        );
        assert!(
            storage
                .token_import_needs_import()
                .expect("post-delete import status"),
            "delete_all_events should clear the completed import flag"
        );
        assert_eq!(
            storage.active_source().expect("active source"),
            SOURCE_TOKSCALE_EXPORT,
            "active source should survive event deletion"
        );

        remove_test_db(&db);
    }

    #[test]
    fn source_is_part_of_unique_identity() {
        let db = temp_db("source_unique_identity");
        remove_test_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("Failed to create storage");
        let event = make_event(AgentId::ClaudeCode, 1000, 100, 50, "same-session");

        assert_eq!(storage.upsert_events(&[event.clone()]).expect("legacy"), 1);
        assert_eq!(
            storage
                .replace_tokscale_records(&[(&event, 3)], "tokscale-test")
                .expect("tokscale"),
            1
        );

        assert_eq!(
            storage
                .count_events_for_source(SOURCE_FELINA_PARSER)
                .expect("legacy count"),
            1
        );
        assert_eq!(
            storage
                .count_events_for_source(SOURCE_TOKSCALE_EXPORT)
                .expect("tokscale count"),
            1
        );

        remove_test_db(&db);
    }

    #[test]
    fn storage_migration_normalizes_existing_codex_parser_input_once() {
        let db = temp_db("codex_input_cache_migration");
        remove_test_db(&db);
        {
            let storage = TokenStorage::with_path(db.clone()).expect("create storage");
            let event = make_cached_codex_event(228_220, 227_200, "codex-cached");
            assert_eq!(storage.upsert_events(&[event]).expect("insert"), 1);
            storage
                .db
                .lock()
                .unwrap()
                .execute(
                    "DELETE FROM token_ingestion_state WHERE key = ?1",
                    params![CODEX_INPUT_CACHE_NORMALIZED_KEY],
                )
                .unwrap();
        }

        {
            let storage = TokenStorage::with_path(db.clone()).expect("reopen migration");
            let conn = storage.db.lock().unwrap();
            let (input, cache): (i64, i64) = conn
                .query_row(
                    "SELECT input_tokens, cache_read_tokens FROM token_events WHERE agent = 'codex-cli'",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            assert_eq!(input, 1_020);
            assert_eq!(cache, 227_200);
        }

        {
            let storage = TokenStorage::with_path(db.clone()).expect("reopen no-op");
            let conn = storage.db.lock().unwrap();
            let input: i64 = conn
                .query_row(
                    "SELECT input_tokens FROM token_events WHERE agent = 'codex-cli'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(input, 1_020);
        }

        remove_test_db(&db);
    }
}
