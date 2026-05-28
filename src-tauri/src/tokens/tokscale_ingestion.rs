use std::time::{SystemTime, UNIX_EPOCH};

use crate::tokens::reconciliation::{
    ReconcileOptions, ReconciliationRecord, SourceCollection, SourceStatus,
};
use crate::tokens::storage::{SOURCE_TOKSCALE_EXPORT, TokenStorage};
use crate::tokens::tokscale::{TokscaleAdapter, TokscaleCommandAdapter};
use crate::tokens::types::{AgentId, ScanError, TokenEvent};

pub const STATUS_OK: &str = "ok";
pub const STATUS_MISSING_BINARY: &str = "missing_binary";
pub const STATUS_COMMAND_FAILED: &str = "command_failed";
pub const STATUS_UNSUPPORTED_SCHEMA: &str = "unsupported_schema";
pub const STATUS_PARSE_FAILED: &str = "parse_failed";

#[derive(Clone, Debug)]
pub struct TokscaleIngestionOutput {
    pub events: Vec<TokenEvent>,
    pub event_counts: Vec<u64>,
    pub source_status: String,
    pub message: Option<String>,
    pub generation: String,
}

pub fn ingest_with_default_adapter(
    storage: &TokenStorage,
) -> Result<TokscaleIngestionOutput, String> {
    let bin = std::env::var_os("FELINA_TOKSCALE_BIN").map(std::path::PathBuf::from);
    ingest_with_adapter(storage, &TokscaleCommandAdapter::new(bin))
}

pub fn ingest_with_adapter(
    storage: &TokenStorage,
    adapter: &dyn TokscaleAdapter,
) -> Result<TokscaleIngestionOutput, String> {
    let collection = adapter.collect(&ReconcileOptions {
        include_tokscale: true,
        tokscale_subcommand: Some("graph".to_string()),
        ..Default::default()
    });
    let output = output_from_collection(collection)?;
    let records = output
        .events
        .iter()
        .zip(output.event_counts.iter().copied())
        .collect::<Vec<_>>();
    storage.replace_tokscale_records(&records, &output.generation)?;
    Ok(output)
}

pub fn output_from_collection(
    collection: SourceCollection,
) -> Result<TokscaleIngestionOutput, String> {
    let status = status_string(&collection.status);
    if collection.status != SourceStatus::Ok {
        return Err(status_error(status, collection.message));
    }

    let now = now_epoch();
    let generation = format!("tokscale-{}", now);
    let mut events = Vec::new();
    let mut event_counts = Vec::new();
    for record in collection.records {
        let event_count = record.event_count.max(1);
        events.push(event_from_record(record)?);
        event_counts.push(event_count);
    }

    if events.is_empty() {
        return Err(status_error(
            STATUS_UNSUPPORTED_SCHEMA.to_string(),
            Some("tokscale produced no normalized usage records".to_string()),
        ));
    }

    Ok(TokscaleIngestionOutput {
        events,
        event_counts,
        source_status: STATUS_OK.to_string(),
        message: None,
        generation,
    })
}

pub fn scan_error_from_status(status: &str, message: Option<String>) -> ScanError {
    ScanError {
        agent: AgentId::ClaudeCode,
        source: SOURCE_TOKSCALE_EXPORT.to_string(),
        message: message.unwrap_or_else(|| status.to_string()),
    }
}

fn event_from_record(record: ReconciliationRecord) -> Result<TokenEvent, String> {
    let timestamp = timestamp_from_record(&record).unwrap_or(0);
    let project = record.source_metadata.get("workspace").cloned();
    let session_id = record.session_id.clone();
    Ok(TokenEvent {
        agent: agent_from_str(&record.agent)
            .ok_or_else(|| format!("unsupported tokscale agent: {}", record.agent))?,
        provider: record.provider,
        model: record.model,
        timestamp,
        input_tokens: record.input_tokens,
        output_tokens: record.output_tokens,
        cache_read_tokens: record.cache_read_tokens,
        cache_write_tokens: record.cache_write_tokens,
        reasoning_tokens: record.reasoning_tokens,
        project,
        session_id,
    })
}

fn timestamp_from_record(record: &ReconciliationRecord) -> Option<i64> {
    if record.timestamp_bucket == "all" || record.timestamp_bucket == "unknown" {
        return None;
    }
    parse_date_bucket(&record.timestamp_bucket)
}

fn parse_date_bucket(bucket: &str) -> Option<i64> {
    if bucket.len() < 10 {
        return None;
    }
    crate::tokens::parse_iso8601_to_epoch(&format!("{}T00:00:00Z", &bucket[..10]))
}

fn agent_from_str(agent: &str) -> Option<AgentId> {
    match agent {
        "claude-code" => Some(AgentId::ClaudeCode),
        "codex-cli" => Some(AgentId::CodexCli),
        "gemini-cli" => Some(AgentId::GeminiCli),
        _ => None,
    }
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn status_string(status: &SourceStatus) -> String {
    match status {
        SourceStatus::Ok => STATUS_OK,
        SourceStatus::MissingBinary => STATUS_MISSING_BINARY,
        SourceStatus::CommandFailed => STATUS_COMMAND_FAILED,
        SourceStatus::UnsupportedSchema => STATUS_UNSUPPORTED_SCHEMA,
        SourceStatus::ParseFailed => STATUS_PARSE_FAILED,
        SourceStatus::StorageUnavailable => "storage_unavailable",
    }
    .to_string()
}

fn status_error(status: String, message: Option<String>) -> String {
    match message {
        Some(message) if !message.is_empty() => format!("{}: {}", status, message),
        _ => status,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::reconciliation::{SourceCollection, TokenSource};
    use crate::tokens::storage::TokenStorage;
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    fn temp_db(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("glyphic_tokscale_ingestion_{}.db", name))
    }

    fn cleanup_db(path: &PathBuf) {
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
    }

    fn record(agent: &str, model: &str, total: u64, count: u64) -> ReconciliationRecord {
        ReconciliationRecord {
            source: TokenSource::TokscaleExport,
            agent: agent.to_string(),
            provider: if agent == "codex-cli" {
                "openai"
            } else {
                "anthropic"
            }
            .to_string(),
            model: model.to_string(),
            timestamp_bucket: "all".to_string(),
            session_id: None,
            input_tokens: total,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            event_count: count,
            source_metadata: BTreeMap::from([("client".to_string(), agent.to_string())]),
        }
    }

    #[test]
    fn stores_tokscale_records_as_active_source_without_legacy_mix() {
        let db = temp_db("active_source");
        cleanup_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("storage");
        storage
            .upsert_events(&[TokenEvent {
                agent: AgentId::ClaudeCode,
                provider: "anthropic".into(),
                model: "legacy".into(),
                timestamp: 1,
                input_tokens: 2_076_337_915,
                output_tokens: 0,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: 0,
                project: None,
                session_id: Some("legacy".into()),
            }])
            .expect("legacy insert");

        let collection = SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::Ok,
            message: None,
            version: None,
            records: vec![record(
                "claude-code",
                "claude-sonnet-4-6",
                1_161_157_714,
                12_459,
            )],
        };
        ingest_with_adapter(&storage, &StaticAdapter(collection)).expect("ingest");

        assert_eq!(storage.active_source().unwrap(), SOURCE_TOKSCALE_EXPORT);
        assert_eq!(
            storage
                .count_events_for_source(SOURCE_TOKSCALE_EXPORT)
                .unwrap(),
            1
        );
        assert_eq!(
            storage
                .count_events_for_source(crate::tokens::storage::SOURCE_FELINA_PARSER)
                .unwrap(),
            1
        );
        cleanup_db(&db);
    }

    #[test]
    fn aggregate_tokscale_records_do_not_fabricate_session_ids() {
        let output = output_from_collection(SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::Ok,
            message: None,
            version: None,
            records: vec![record(
                "claude-code",
                "claude-sonnet-4-6",
                1_161_157_714,
                12_459,
            )],
        })
        .expect("output");

        assert_eq!(output.events.len(), 1);
        assert!(output.events[0].session_id.is_none());
    }

    #[test]
    fn failed_tokscale_collection_does_not_change_active_source() {
        let db = temp_db("failed_collection");
        cleanup_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("storage");
        let err = ingest_with_adapter(
            &storage,
            &StaticAdapter(SourceCollection {
                source: TokenSource::TokscaleExport,
                status: SourceStatus::MissingBinary,
                message: Some("tokscale not found".into()),
                version: None,
                records: Vec::new(),
            }),
        )
        .expect_err("missing binary should fail");

        assert!(err.contains(STATUS_MISSING_BINARY));
        assert_eq!(
            storage.active_source().unwrap(),
            crate::tokens::storage::SOURCE_FELINA_PARSER
        );
        cleanup_db(&db);
    }

    #[test]
    fn distinct_collection_failures_map_to_distinct_refresh_statuses() {
        let cases = [
            (SourceStatus::MissingBinary, STATUS_MISSING_BINARY),
            (SourceStatus::CommandFailed, STATUS_COMMAND_FAILED),
            (SourceStatus::UnsupportedSchema, STATUS_UNSUPPORTED_SCHEMA),
            (SourceStatus::ParseFailed, STATUS_PARSE_FAILED),
        ];

        for (status, expected) in cases {
            let err = output_from_collection(SourceCollection {
                source: TokenSource::TokscaleExport,
                status,
                message: Some("failure".into()),
                version: None,
                records: Vec::new(),
            })
            .expect_err("failure status should not produce output");

            assert!(
                err.starts_with(expected),
                "expected {} from error {}",
                expected,
                err
            );
        }
    }

    #[test]
    fn all_scope_records_do_not_fabricate_refresh_timestamp() {
        let output = output_from_collection(SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::Ok,
            message: None,
            version: None,
            records: vec![record("claude-code", "claude-sonnet-4-6", 42, 2)],
        })
        .expect("output");

        assert_eq!(output.events[0].timestamp, 0);
    }

    #[test]
    fn dated_records_store_real_bucket_timestamp() {
        let mut dated = record("codex-cli", "gpt-5", 42, 2);
        dated.timestamp_bucket = "2026-01-27".into();

        let output = output_from_collection(SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::Ok,
            message: None,
            version: None,
            records: vec![dated],
        })
        .expect("output");

        assert_eq!(output.events[0].timestamp, 1_769_472_000);
    }

    struct StaticAdapter(SourceCollection);

    impl TokscaleAdapter for StaticAdapter {
        fn collect(&self, _options: &ReconcileOptions) -> SourceCollection {
            self.0.clone()
        }
    }
}
