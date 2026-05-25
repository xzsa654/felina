use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::tokens::parsers::claude_code::ClaudeCodeParser;
use crate::tokens::parsers::codex_cli::CodexCliParser;
use crate::tokens::parsers::gemini_cli::GeminiCliParser;
use crate::tokens::parsers::{AgentParser, ParserRegistry};
use crate::tokens::tokscale::{TokscaleAdapter, TokscaleCommandAdapter};
use crate::tokens::types::TokenEvent;

#[derive(Clone, Debug, Default)]
pub struct ReconcileOptions {
    pub date_start: Option<i64>,
    pub date_end: Option<i64>,
    pub filter_agent: Option<String>,
    pub filter_model: Option<String>,
    pub include_tokscale: bool,
    pub tokscale_bin: Option<PathBuf>,
    pub db_path: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SourceStatus {
    Ok,
    MissingBinary,
    CommandFailed,
    UnsupportedSchema,
    ParseFailed,
    StorageUnavailable,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum TokenSource {
    FelinaDb,
    FelinaRescan,
    TokscaleExport,
}

impl TokenSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            TokenSource::FelinaDb => "felina_db",
            TokenSource::FelinaRescan => "felina_rescan",
            TokenSource::TokscaleExport => "tokscale_export",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceCollection {
    pub source: TokenSource,
    pub status: SourceStatus,
    pub message: Option<String>,
    pub version: Option<String>,
    pub records: Vec<ReconciliationRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenTotals {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub event_count: u64,
}

impl TokenTotals {
    pub fn zero() -> Self {
        Self {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            event_count: 0,
        }
    }

    pub fn total_tokens(&self) -> u64 {
        self.input_tokens
            + self.output_tokens
            + self.cache_read_tokens
            + self.cache_write_tokens
            + self.reasoning_tokens
    }

    pub fn add_event(&mut self, event: &TokenEvent) {
        self.input_tokens += event.input_tokens;
        self.output_tokens += event.output_tokens;
        self.cache_read_tokens += event.cache_read_tokens;
        self.cache_write_tokens += event.cache_write_tokens;
        self.reasoning_tokens += event.reasoning_tokens;
        self.event_count += 1;
    }

    pub fn add_record(&mut self, record: &ReconciliationRecord) {
        self.input_tokens += record.input_tokens;
        self.output_tokens += record.output_tokens;
        self.cache_read_tokens += record.cache_read_tokens;
        self.cache_write_tokens += record.cache_write_tokens;
        self.reasoning_tokens += record.reasoning_tokens;
        self.event_count += record.event_count;
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReconciliationRecord {
    pub source: TokenSource,
    pub agent: String,
    pub provider: String,
    pub model: String,
    pub timestamp_bucket: String,
    pub session_id: Option<String>,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub event_count: u64,
    pub source_metadata: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Scope {
    pub date_start: Option<i64>,
    pub date_end: Option<i64>,
    pub filter_agent: Option<String>,
    pub filter_model: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReconciliationReport {
    pub command: String,
    pub scope: Scope,
    pub source_statuses: Vec<SourceSummary>,
    pub totals_by_source: Vec<AggregateRow>,
    pub per_agent: Vec<AggregateRow>,
    pub per_model: Vec<AggregateRow>,
    pub per_provider: Vec<AggregateRow>,
    pub per_day: Vec<AggregateRow>,
    pub session_mismatches: Vec<MismatchRow>,
    pub classifications: Vec<ClassificationSummary>,
    pub tokscale_readiness: TokscaleReadiness,
    pub recommendation: Recommendation,
    pub human_summary: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceSummary {
    pub source: TokenSource,
    pub status: SourceStatus,
    pub message: Option<String>,
    pub version: Option<String>,
    pub record_count: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AggregateRow {
    pub dimension: String,
    pub key: String,
    pub source: TokenSource,
    pub totals: TokenTotals,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MismatchRow {
    pub dimension: String,
    pub key: String,
    pub baseline_source: TokenSource,
    pub comparison_source: TokenSource,
    pub baseline_total_tokens: u64,
    pub comparison_total_tokens: u64,
    pub token_delta: i128,
    pub classifications: Vec<MismatchClassification>,
    pub metadata: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum MismatchClassification {
    CumulativeAsIncrementalCandidate,
    TruncatedJsonlCandidate,
    OverlappingSourceDirectoryCandidate,
    MissingTimestampCandidate,
    CacheTokenMappingMismatch,
    ReasoningTokenMappingMismatch,
    StorageDuplicateBehavior,
    PricingOnlyMismatch,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ClassificationSummary {
    pub classification: MismatchClassification,
    pub count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TokscaleReadinessStatus {
    ReadyForMigrationProposal,
    Blocked,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TokscaleReadiness {
    pub status: TokscaleReadinessStatus,
    pub reasons: Vec<String>,
    pub field_mappings: Vec<String>,
    pub version: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Recommendation {
    KeepFelinaParser,
    PatchFelinaParser,
    ProposeTokscaleBackedIngestion,
    DeferPendingEvidence,
}

impl Recommendation {
    pub fn as_str(&self) -> &'static str {
        match self {
            Recommendation::KeepFelinaParser => "keep_felina_parser",
            Recommendation::PatchFelinaParser => "patch_felina_parser",
            Recommendation::ProposeTokscaleBackedIngestion => "propose_tokscale_backed_ingestion",
            Recommendation::DeferPendingEvidence => "defer_pending_evidence",
        }
    }
}

pub fn reconcile(options: ReconcileOptions) -> ReconciliationReport {
    reconcile_with_adapter(
        &options,
        &TokscaleCommandAdapter::new(options.tokscale_bin.clone()),
    )
}

pub fn reconcile_with_adapter(
    options: &ReconcileOptions,
    tokscale: &dyn TokscaleAdapter,
) -> ReconciliationReport {
    let mut collections = vec![collect_felina_db(options), collect_felina_rescan(options)];

    if options.include_tokscale {
        collections.push(tokscale.collect(options));
    } else {
        collections.push(SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::MissingBinary,
            message: Some("tokscale comparison disabled".to_string()),
            version: None,
            records: Vec::new(),
        });
    }

    build_report(options, collections)
}

fn collect_felina_db(options: &ReconcileOptions) -> SourceCollection {
    let db_path = options
        .db_path
        .clone()
        .unwrap_or_else(default_token_db_path);
    let conn = match open_readonly_connection(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            return SourceCollection {
                source: TokenSource::FelinaDb,
                status: SourceStatus::StorageUnavailable,
                message: Some(format!(
                    "cannot open {} read-only: {}",
                    db_path.display(),
                    e
                )),
                version: None,
                records: Vec::new(),
            };
        }
    };

    let mut where_parts = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(start) = options.date_start {
        where_parts.push(format!("timestamp >= ?{}", values.len() + 1));
        values.push(Box::new(start));
    }
    if let Some(end) = options.date_end {
        where_parts.push(format!("timestamp <= ?{}", values.len() + 1));
        values.push(Box::new(end));
    }
    if let Some(agent) = &options.filter_agent {
        where_parts.push(format!("agent = ?{}", values.len() + 1));
        values.push(Box::new(agent.clone()));
    }
    if let Some(model) = &options.filter_model {
        where_parts.push(format!("model = ?{}", values.len() + 1));
        values.push(Box::new(model.clone()));
    }

    let where_clause = if where_parts.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_parts.join(" AND "))
    };
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    let sql = format!(
        "SELECT agent, provider, model, strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch')) AS day,
                session_id,
                COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0),
                COALESCE(SUM(reasoning_tokens),0), COUNT(*),
                MIN(timestamp), MAX(timestamp)
         FROM token_events {}
         GROUP BY agent, provider, model, day, session_id",
        where_clause
    );

    let mut stmt = match conn.prepare(&sql) {
        Ok(stmt) => stmt,
        Err(e) => {
            return SourceCollection {
                source: TokenSource::FelinaDb,
                status: SourceStatus::ParseFailed,
                message: Some(format!("cannot query token_events: {}", e)),
                version: None,
                records: Vec::new(),
            };
        }
    };

    let rows = match stmt.query_map(params.as_slice(), |row| {
        let mut metadata = BTreeMap::new();
        let min_ts: i64 = row.get(11)?;
        let max_ts: i64 = row.get(12)?;
        metadata.insert("min_timestamp".to_string(), min_ts.to_string());
        metadata.insert("max_timestamp".to_string(), max_ts.to_string());
        Ok(ReconciliationRecord {
            source: TokenSource::FelinaDb,
            agent: row.get(0)?,
            provider: row.get(1)?,
            model: row.get(2)?,
            timestamp_bucket: row
                .get::<_, Option<String>>(3)?
                .unwrap_or_else(|| "unknown".to_string()),
            session_id: row.get(4)?,
            input_tokens: row.get::<_, i64>(5)? as u64,
            output_tokens: row.get::<_, i64>(6)? as u64,
            cache_read_tokens: row.get::<_, i64>(7)? as u64,
            cache_write_tokens: row.get::<_, i64>(8)? as u64,
            reasoning_tokens: row.get::<_, i64>(9)? as u64,
            event_count: row.get::<_, i64>(10)? as u64,
            source_metadata: metadata,
        })
    }) {
        Ok(rows) => rows,
        Err(e) => {
            return SourceCollection {
                source: TokenSource::FelinaDb,
                status: SourceStatus::ParseFailed,
                message: Some(format!("cannot map token_events rows: {}", e)),
                version: None,
                records: Vec::new(),
            };
        }
    };

    SourceCollection {
        source: TokenSource::FelinaDb,
        status: SourceStatus::Ok,
        message: None,
        version: sqlite_version(&conn),
        records: rows.filter_map(|r| r.ok()).collect(),
    }
}

fn collect_felina_rescan(options: &ReconcileOptions) -> SourceCollection {
    let registry = default_registry();
    let mut records = Vec::new();
    let mut errors = Vec::new();

    for parser in registry.available_parsers() {
        let agent = parser.agent_id().to_string();
        if options
            .filter_agent
            .as_ref()
            .map(|filter| filter != &agent)
            .unwrap_or(false)
        {
            continue;
        }

        for path in matching_parser_files(parser) {
            match parser.parse_file(&path) {
                Ok(events) => {
                    for event in events {
                        if !event_in_scope(&event, options) {
                            continue;
                        }
                        records.push(record_from_event(
                            TokenSource::FelinaRescan,
                            &event,
                            BTreeMap::from([(
                                "source_path".to_string(),
                                path.to_string_lossy().to_string(),
                            )]),
                        ));
                    }
                }
                Err(err) => errors.push(format!("{}: {}", path.display(), err)),
            }
        }
    }

    let status = if errors.is_empty() {
        SourceStatus::Ok
    } else if records.is_empty() {
        SourceStatus::ParseFailed
    } else {
        SourceStatus::Ok
    };
    let message = if errors.is_empty() {
        None
    } else {
        Some(errors.into_iter().take(5).collect::<Vec<_>>().join("; "))
    };

    SourceCollection {
        source: TokenSource::FelinaRescan,
        status,
        message,
        version: None,
        records: aggregate_records(records),
    }
}

pub fn record_from_event(
    source: TokenSource,
    event: &TokenEvent,
    source_metadata: BTreeMap<String, String>,
) -> ReconciliationRecord {
    ReconciliationRecord {
        source,
        agent: event.agent.to_string(),
        provider: event.provider.clone(),
        model: event.model.clone(),
        timestamp_bucket: day_bucket(event.timestamp),
        session_id: event.session_id.clone(),
        input_tokens: event.input_tokens,
        output_tokens: event.output_tokens,
        cache_read_tokens: event.cache_read_tokens,
        cache_write_tokens: event.cache_write_tokens,
        reasoning_tokens: event.reasoning_tokens,
        event_count: 1,
        source_metadata,
    }
}

pub fn aggregate_records(records: Vec<ReconciliationRecord>) -> Vec<ReconciliationRecord> {
    let mut grouped: BTreeMap<
        (TokenSource, String, String, String, String, Option<String>),
        ReconciliationRecord,
    > = BTreeMap::new();
    for record in records {
        let key = (
            record.source.clone(),
            record.agent.clone(),
            record.provider.clone(),
            record.model.clone(),
            record.timestamp_bucket.clone(),
            record.session_id.clone(),
        );
        grouped
            .entry(key)
            .and_modify(|existing| {
                existing.input_tokens += record.input_tokens;
                existing.output_tokens += record.output_tokens;
                existing.cache_read_tokens += record.cache_read_tokens;
                existing.cache_write_tokens += record.cache_write_tokens;
                existing.reasoning_tokens += record.reasoning_tokens;
                existing.event_count += record.event_count;
                for (k, v) in &record.source_metadata {
                    existing
                        .source_metadata
                        .entry(k.clone())
                        .or_insert_with(|| v.clone());
                }
            })
            .or_insert(record);
    }
    grouped.into_values().collect()
}

fn build_report(
    options: &ReconcileOptions,
    collections: Vec<SourceCollection>,
) -> ReconciliationReport {
    let source_statuses = collections
        .iter()
        .map(|c| SourceSummary {
            source: c.source.clone(),
            status: c.status.clone(),
            message: c.message.clone(),
            version: c.version.clone(),
            record_count: c.records.len(),
        })
        .collect::<Vec<_>>();
    let all_records = collections
        .iter()
        .flat_map(|c| c.records.clone())
        .collect::<Vec<_>>();
    let totals_by_source = aggregate_dimension(&all_records, "total", |_r| "all".to_string());
    let per_agent = aggregate_dimension(&all_records, "agent", |r| r.agent.clone());
    let per_model = aggregate_dimension(&all_records, "model", |r| {
        format!("{}|{}|{}", r.agent, r.provider, r.model)
    });
    let per_provider = aggregate_dimension(&all_records, "provider", |r| {
        format!("{}|{}", r.agent, r.provider)
    });
    let per_day = aggregate_dimension(&all_records, "day", |r| r.timestamp_bucket.clone());
    let session_rows = aggregate_dimension(&all_records, "session", |r| {
        format!(
            "{}|{}|{}|{}",
            r.agent,
            r.model,
            r.timestamp_bucket,
            r.session_id
                .clone()
                .unwrap_or_else(|| "unknown".to_string())
        )
    });

    let mut mismatches = mismatch_rows(&per_agent, "agent");
    mismatches.extend(mismatch_rows(&per_model, "model"));
    mismatches.extend(mismatch_rows(&session_rows, "session"));
    mismatches.sort_by(|a, b| b.token_delta.abs().cmp(&a.token_delta.abs()));
    mismatches.truncate(50);

    let classifications = summarize_classifications(&mismatches);
    let tokscale_readiness = evaluate_tokscale_readiness(&source_statuses, &all_records);
    let recommendation = recommend(&tokscale_readiness, &mismatches);
    let human_summary = render_human_summary(
        options,
        &source_statuses,
        &totals_by_source,
        &mismatches,
        &tokscale_readiness,
        &recommendation,
    );

    ReconciliationReport {
        command: "glyphic_token_reconcile".to_string(),
        scope: Scope {
            date_start: options.date_start,
            date_end: options.date_end,
            filter_agent: options.filter_agent.clone(),
            filter_model: options.filter_model.clone(),
        },
        source_statuses,
        totals_by_source,
        per_agent,
        per_model,
        per_provider,
        per_day,
        session_mismatches: mismatches,
        classifications,
        tokscale_readiness,
        recommendation,
        human_summary,
    }
}

fn aggregate_dimension<F>(
    records: &[ReconciliationRecord],
    dimension: &str,
    key_fn: F,
) -> Vec<AggregateRow>
where
    F: Fn(&ReconciliationRecord) -> String,
{
    let mut map: BTreeMap<(String, TokenSource), TokenTotals> = BTreeMap::new();
    for record in records {
        map.entry((key_fn(record), record.source.clone()))
            .or_insert_with(TokenTotals::zero)
            .add_record(record);
    }
    map.into_iter()
        .map(|((key, source), totals)| AggregateRow {
            dimension: dimension.to_string(),
            key,
            source,
            totals,
        })
        .collect()
}

fn mismatch_rows(rows: &[AggregateRow], dimension: &str) -> Vec<MismatchRow> {
    let mut by_key: BTreeMap<String, Vec<&AggregateRow>> = BTreeMap::new();
    for row in rows {
        by_key.entry(row.key.clone()).or_default().push(row);
    }

    let mut out = Vec::new();
    for (key, keyed_rows) in by_key {
        let baseline = keyed_rows
            .iter()
            .find(|r| r.source == TokenSource::TokscaleExport)
            .or_else(|| {
                keyed_rows
                    .iter()
                    .find(|r| r.source == TokenSource::FelinaDb)
            });
        let synthetic_baseline;
        let baseline = match baseline {
            Some(baseline) => *baseline,
            None => {
                let Some(comparison) = keyed_rows.first() else {
                    continue;
                };
                synthetic_baseline = AggregateRow {
                    dimension: dimension.to_string(),
                    key: key.clone(),
                    source: TokenSource::FelinaDb,
                    totals: TokenTotals::zero(),
                };
                out.push(build_mismatch_row(
                    &key,
                    dimension,
                    &synthetic_baseline,
                    comparison,
                ));
                continue;
            }
        };
        for comparison in keyed_rows.iter() {
            if comparison.source == baseline.source {
                continue;
            }
            let baseline_total = baseline.totals.total_tokens();
            let comparison_total = comparison.totals.total_tokens();
            if baseline_total == comparison_total {
                continue;
            }
            out.push(build_mismatch_row(&key, dimension, baseline, comparison));
        }
    }
    out
}

fn build_mismatch_row(
    key: &str,
    dimension: &str,
    baseline: &AggregateRow,
    comparison: &AggregateRow,
) -> MismatchRow {
    let mut metadata = BTreeMap::new();
    metadata.insert("key".to_string(), key.to_string());
    metadata.insert("dimension".to_string(), dimension.to_string());
    MismatchRow {
        dimension: dimension.to_string(),
        key: key.to_string(),
        baseline_source: baseline.source.clone(),
        comparison_source: comparison.source.clone(),
        baseline_total_tokens: baseline.totals.total_tokens(),
        comparison_total_tokens: comparison.totals.total_tokens(),
        token_delta: comparison.totals.total_tokens() as i128
            - baseline.totals.total_tokens() as i128,
        classifications: classify_mismatch(baseline, comparison),
        metadata,
    }
}

pub fn classify_mismatch(
    baseline: &AggregateRow,
    comparison: &AggregateRow,
) -> Vec<MismatchClassification> {
    let mut classes = BTreeMap::new();
    let key = comparison.key.to_lowercase();
    let delta = comparison.totals.total_tokens() as i128 - baseline.totals.total_tokens() as i128;
    if comparison.source == TokenSource::FelinaRescan
        && baseline.source == TokenSource::TokscaleExport
        && comparison.totals.event_count > baseline.totals.event_count.saturating_mul(2)
        && delta > 0
    {
        classes.insert(MismatchClassification::CumulativeAsIncrementalCandidate, ());
    }
    if comparison.source == TokenSource::FelinaRescan
        && comparison.totals.event_count >= 500
        && key.contains("codex")
    {
        classes.insert(MismatchClassification::TruncatedJsonlCandidate, ());
    }
    if key.contains("claude") && comparison.source == TokenSource::FelinaRescan && delta.abs() > 0 {
        classes.insert(
            MismatchClassification::OverlappingSourceDirectoryCandidate,
            (),
        );
    }
    if key.contains("1970-01-01") || key.contains("unknown") {
        classes.insert(MismatchClassification::MissingTimestampCandidate, ());
    }
    if baseline.totals.cache_read_tokens != comparison.totals.cache_read_tokens
        || baseline.totals.cache_write_tokens != comparison.totals.cache_write_tokens
    {
        classes.insert(MismatchClassification::CacheTokenMappingMismatch, ());
    }
    if baseline.totals.reasoning_tokens != comparison.totals.reasoning_tokens {
        classes.insert(MismatchClassification::ReasoningTokenMappingMismatch, ());
    }
    if comparison.source == TokenSource::FelinaDb
        && baseline.source == TokenSource::FelinaRescan
        && comparison.totals.event_count < baseline.totals.event_count
    {
        classes.insert(MismatchClassification::StorageDuplicateBehavior, ());
    }
    if baseline.totals.total_tokens() == comparison.totals.total_tokens() {
        classes.insert(MismatchClassification::PricingOnlyMismatch, ());
    }
    if classes.is_empty() {
        classes.insert(MismatchClassification::Unknown, ());
    }
    classes.into_keys().collect()
}

fn summarize_classifications(mismatches: &[MismatchRow]) -> Vec<ClassificationSummary> {
    let mut counts: BTreeMap<MismatchClassification, u64> = BTreeMap::new();
    for mismatch in mismatches {
        for class in &mismatch.classifications {
            *counts.entry(class.clone()).or_default() += 1;
        }
    }
    counts
        .into_iter()
        .map(|(classification, count)| ClassificationSummary {
            classification,
            count,
        })
        .collect()
}

fn evaluate_tokscale_readiness(
    statuses: &[SourceSummary],
    records: &[ReconciliationRecord],
) -> TokscaleReadiness {
    let status = statuses
        .iter()
        .find(|s| s.source == TokenSource::TokscaleExport);
    let mut reasons = Vec::new();
    let mut mappings = Vec::new();

    match status.map(|s| &s.status) {
        Some(SourceStatus::Ok) => {}
        Some(SourceStatus::MissingBinary) => reasons.push("tokscale binary is missing".to_string()),
        Some(SourceStatus::CommandFailed) => reasons.push("tokscale command failed".to_string()),
        Some(SourceStatus::UnsupportedSchema) => {
            reasons.push("tokscale output schema is unsupported".to_string())
        }
        Some(SourceStatus::ParseFailed) => {
            reasons.push("tokscale output could not be parsed".to_string())
        }
        Some(SourceStatus::StorageUnavailable) | None => {
            reasons.push("tokscale source is unavailable".to_string())
        }
    }

    let tokscale_records = records
        .iter()
        .filter(|r| r.source == TokenSource::TokscaleExport)
        .collect::<Vec<_>>();
    if tokscale_records.is_empty() {
        reasons.push("tokscale produced no normalized records".to_string());
    } else {
        let fields = [
            (
                "agent",
                tokscale_records.iter().any(|r| !r.agent.is_empty()),
            ),
            (
                "model",
                tokscale_records.iter().any(|r| !r.model.is_empty()),
            ),
            (
                "input_tokens",
                tokscale_records.iter().any(|r| r.input_tokens > 0),
            ),
            (
                "output_tokens",
                tokscale_records.iter().any(|r| r.output_tokens > 0),
            ),
            (
                "timestamp_bucket",
                tokscale_records
                    .iter()
                    .any(|r| r.timestamp_bucket != "unknown"),
            ),
        ];
        for (field, ok) in fields {
            if ok {
                mappings.push(field.to_string());
            } else {
                reasons.push(format!("missing required mapping: {}", field));
            }
        }
    }

    TokscaleReadiness {
        status: if reasons.is_empty() {
            TokscaleReadinessStatus::ReadyForMigrationProposal
        } else {
            TokscaleReadinessStatus::Blocked
        },
        reasons,
        field_mappings: mappings,
        version: status.and_then(|s| s.version.clone()),
    }
}

fn recommend(readiness: &TokscaleReadiness, mismatches: &[MismatchRow]) -> Recommendation {
    let material = mismatches.iter().any(|m| {
        let baseline = m.baseline_total_tokens.max(1);
        m.token_delta.unsigned_abs() > 100_000
            || m.token_delta.unsigned_abs() * 100 / baseline as u128 >= 10
    });
    let specific_parser_defect = mismatches.iter().any(|m| {
        m.classifications.iter().any(|c| {
            matches!(
                c,
                MismatchClassification::CumulativeAsIncrementalCandidate
                    | MismatchClassification::TruncatedJsonlCandidate
                    | MismatchClassification::OverlappingSourceDirectoryCandidate
                    | MismatchClassification::MissingTimestampCandidate
            )
        })
    });

    match (&readiness.status, material, specific_parser_defect) {
        (TokscaleReadinessStatus::ReadyForMigrationProposal, true, _) => {
            Recommendation::ProposeTokscaleBackedIngestion
        }
        (_, true, true) => Recommendation::PatchFelinaParser,
        (_, false, _) => Recommendation::KeepFelinaParser,
        _ => Recommendation::DeferPendingEvidence,
    }
}

pub fn render_markdown_report(report: &ReconciliationReport) -> String {
    let mut out = String::new();
    out.push_str("# Token Usage Source of Truth\n\n");
    out.push_str("## Command\n\n");
    out.push_str(&format!("- Command: `{}`\n", report.command));
    out.push_str(&format!(
        "- Scope: start={:?}, end={:?}, agent={:?}, model={:?}\n\n",
        report.scope.date_start,
        report.scope.date_end,
        report.scope.filter_agent,
        report.scope.filter_model
    ));
    out.push_str("## Source Statuses\n\n");
    for status in &report.source_statuses {
        out.push_str(&format!(
            "- {}: {:?}, records={}, version={:?}, message={:?}\n",
            status.source.as_str(),
            status.status,
            status.record_count,
            status.version,
            status.message
        ));
    }
    out.push_str("\n## Totals\n\n");
    for row in &report.totals_by_source {
        out.push_str(&format!(
            "- {}: {} tokens across {} events\n",
            row.source.as_str(),
            row.totals.total_tokens(),
            row.totals.event_count
        ));
    }
    out.push_str("\n## Top Mismatches\n\n");
    for mismatch in report.session_mismatches.iter().take(20) {
        out.push_str(&format!(
            "- {} `{}`: {} vs {} delta={} classifications={:?}\n",
            mismatch.dimension,
            mismatch.key,
            mismatch.baseline_source.as_str(),
            mismatch.comparison_source.as_str(),
            mismatch.token_delta,
            mismatch.classifications
        ));
    }
    out.push_str("\n## Tokscale Readiness\n\n");
    out.push_str(&format!(
        "- Status: {:?}\n- Reasons: {:?}\n- Field mappings: {:?}\n\n",
        report.tokscale_readiness.status,
        report.tokscale_readiness.reasons,
        report.tokscale_readiness.field_mappings
    ));
    out.push_str("## Recommendation\n\n");
    out.push_str(&format!("- `{}`\n\n", report.recommendation.as_str()));
    out.push_str("## Summary\n\n");
    out.push_str(&report.human_summary);
    out.push('\n');
    out
}

fn render_human_summary(
    options: &ReconcileOptions,
    statuses: &[SourceSummary],
    totals: &[AggregateRow],
    mismatches: &[MismatchRow],
    readiness: &TokscaleReadiness,
    recommendation: &Recommendation,
) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "Scope start={:?} end={:?} agent={:?} model={:?}.\n",
        options.date_start, options.date_end, options.filter_agent, options.filter_model
    ));
    out.push_str("Sources: ");
    out.push_str(
        &statuses
            .iter()
            .map(|s| format!("{}={:?}", s.source.as_str(), s.status))
            .collect::<Vec<_>>()
            .join(", "),
    );
    out.push_str(".\nTotals: ");
    out.push_str(
        &totals
            .iter()
            .map(|r| format!("{}={}", r.source.as_str(), r.totals.total_tokens()))
            .collect::<Vec<_>>()
            .join(", "),
    );
    out.push_str(&format!(
        ".\nTop mismatch count={}. Tokscale readiness={:?}. Recommendation={}.",
        mismatches.len(),
        readiness.status,
        recommendation.as_str()
    ));
    out
}

fn matching_parser_files(parser: &dyn AgentParser) -> Vec<PathBuf> {
    let extensions = parser
        .file_patterns()
        .iter()
        .filter_map(|p| p.rfind('.').map(|idx| p[idx + 1..].to_string()))
        .collect::<HashSet<_>>();
    let mut paths = Vec::new();
    for dir in parser.data_directories() {
        if !dir.exists() {
            continue;
        }
        for entry in WalkDir::new(&dir)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
                continue;
            };
            if extensions.contains(ext) {
                paths.push(path.to_path_buf());
            }
        }
    }
    paths
}

fn event_in_scope(event: &TokenEvent, options: &ReconcileOptions) -> bool {
    if let Some(start) = options.date_start {
        if event.timestamp < start {
            return false;
        }
    }
    if let Some(end) = options.date_end {
        if event.timestamp > end {
            return false;
        }
    }
    if let Some(agent) = &options.filter_agent {
        if event.agent.to_string() != *agent {
            return false;
        }
    }
    if let Some(model) = &options.filter_model {
        if event.model != *model {
            return false;
        }
    }
    true
}

fn day_bucket(timestamp: i64) -> String {
    if timestamp <= 0 {
        return "unknown".to_string();
    }
    let days = timestamp.div_euclid(86_400);
    civil_from_days(days)
}

fn civil_from_days(days_since_epoch: i64) -> String {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    format!("{:04}-{:02}-{:02}", year, m, d)
}

fn sqlite_version(conn: &Connection) -> Option<String> {
    conn.query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .ok()
}

fn default_registry() -> ParserRegistry {
    let mut registry = ParserRegistry::new();
    registry.register(Box::new(ClaudeCodeParser::new()));
    registry.register(Box::new(CodexCliParser));
    registry.register(Box::new(GeminiCliParser));
    registry
}

fn default_token_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".glyphic")
        .join("tokens.db")
}

pub fn count_storage_state(db_path: &Path) -> Result<(u64, u64), String> {
    let conn = open_readonly_connection(db_path)
        .map_err(|e| format!("cannot open {} read-only: {}", db_path.display(), e))?;
    let event_count = conn
        .query_row("SELECT COUNT(*) FROM token_events", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap_or(0) as u64;
    let scan_count = conn
        .query_row("SELECT COUNT(*) FROM scan_state", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap_or(0) as u64;
    Ok((event_count, scan_count))
}

fn open_readonly_connection(db_path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .or_else(|_| {
        let uri = format!("file:{}?mode=ro&immutable=1", db_path.to_string_lossy());
        Connection::open_with_flags(
            uri,
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_NO_MUTEX
                | OpenFlags::SQLITE_OPEN_URI,
        )
    })?;
    let _ = conn.busy_timeout(std::time::Duration::from_secs(5));
    let _ = conn.execute_batch("PRAGMA query_only = ON;");
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::types::AgentId;

    fn row(source: TokenSource, key: &str, total: u64, events: u64) -> AggregateRow {
        AggregateRow {
            dimension: "agent".to_string(),
            key: key.to_string(),
            source,
            totals: TokenTotals {
                input_tokens: total,
                output_tokens: 0,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: 0,
                event_count: events,
            },
        }
    }

    fn source_status(status: SourceStatus) -> SourceCollection {
        SourceCollection {
            source: TokenSource::TokscaleExport,
            status,
            message: Some("test status".to_string()),
            version: Some("test-version".to_string()),
            records: Vec::new(),
        }
    }

    #[test]
    fn normalizes_codex_session_records() {
        let event = TokenEvent {
            agent: AgentId::CodexCli,
            provider: "openai".to_string(),
            model: "gpt-5".to_string(),
            timestamp: 1_769_472_000,
            input_tokens: 1000,
            output_tokens: 200,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 50,
            project: None,
            session_id: Some("abc".to_string()),
        };
        let record = record_from_event(TokenSource::FelinaRescan, &event, BTreeMap::new());
        assert_eq!(record.agent, "codex-cli");
        assert_eq!(record.model, "gpt-5");
        assert_eq!(record.session_id.as_deref(), Some("abc"));
        assert_eq!(record.input_tokens, 1000);
        assert_eq!(record.output_tokens, 200);
        assert_eq!(record.reasoning_tokens, 50);
    }

    #[test]
    fn reports_codex_agent_total_mismatch_against_tokscale() {
        let rows = vec![
            row(TokenSource::TokscaleExport, "codex-cli", 300_000, 10),
            row(TokenSource::FelinaDb, "codex-cli", 900_000, 10),
            row(TokenSource::FelinaDb, "claude-code", 700_000, 10),
        ];
        let mismatches = mismatch_rows(&rows, "agent");
        let codex = mismatches
            .iter()
            .find(|m| m.key == "codex-cli")
            .expect("codex mismatch");
        assert_eq!(codex.token_delta, 600_000);
        assert_eq!(codex.baseline_source, TokenSource::TokscaleExport);
        assert_eq!(codex.comparison_source, TokenSource::FelinaDb);
    }

    #[test]
    fn classifies_known_mismatch_causes() {
        let cases = vec![
            (
                row(TokenSource::TokscaleExport, "codex-cli", 100, 1),
                row(TokenSource::FelinaRescan, "codex-cli", 300, 4),
                MismatchClassification::CumulativeAsIncrementalCandidate,
            ),
            (
                row(TokenSource::TokscaleExport, "codex-cli", 100, 1),
                row(TokenSource::FelinaRescan, "codex-cli", 300, 500),
                MismatchClassification::TruncatedJsonlCandidate,
            ),
            (
                row(TokenSource::TokscaleExport, "claude-code", 100, 1),
                row(TokenSource::FelinaRescan, "claude-code", 200, 1),
                MismatchClassification::OverlappingSourceDirectoryCandidate,
            ),
            (
                row(TokenSource::TokscaleExport, "unknown", 100, 1),
                row(TokenSource::FelinaDb, "unknown", 200, 1),
                MismatchClassification::MissingTimestampCandidate,
            ),
        ];

        for (baseline, comparison, expected) in cases {
            let classes = classify_mismatch(&baseline, &comparison);
            assert!(
                classes.contains(&expected),
                "expected {:?}, got {:?}",
                expected,
                classes
            );
        }
    }

    #[test]
    fn recommends_migration_for_material_ready_tokscale_mismatch() {
        let readiness = TokscaleReadiness {
            status: TokscaleReadinessStatus::ReadyForMigrationProposal,
            reasons: Vec::new(),
            field_mappings: vec!["agent".into()],
            version: Some("test".into()),
        };
        let mismatches = vec![MismatchRow {
            dimension: "agent".into(),
            key: "codex-cli".into(),
            baseline_source: TokenSource::TokscaleExport,
            comparison_source: TokenSource::FelinaDb,
            baseline_total_tokens: 300_000,
            comparison_total_tokens: 900_000,
            token_delta: 600_000,
            classifications: vec![MismatchClassification::Unknown],
            metadata: BTreeMap::new(),
        }];
        assert_eq!(
            recommend(&readiness, &mismatches),
            Recommendation::ProposeTokscaleBackedIngestion
        );
    }

    #[test]
    fn report_serializes_all_tokscale_source_statuses() {
        let statuses = vec![
            SourceStatus::MissingBinary,
            SourceStatus::CommandFailed,
            SourceStatus::UnsupportedSchema,
            SourceStatus::ParseFailed,
        ];

        for status in statuses {
            let report = build_report(
                &ReconcileOptions::default(),
                vec![
                    SourceCollection {
                        source: TokenSource::FelinaDb,
                        status: SourceStatus::Ok,
                        message: None,
                        version: None,
                        records: Vec::new(),
                    },
                    SourceCollection {
                        source: TokenSource::FelinaRescan,
                        status: SourceStatus::Ok,
                        message: None,
                        version: None,
                        records: Vec::new(),
                    },
                    source_status(status.clone()),
                ],
            );
            let json = serde_json::to_string(&report).expect("serialize report");
            assert!(
                json.contains(&format!("{:?}", status).to_lowercase())
                    || json.contains("missing_binary")
                    || json.contains("command_failed")
                    || json.contains("unsupported_schema")
                    || json.contains("parse_failed")
            );
        }
    }

    #[test]
    fn evaluates_tokscale_readiness_ready_and_blocked() {
        let mut record = record_from_event(
            TokenSource::TokscaleExport,
            &TokenEvent {
                agent: AgentId::CodexCli,
                provider: "openai".into(),
                model: "gpt-5".into(),
                timestamp: 1_769_472_000,
                input_tokens: 100,
                output_tokens: 50,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: 1,
                project: None,
                session_id: Some("abc".into()),
            },
            BTreeMap::new(),
        );
        record.timestamp_bucket = "2026-01-27".into();
        let ready = evaluate_tokscale_readiness(
            &[SourceSummary {
                source: TokenSource::TokscaleExport,
                status: SourceStatus::Ok,
                message: None,
                version: Some("1.0".into()),
                record_count: 1,
            }],
            &[record],
        );
        assert_eq!(
            ready.status,
            TokscaleReadinessStatus::ReadyForMigrationProposal
        );

        let blocked = evaluate_tokscale_readiness(
            &[SourceSummary {
                source: TokenSource::TokscaleExport,
                status: SourceStatus::MissingBinary,
                message: None,
                version: None,
                record_count: 0,
            }],
            &[],
        );
        assert_eq!(blocked.status, TokscaleReadinessStatus::Blocked);
        assert!(blocked.reasons.iter().any(|r| r.contains("missing")));
    }

    #[test]
    fn recommendation_distinguishes_material_and_non_material_mismatch() {
        let readiness = TokscaleReadiness {
            status: TokscaleReadinessStatus::ReadyForMigrationProposal,
            reasons: Vec::new(),
            field_mappings: vec![
                "agent".into(),
                "model".into(),
                "input_tokens".into(),
                "output_tokens".into(),
                "timestamp_bucket".into(),
            ],
            version: Some("test".into()),
        };
        let non_material = vec![MismatchRow {
            dimension: "agent".into(),
            key: "codex-cli".into(),
            baseline_source: TokenSource::TokscaleExport,
            comparison_source: TokenSource::FelinaDb,
            baseline_total_tokens: 1_000_000,
            comparison_total_tokens: 1_001_000,
            token_delta: 1_000,
            classifications: vec![MismatchClassification::Unknown],
            metadata: BTreeMap::new(),
        }];
        assert_eq!(
            recommend(&readiness, &non_material),
            Recommendation::KeepFelinaParser
        );
    }

    #[test]
    fn reconciliation_keeps_temp_storage_counts_unchanged() {
        let db = std::env::temp_dir().join("glyphic_reconcile_readonly_test.db");
        let _ = std::fs::remove_file(&db);
        let conn = Connection::open(&db).expect("open temp db");
        conn.execute_batch(
            "CREATE TABLE token_events (
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
            CREATE TABLE scan_state (
                agent TEXT NOT NULL,
                source_path TEXT NOT NULL,
                last_mtime INTEGER NOT NULL DEFAULT 0,
                last_scan_ts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                PRIMARY KEY (agent, source_path)
            );",
        )
        .expect("create temp schema");
        conn.execute(
            "INSERT INTO token_events
                (agent, provider, model, timestamp, input_tokens, output_tokens, session_id)
             VALUES ('codex-cli', 'openai', 'gpt-5', 1769472000, 1000, 200, 'abc')",
            [],
        )
        .expect("insert event");
        conn.execute(
            "INSERT INTO scan_state (agent, source_path, last_mtime, last_scan_ts)
             VALUES ('codex-cli', '/tmp/source', 1, 2)",
            [],
        )
        .expect("insert scan state");
        drop(conn);

        let before = count_storage_state(&db).expect("count before");
        let _report = reconcile(ReconcileOptions {
            db_path: Some(db.clone()),
            filter_agent: Some("no-such-agent".into()),
            include_tokscale: false,
            ..Default::default()
        });
        let after = count_storage_state(&db).expect("count after");
        assert_eq!(before, after);
        let _ = std::fs::remove_file(&db);
    }
}
