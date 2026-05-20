use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::tokens::types::{AgentId, TokenEvent};

/// SQLite-backed cache for token events at `~/.glyphic/tokens.db`.
pub struct TokenStorage {
    db: Mutex<Connection>,
}

impl TokenStorage {
    /// Open or create the database at ~/.glyphic/tokens.db.
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create ~/.glyphic: {}", e))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Cannot open tokens.db: {}", e))?;

        // Enable WAL mode for concurrent reads
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Cannot set WAL mode: {}", e))?;

        // Create schema
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
            );
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON token_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_agent ON token_events(agent);
            CREATE INDEX IF NOT EXISTS idx_events_model ON token_events(model);",
        )
        .map_err(|e| format!("Cannot create schema: {}", e))?;

        Ok(TokenStorage {
            db: Mutex::new(conn),
        })
    }

    fn db_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".glyphic")
            .join("tokens.db")
    }

    /// Upsert token events (INSERT OR IGNORE on unique constraint).
    pub fn upsert_events(&self, events: &[TokenEvent]) -> Result<u64, String> {
        let conn = self.db.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut inserted = 0u64;

        for event in events {
            let result = conn.execute(
                "INSERT OR IGNORE INTO token_events
                    (agent, provider, model, timestamp, input_tokens, output_tokens,
                     cache_read_tokens, cache_write_tokens, reasoning_tokens,
                     project, session_id, cost_usd)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0.0)",
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
                ],
            );
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

        Ok(inserted)
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

    /// Raw connection access for the aggregator (caller must handle locking).
    pub fn connection(&self) -> &Mutex<Connection> {
        &self.db
    }
}
