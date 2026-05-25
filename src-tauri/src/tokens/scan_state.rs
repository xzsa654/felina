use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::tokens::types::AgentId;

/// A cursor recording the scan progress for one agent+source_path pair.
#[derive(Clone, Debug, PartialEq)]
pub struct ScanCursor {
    pub agent: AgentId,
    pub source_path: String,
    /// Last successfully processed file modification timestamp (Unix epoch seconds).
    pub last_mtime: i64,
    /// Timestamp of the last successful scan (Unix epoch seconds).
    pub last_scan_ts: i64,
    /// Summary of the last error, if any.
    pub last_error: Option<String>,
}

/// Persistent scan state store backed by the same `tokens.db`.
pub struct ScanState {
    db: Mutex<Connection>,
}

impl ScanState {
    /// Open or create the scan_state table in the shared tokens.db.
    pub fn new() -> Result<Self, String> {
        Self::with_path(Self::db_path())
    }

    /// Open scan_state at an explicit database path (for testing).
    pub fn with_path(db_path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create directory: {}", e))?;
        }

        if let Some(state) = Self::try_init(&db_path)? {
            return Ok(state);
        }
        // Corruption detected — delete file and WAL/SHM sidecars, retry once.
        // Losing cursors is acceptable: the next refresh performs a full scan.
        Self::remove_db_files(&db_path);
        Self::try_init(&db_path)?
            .ok_or_else(|| "Cannot recover scan state db after recreate".to_string())
    }

    /// Open the database, create the schema, and verify the table is readable.
    ///
    /// SQLite corruption can surface at two points:
    /// - SQLITE_NOTADB (26): when setting `PRAGMA journal_mode=WAL`
    /// - SQLITE_CORRUPT (11): when reading the scan_state data pages, even if
    ///   sqlite_master itself appears intact
    ///
    /// Returns `Ok(None)` on either form of corruption so the caller can
    /// delete the file and retry.
    fn try_init(db_path: &PathBuf) -> Result<Option<Self>, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Cannot open db for scan state: {}", e))?;

        if let Err(e) = conn.execute_batch("PRAGMA journal_mode=WAL;") {
            if Self::is_corrupt_error(&e) {
                return Ok(None);
            }
            return Err(format!("Cannot set WAL mode: {}", e));
        }

        if let Err(e) = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS scan_state (
                agent TEXT NOT NULL,
                source_path TEXT NOT NULL,
                last_mtime INTEGER NOT NULL DEFAULT 0,
                last_scan_ts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                PRIMARY KEY (agent, source_path)
            );",
        ) {
            if Self::is_corrupt_error(&e) {
                return Ok(None);
            }
            return Err(format!("Cannot create scan_state table: {}", e));
        }

        // Read the scan_state table to confirm its data pages are healthy.
        // sqlite_master can be intact while the table's own pages are damaged.
        if let Err(e) = conn.query_row("SELECT count(*) FROM scan_state", [], |_| Ok(())) {
            if Self::is_corrupt_error(&e) {
                return Ok(None);
            }
            return Err(format!("Scan state table unreadable: {}", e));
        }

        Ok(Some(ScanState {
            db: Mutex::new(conn),
        }))
    }

    fn is_corrupt_error(e: &rusqlite::Error) -> bool {
        let msg = e.to_string().to_lowercase();
        msg.contains("not a database") || msg.contains("malformed") || msg.contains("i/o error")
    }

    fn remove_db_files(db_path: &PathBuf) {
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    }

    fn db_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".felina")
            .join("tokens.db")
    }

    /// Read the cursor for a specific agent and source path.
    /// Returns Ok(None) when no cursor exists yet for this agent+source.
    /// Returns Err when a storage/lock/query error occurs.
    pub fn get_cursor(
        &self,
        agent: &AgentId,
        source_path: &str,
    ) -> Result<Option<ScanCursor>, String> {
        let conn = self
            .db
            .lock()
            .map_err(|e| format!("Lock error in get_cursor: {}", e))?;
        let result: Result<ScanCursor, rusqlite::Error> = conn.query_row(
            "SELECT agent, source_path, last_mtime, last_scan_ts, last_error
             FROM scan_state WHERE agent = ?1 AND source_path = ?2",
            params![agent.to_string(), source_path],
            |row| {
                Ok(ScanCursor {
                    agent: {
                        let s: String = row.get(0)?;
                        match s.as_str() {
                            "codex-cli" => AgentId::CodexCli,
                            "gemini-cli" => AgentId::GeminiCli,
                            _ => AgentId::ClaudeCode,
                        }
                    },
                    source_path: row.get(1)?,
                    last_mtime: row.get(2)?,
                    last_scan_ts: row.get(3)?,
                    last_error: row.get(4)?,
                })
            },
        );
        match result {
            Ok(cursor) => Ok(Some(cursor)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Query error in get_cursor: {}", e)),
        }
    }

    /// Upsert a successful scan cursor for an agent and source path.
    pub fn upsert_cursor(
        &self,
        agent: &AgentId,
        source_path: &str,
        mtime: i64,
        scan_ts: i64,
    ) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO scan_state (agent, source_path, last_mtime, last_scan_ts)
             VALUES (?1, ?2, ?3, ?4)",
            params![agent.to_string(), source_path, mtime, scan_ts],
        )
        .map_err(|e| format!("Cursor upsert error: {}", e))?;
        Ok(())
    }

    /// Record an error summary for an agent and source path without advancing the cursor.
    pub fn upsert_error(
        &self,
        agent: &AgentId,
        source_path: &str,
        error: &str,
    ) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO scan_state (agent, source_path, last_mtime, last_scan_ts, last_error)
             VALUES (?1, ?2, COALESCE((SELECT last_mtime FROM scan_state WHERE agent=?1 AND source_path=?2), 0), COALESCE((SELECT last_scan_ts FROM scan_state WHERE agent=?1 AND source_path=?2), 0), ?3)",
            params![agent.to_string(), source_path, error],
        )
        .map_err(|e| format!("Error upsert error: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    /// Return a per-test temp DB path that will never collide with the real
    /// ~/.felina/tokens.db or with other tests running in parallel.
    fn temp_db(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("glyphic_scan_state_{}.db", name))
    }

    /// Remove a SQLite DB file and its WAL/SHM sidecar files.
    fn cleanup_db(path: &PathBuf) {
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn test_scan_state_table_is_created() {
        let db = temp_db("table_created");
        cleanup_db(&db);
        let state = ScanState::with_path(db.clone()).expect("Failed to create test scan state");

        let conn = state.db.lock().unwrap();
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='scan_state'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(table_exists, "scan_state table should exist");
        drop(conn);
        cleanup_db(&db);
    }

    #[test]
    fn test_existing_token_events_schema_stays_readable() {
        use rusqlite::Connection;

        let db = temp_db("schema_readable");
        cleanup_db(&db);

        // Create a db with the existing token_events schema first
        {
            let conn = Connection::open(&db).unwrap();
            conn.execute_batch("PRAGMA journal_mode=WAL;").unwrap();
            conn.execute_batch(
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
                    UNIQUE(agent, session_id, timestamp, model)
                );",
            )
            .unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO token_events
                    (agent, provider, model, timestamp, input_tokens, output_tokens,
                     cache_read_tokens, cache_write_tokens, reasoning_tokens, project, session_id)
                 VALUES ('claude-code', 'anthropic', 'claude-sonnet-4-6', 1, 100, 50, 0, 0, 0, NULL, 'sess-1')",
                [],
            )
            .unwrap();
            // Connection is dropped here, closing the database
        }

        // Now open ScanState (which creates scan_state table on the same db)
        let state = ScanState::with_path(db.clone()).expect("Failed to create scan state");

        // Verify token_events is still readable
        let conn = state.db.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM token_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "token_events should still have one row");

        let agent: String = conn
            .query_row("SELECT agent FROM token_events LIMIT 1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(agent, "claude-code");

        // Verify scan_state table also exists
        let scan_table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='scan_state'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(scan_table_exists);
        drop(conn);
        cleanup_db(&db);
    }

    #[test]
    fn test_cursor_survives_app_restart() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let agent = AgentId::ClaudeCode;
        let source = "/home/user/.claude/projects/test";
        let mtime: i64 = 1716400000;
        let scan_ts: i64 = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let db = temp_db("cursor_restart");
        cleanup_db(&db);

        // First "run" of the app: write a cursor
        {
            let state = ScanState::with_path(db.clone()).expect("First open");
            state
                .upsert_cursor(&agent, source, mtime, scan_ts)
                .expect("Write cursor");
            // State is dropped here, simulating app shutdown
        }

        // "Restart": open a new ScanState and read back
        let state = ScanState::with_path(db.clone()).expect("Second open (after restart)");
        let cursor = state
            .get_cursor(&agent, source)
            .expect("get_cursor should succeed");
        assert!(cursor.is_some(), "Cursor should survive restart");
        let cursor = cursor.unwrap();
        assert_eq!(cursor.agent, agent);
        assert_eq!(cursor.source_path, source);
        assert_eq!(cursor.last_mtime, mtime);
        assert_eq!(cursor.last_scan_ts, scan_ts);
        cleanup_db(&db);
    }

    #[test]
    fn test_get_cursor_returns_err_on_broken_storage() {
        let agent = AgentId::ClaudeCode;
        let source = "/test/path";

        let db = temp_db("get_cursor_broken");
        cleanup_db(&db);
        let state = ScanState::with_path(db.clone()).expect("Create scan state");
        // Drop the table to simulate storage corruption
        {
            let conn = state.db.lock().unwrap();
            conn.execute_batch("DROP TABLE scan_state;").unwrap();
        }
        // Now get_cursor should return Err, not Ok(None)
        let result = state.get_cursor(&agent, source);
        assert!(
            result.is_err(),
            "get_cursor should return Err when table is missing"
        );
        assert!(
            result.unwrap_err().contains("Query error"),
            "Error should indicate a query failure"
        );
        cleanup_db(&db);
    }

    #[test]
    fn test_upsert_cursor_returns_err_on_broken_storage() {
        let agent = AgentId::ClaudeCode;
        let source = "/test/path";

        let db = temp_db("upsert_cursor_broken");
        cleanup_db(&db);
        let state = ScanState::with_path(db.clone()).expect("Create scan state");
        // Drop the table to simulate storage corruption
        {
            let conn = state.db.lock().unwrap();
            conn.execute_batch("DROP TABLE scan_state;").unwrap();
        }
        let result = state.upsert_cursor(&agent, source, 1000, 2000);
        assert!(
            result.is_err(),
            "upsert_cursor should return Err when table is missing"
        );
        cleanup_db(&db);
    }

    #[test]
    fn test_upsert_error_returns_err_on_broken_storage() {
        let agent = AgentId::ClaudeCode;
        let source = "/test/path";

        let db = temp_db("upsert_error_broken");
        cleanup_db(&db);
        let state = ScanState::with_path(db.clone()).expect("Create scan state");
        // Drop the table to simulate storage corruption
        {
            let conn = state.db.lock().unwrap();
            conn.execute_batch("DROP TABLE scan_state;").unwrap();
        }
        let result = state.upsert_error(&agent, source, "test error");
        assert!(
            result.is_err(),
            "upsert_error should return Err when table is missing"
        );
        cleanup_db(&db);
    }
}
