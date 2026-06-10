use std::collections::BTreeMap;
use std::path::PathBuf;
use serde_json::Value;

use crate::tokens::reconciliation::{
    ReconcileOptions, ReconciliationRecord, SourceCollection, SourceStatus, TokenSource,
    aggregate_records,
};

pub trait TokscaleAdapter {
    fn collect(&self, options: &ReconcileOptions) -> SourceCollection;
}

struct Candidate {
    bin: PathBuf,
    base_args: Vec<String>,
    allow_cmd_variant: bool,
}

pub struct TokscaleCommandAdapter {
    candidates: Vec<Candidate>,
}

fn sidecar_tokscale_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let sidecar = dir.join(format!("tokscale{}", std::env::consts::EXE_SUFFIX));
    if sidecar.is_file() {
        Some(sidecar)
    } else {
        None
    }
}

impl TokscaleCommandAdapter {
    pub fn new(bin: Option<PathBuf>) -> Self {
        if let Some(bin) = bin {
            return Self {
                candidates: vec![Candidate {
                    bin,
                    base_args: Vec::new(),
                    allow_cmd_variant: false,
                }],
            };
        }

        let mut candidates = vec![Candidate {
            bin: PathBuf::from("tokscale"),
            base_args: Vec::new(),
            allow_cmd_variant: true,
        }];

        if let Some(sidecar) = sidecar_tokscale_path() {
            candidates.push(Candidate {
                bin: sidecar,
                base_args: Vec::new(),
                allow_cmd_variant: false,
            });
        }

        candidates.push(Candidate {
            bin: PathBuf::from("npx"),
            base_args: vec!["--yes".to_string(), "tokscale@latest".to_string()],
            allow_cmd_variant: true,
        });

        Self { candidates }
    }

    #[cfg(test)]
    pub fn candidate_bins(&self) -> Vec<&PathBuf> {
        self.candidates.iter().map(|c| &c.bin).collect()
    }
}

/// npm-installed CLIs expose only `.cmd` shims on Windows, which
/// `std::process::Command::new` cannot spawn by bare name. Returns the `.cmd`
/// variant to retry with, but only for bare names — explicit paths and names
/// that already carry an extension must not be second-guessed.
fn cmd_variant(bin: &PathBuf) -> Option<PathBuf> {
    let name = bin.to_str()?;
    if name.contains('/') || name.contains('\\') {
        return None;
    }
    if std::path::Path::new(name).extension().is_some() {
        return None;
    }
    Some(PathBuf::from(format!("{name}.cmd")))
}

impl TokscaleAdapter for TokscaleCommandAdapter {
    fn collect(&self, options: &ReconcileOptions) -> SourceCollection {
        let report_args = tokscale_report_args(options);
        let mut last_error: Option<std::io::Error> = None;

        let output = 'candidates: {
            for (i, candidate) in self.candidates.iter().enumerate() {
                if i > 0 {
                    eprintln!(
                        "tokscale: trying candidate {} {:?}",
                        candidate.bin.display(),
                        candidate.base_args
                    );
                } else {
                    eprintln!(
                        "tokscale: running {} {:?}",
                        candidate.bin.display(),
                        report_args
                    );
                }

                match run_tokscale_command(
                    &candidate.bin,
                    &candidate.base_args,
                    &report_args,
                    candidate.allow_cmd_variant,
                ) {
                    Ok(output) => break 'candidates output,
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                        eprintln!("tokscale: {} not found", candidate.bin.display());
                        last_error = Some(e);
                    }
                    Err(e) => {
                        eprintln!("tokscale: {} failed: {}", candidate.bin.display(), e);
                        last_error = Some(e);
                    }
                }
            }

            let err = last_error.unwrap();
            let status = if err.kind() == std::io::ErrorKind::NotFound {
                SourceStatus::MissingBinary
            } else {
                SourceStatus::CommandFailed
            };
            return SourceCollection {
                source: TokenSource::TokscaleExport,
                status,
                message: Some(format!("all candidates exhausted: {}", err)),
                version: None,
                records: Vec::new(),
            };
        };

        if !output.status.success() {
            eprintln!(
                "tokscale: command exited with status {:?}, stderr={}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr).trim()
            );
            return SourceCollection {
                source: TokenSource::TokscaleExport,
                status: SourceStatus::CommandFailed,
                message: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
                version: None,
                records: Vec::new(),
            };
        }

        parse_tokscale_json(&String::from_utf8_lossy(&output.stdout), options)
    }
}

fn run_tokscale_command(
    bin: &PathBuf,
    base_args: &[String],
    report_args: &[String],
    allow_cmd_variant: bool,
) -> std::io::Result<std::process::Output> {
    let result = spawn_tokscale_once(bin, base_args, report_args);
    if cfg!(target_os = "windows") && allow_cmd_variant {
        if let Err(e) = &result {
            if e.kind() == std::io::ErrorKind::NotFound {
                if let Some(variant) = cmd_variant(bin) {
                    eprintln!(
                        "tokscale: {} not found, retrying with {}",
                        bin.display(),
                        variant.display()
                    );
                    return spawn_tokscale_once(&variant, base_args, report_args);
                }
            }
        }
    }
    result
}

fn spawn_tokscale_once(
    bin: &PathBuf,
    base_args: &[String],
    report_args: &[String],
) -> std::io::Result<std::process::Output> {
    let mut command = crate::tokens::no_window_command(bin.to_str().unwrap_or("tokscale"));
    for arg in base_args {
        command.arg(arg);
    }
    for arg in report_args {
        command.arg(arg);
    }
    command.output()
}

pub fn tokscale_report_args(options: &ReconcileOptions) -> Vec<String> {
    let mut args = Vec::new();
    let subcommand = options.tokscale_subcommand.as_deref();
    if let Some(command) = subcommand {
        args.push(command.to_string());
    }
    if subcommand != Some("graph") {
        args.push("--json".to_string());
    }
    args.push("--no-spinner".to_string());
    if let Some(start) = options.date_start {
        args.push("--since".to_string());
        args.push(epoch_to_date(start));
    }
    if let Some(end) = options.date_end {
        args.push("--until".to_string());
        args.push(epoch_to_date(end));
    }
    if subcommand != Some("graph") {
        if let Some(group_by) = &options.tokscale_group_by {
            args.push("--group-by".to_string());
            args.push(group_by.clone());
        }
    }
    args
}

fn record_from_object(
    map: &serde_json::Map<String, Value>,
    inherited_bucket: Option<&str>,
) -> Result<Option<ReconciliationRecord>, String> {
    if !is_usage_candidate(map) {
        return Ok(None);
    }

    let input = required_token_number_any(
        map,
        &["input_tokens", "prompt_tokens", "input", "totalInput"],
        "input",
    )?;
    let output = required_token_number_any(
        map,
        &[
            "output_tokens",
            "completion_tokens",
            "output",
            "totalOutput",
        ],
        "output",
    )?;
    let cache_read = required_token_number_any(
        map,
        &[
            "cache_read_tokens",
            "cached_input_tokens",
            "cache_read_input_tokens",
            "cacheRead",
            "totalCacheRead",
        ],
        "cacheRead",
    )?;
    let cache_write = required_token_number_any(
        map,
        &[
            "cache_write_tokens",
            "cache_creation_input_tokens",
            "cacheWrite",
            "totalCacheWrite",
        ],
        "cacheWrite",
    )?;
    let reasoning = token_number_any(
        map,
        &["reasoning_tokens", "reasoning_output_tokens", "reasoning"],
    );
    if input + output + cache_read + cache_write + reasoning == 0 {
        return Ok(None);
    }

    let model = string_any(map, &["model", "model_name", "modelId"])
        .ok_or_else(|| "tokscale usage row missing model".to_string())?;
    let agent = parse_agent(
        string_any(map, &["agent", "client", "tool"])
            .ok_or_else(|| format!("tokscale usage row for {} missing client", model))?,
    );
    let provider = string_any(map, &["provider", "model_provider", "providerId"])
        .ok_or_else(|| format!("tokscale usage row for {} missing provider", model))?;
    let timestamp = number_any(map, &["timestamp", "created_at", "time"]) as i64;
    let timestamp_bucket = date_bucket_any(
        map,
        &[
            "timestamp_bucket",
            "date",
            "day",
            "bucket",
            "period",
            "month",
        ],
    )
    .or_else(|| inherited_bucket.map(ToString::to_string))
    .unwrap_or_else(|| {
        if timestamp > 0 {
            epoch_to_date(timestamp)
        } else {
            "all".to_string()
        }
    });
    let session_id = string_any(map, &["session_id", "session", "conversation_id"]);
    let event_count = required_token_number_any(
        map,
        &["event_count", "messageCount", "totalMessages", "messages"],
        "messageCount",
    )?
    .max(1);
    let mut source_metadata =
        BTreeMap::from([("source_schema".to_string(), "tokscale_json".to_string())]);
    if let Some(client) = string_any(map, &["client"]) {
        source_metadata.insert("client".to_string(), client);
    }
    if let Some(cost) = number_or_float_string_any(map, &["cost", "totalCost"]) {
        source_metadata.insert("cost".to_string(), cost);
    }

    Ok(Some(ReconciliationRecord {
        source: TokenSource::TokscaleExport,
        provider,
        agent,
        model,
        timestamp_bucket,
        session_id,
        input_tokens: input,
        output_tokens: output,
        cache_read_tokens: cache_read,
        cache_write_tokens: cache_write,
        reasoning_tokens: reasoning,
        event_count,
        source_metadata,
    }))
}

pub fn parse_tokscale_json(raw: &str, options: &ReconcileOptions) -> SourceCollection {
    let value: Value = match serde_json::from_str(raw) {
        Ok(value) => value,
        Err(e) => {
            eprintln!("tokscale: JSON parse failed: {}", e);
            return SourceCollection {
                source: TokenSource::TokscaleExport,
                status: SourceStatus::ParseFailed,
                message: Some(e.to_string()),
                version: None,
                records: Vec::new(),
            };
        }
    };

    let version = value
        .get("version")
        .or_else(|| value.get("tokscale_version"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let mut records = Vec::new();
    let mut schema_errors = Vec::new();
    collect_records_from_value(&value, &mut records, &mut schema_errors);
    if !schema_errors.is_empty() {
        eprintln!("tokscale: unsupported schema: {}", schema_errors.join("; "));
        return SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::UnsupportedSchema,
            message: Some(schema_errors.join("; ")),
            version,
            records: Vec::new(),
        };
    }
    let filtered = records
        .into_iter()
        .filter(|record| {
            if let Some(agent) = &options.filter_agent {
                if record.agent != *agent {
                    return false;
                }
            }
            if let Some(model) = &options.filter_model {
                if record.model != *model {
                    return false;
                }
            }
            true
        })
        .collect::<Vec<_>>();

    if filtered.is_empty() {
        eprintln!("tokscale: no token usage records found after filtering");
        return SourceCollection {
            source: TokenSource::TokscaleExport,
            status: SourceStatus::UnsupportedSchema,
            message: Some("no token usage records found in tokscale JSON".to_string()),
            version,
            records: Vec::new(),
        };
    }

    SourceCollection {
        source: TokenSource::TokscaleExport,
        status: SourceStatus::Ok,
        message: None,
        version,
        records: aggregate_records(filtered),
    }
}

fn collect_records_from_value(
    value: &Value,
    out: &mut Vec<ReconciliationRecord>,
    schema_errors: &mut Vec<String>,
) {
    collect_records_from_value_with_bucket(value, None, out, schema_errors);
}

fn collect_records_from_value_with_bucket(
    value: &Value,
    inherited_bucket: Option<&str>,
    out: &mut Vec<ReconciliationRecord>,
    schema_errors: &mut Vec<String>,
) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_records_from_value_with_bucket(item, inherited_bucket, out, schema_errors);
            }
        }
        Value::Object(map) => {
            let bucket = date_bucket_any(
                map,
                &[
                    "timestamp_bucket",
                    "date",
                    "day",
                    "bucket",
                    "period",
                    "month",
                ],
            )
            .or_else(|| inherited_bucket.map(ToString::to_string));
            match record_from_object(map, bucket.as_deref()) {
                Ok(Some(record)) => out.push(record),
                Ok(None) => {}
                Err(err) => schema_errors.push(err),
            }
            for child in map.values() {
                collect_records_from_value_with_bucket(
                    child,
                    bucket.as_deref(),
                    out,
                    schema_errors,
                );
            }
        }
        _ => {}
    }
}

fn is_usage_candidate(map: &serde_json::Map<String, Value>) -> bool {
    map.contains_key("model")
        || map.contains_key("model_name")
        || map.contains_key("modelId")
        || map.contains_key("client")
        || map.contains_key("agent")
        || map.contains_key("tool")
}

fn required_token_number_any(
    map: &serde_json::Map<String, Value>,
    keys: &[&str],
    label: &str,
) -> Result<u64, String> {
    for key in keys {
        if let Some(value) = map.get(*key) {
            return parse_non_negative_u64(value)
                .ok_or_else(|| format!("tokscale usage row has invalid {} field", label));
        }
    }
    if let Some(tokens) = map.get("tokens").and_then(|value| value.as_object()) {
        for key in keys {
            if let Some(value) = tokens.get(*key) {
                return parse_non_negative_u64(value)
                    .ok_or_else(|| format!("tokscale usage row has invalid {} field", label));
            }
        }
    }
    Err(format!("tokscale usage row missing {} field", label))
}

fn token_number_any(map: &serde_json::Map<String, Value>, keys: &[&str]) -> u64 {
    let direct = number_any(map, keys);
    if direct > 0 {
        return direct;
    }
    if let Some(tokens) = map.get("tokens").and_then(|value| value.as_object()) {
        return number_any(tokens, keys);
    }
    0
}

fn number_any(map: &serde_json::Map<String, Value>, keys: &[&str]) -> u64 {
    for key in keys {
        if let Some(value) = map.get(*key) {
            if let Some(n) = parse_non_negative_u64(value) {
                return n;
            }
        }
    }
    0
}

fn parse_non_negative_u64(value: &Value) -> Option<u64> {
    if let Some(n) = value.as_u64() {
        return Some(n);
    }
    if let Some(n) = value.as_i64() {
        return u64::try_from(n).ok();
    }
    value.as_str().and_then(|s| s.parse::<u64>().ok())
}

fn string_any(map: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = map.get(*key) {
            if let Some(s) = value.as_str() {
                return Some(s.to_string());
            }
        }
    }
    None
}

fn date_bucket_any(map: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = map.get(*key).and_then(|value| value.as_str()) {
            let trimmed = value.trim();
            if trimmed.len() >= 10 {
                let day = &trimmed[..10];
                if is_yyyy_mm_dd(day) {
                    return Some(day.to_string());
                }
            }
        }
    }
    None
}

fn is_yyyy_mm_dd(value: &str) -> bool {
    let bytes = value.as_bytes();
    value.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(idx, byte)| idx == 4 || idx == 7 || byte.is_ascii_digit())
}

fn number_or_float_string_any(
    map: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(value) = map.get(*key) {
            if let Some(n) = value.as_f64() {
                return Some(n.to_string());
            }
            if let Some(s) = value.as_str() {
                return Some(s.to_string());
            }
        }
    }
    None
}

fn parse_agent(agent: String) -> String {
    let normalized = agent.to_lowercase();
    if normalized.contains("codex") {
        "codex-cli".to_string()
    } else if normalized.contains("gemini") {
        "gemini-cli".to_string()
    } else if normalized == "claude" || normalized.contains("claude-code") {
        "claude-code".to_string()
    } else {
        agent
    }
}

fn epoch_to_date(timestamp: i64) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tokscale_fixture_records() {
        let raw = r#"{
          "version": "1.0-test",
          "records": [
            {
              "agent": "codex-cli",
              "provider": "openai",
              "model": "gpt-5",
              "timestamp": 1769472000,
              "session_id": "abc",
              "input_tokens": 1000,
              "output_tokens": 200,
              "cache_read_tokens": 0,
              "cache_write_tokens": 0,
              "reasoning_tokens": 50
              ,"event_count": 1
            }
          ]
        }"#;
        let collection = parse_tokscale_json(
            raw,
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::Ok);
        assert_eq!(collection.version.as_deref(), Some("1.0-test"));
        assert_eq!(collection.records.len(), 1);
        assert_eq!(collection.records[0].agent, "codex-cli");
        assert_eq!(collection.records[0].input_tokens, 1000);
    }

    #[test]
    fn parses_tokscale_light_json_entries() {
        let raw = r#"{
          "groupBy": "client,model",
          "entries": [
            {
              "client": "claude",
              "model": "claude-sonnet-4-6",
              "provider": "anthropic",
              "input": 59951,
              "output": 1578906,
              "cacheRead": 168809098,
              "cacheWrite": 7465353,
              "reasoning": 0,
              "messageCount": 2345,
              "cost": 102.50
            },
            {
              "client": "codex",
              "model": "gpt-5.5",
              "provider": "openai",
              "input": 5162272,
              "output": 339926,
              "cacheRead": 65629568,
              "cacheWrite": 0,
              "reasoning": 56278,
              "messageCount": 881,
              "cost": 70.51
            }
          ]
        }"#;
        let collection = parse_tokscale_json(
            raw,
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::Ok);
        assert_eq!(collection.records.len(), 2);

        let claude = collection
            .records
            .iter()
            .find(|record| record.agent == "claude-code")
            .expect("claude record");
        assert_eq!(claude.provider, "anthropic");
        assert_eq!(claude.model, "claude-sonnet-4-6");
        assert_eq!(claude.cache_read_tokens, 168_809_098);
        assert_eq!(claude.cache_write_tokens, 7_465_353);
        assert_eq!(claude.event_count, 2_345);
        assert_eq!(claude.timestamp_bucket, "all");

        let codex = collection
            .records
            .iter()
            .find(|record| record.agent == "codex-cli")
            .expect("codex record");
        assert_eq!(codex.provider, "openai");
        assert_eq!(codex.reasoning_tokens, 56_278);
        assert_eq!(codex.event_count, 881);
    }

    #[test]
    fn parses_tokscale_dated_entries_into_day_buckets() {
        let raw = r#"{
          "groupBy": "day,client,model",
          "entries": [
            {
              "day": "2026-01-27",
              "client": "codex",
              "model": "gpt-5",
              "provider": "openai",
              "input": 100,
              "output": 20,
              "cacheRead": 3,
              "cacheWrite": 4,
              "messageCount": 2
            },
            {
              "date": "2026-02-03T00:00:00Z",
              "client": "claude",
              "model": "claude-sonnet-4-6",
              "provider": "anthropic",
              "input": 200,
              "output": 30,
              "cacheRead": 5,
              "cacheWrite": 6,
              "messageCount": 3
            }
          ]
        }"#;
        let collection = parse_tokscale_json(
            raw,
            &ReconcileOptions {
                include_tokscale: true,
                tokscale_group_by: Some("day".into()),
                ..Default::default()
            },
        );

        assert_eq!(collection.status, SourceStatus::Ok);
        assert_eq!(collection.records.len(), 2);
        assert!(
            collection
                .records
                .iter()
                .any(|record| record.timestamp_bucket == "2026-01-27")
        );
        assert!(
            collection
                .records
                .iter()
                .any(|record| record.timestamp_bucket == "2026-02-03")
        );
    }

    #[test]
    fn parses_tokscale_graph_contributions_into_day_buckets() {
        let raw = r#"{
          "contributions": [
            {
              "date": "2026-03-03",
              "clients": [
                {
                  "client": "codex",
                  "modelId": "gpt-5",
                  "providerId": "openai",
                  "tokens": {
                    "input": 100,
                    "output": 20,
                    "cacheRead": 3,
                    "cacheWrite": 4,
                    "reasoning": 5
                  },
                  "messages": 2
                }
              ]
            }
          ]
        }"#;
        let collection = parse_tokscale_json(
            raw,
            &ReconcileOptions {
                include_tokscale: true,
                tokscale_subcommand: Some("graph".into()),
                ..Default::default()
            },
        );

        assert_eq!(collection.status, SourceStatus::Ok);
        assert_eq!(collection.records.len(), 1);
        let record = &collection.records[0];
        assert_eq!(record.agent, "codex-cli");
        assert_eq!(record.provider, "openai");
        assert_eq!(record.model, "gpt-5");
        assert_eq!(record.timestamp_bucket, "2026-03-03");
        assert_eq!(record.input_tokens, 100);
        assert_eq!(record.reasoning_tokens, 5);
        assert_eq!(record.event_count, 2);
    }

    #[test]
    fn unsupported_schema_when_no_usage_records_exist() {
        let collection = parse_tokscale_json(
            r#"{"version":"x","summary":[]}"#,
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::UnsupportedSchema);
    }

    #[test]
    fn unknown_client_is_passed_through_as_agent_name() {
        let raw = r#"{"entries":[{"client":"unknown-agent","model":"mystery","provider":"unknown","input":10,"output":1,"cacheRead":0,"cacheWrite":0,"reasoning":0,"messageCount":1}]}"#;
        let collection = parse_tokscale_json(
            raw,
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::Ok);
        assert_eq!(collection.records.len(), 1);
        assert_eq!(collection.records[0].agent, "unknown-agent");
    }

    #[test]
    fn unsupported_schema_for_zero_token_or_incomplete_rows() {
        let cases = [
            r#"{"entries":[{"client":"claude","model":"claude-sonnet-4-6","provider":"anthropic","input":0,"output":0,"cacheRead":0,"cacheWrite":0,"reasoning":0,"messageCount":0}]}"#,
            r#"{"entries":[{"client":"claude","model":"claude-sonnet-4-6"}]}"#,
        ];

        for raw in cases {
            let collection = parse_tokscale_json(
                raw,
                &ReconcileOptions {
                    include_tokscale: true,
                    ..Default::default()
                },
            );
            assert_eq!(collection.status, SourceStatus::UnsupportedSchema);
            assert!(collection.records.is_empty());
        }
    }

    #[test]
    fn missing_reasoning_field_defaults_to_zero_for_tokscale_rows() {
        let collection = parse_tokscale_json(
            r#"{"entries":[{"client":"claude","model":"claude-sonnet-4-6","provider":"anthropic","input":10,"output":1,"cacheRead":2,"cacheWrite":3,"messageCount":1}]}"#,
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::Ok);
        assert_eq!(collection.records[0].reasoning_tokens, 0);
    }

    #[test]
    fn unsupported_schema_for_missing_required_tokscale_fields_even_with_tokens() {
        let collection = parse_tokscale_json(
            r#"{"entries":[{"client":"claude","model":"claude-sonnet-4-6","provider":"anthropic","input":10,"output":1,"messageCount":1}]}"#,
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::UnsupportedSchema);
        assert!(
            collection
                .message
                .as_deref()
                .unwrap_or_default()
                .contains("cacheRead")
        );
        assert!(collection.records.is_empty());
    }

    #[test]
    fn tokscale_report_args_only_use_local_report_flags() {
        let args = tokscale_report_args(&ReconcileOptions {
            date_start: Some(1_769_472_000),
            date_end: Some(1_769_558_399),
            include_tokscale: true,
            tokscale_group_by: Some("day".into()),
            ..Default::default()
        });

        assert!(args.contains(&"--json".to_string()));
        assert!(args.contains(&"--no-spinner".to_string()));
        assert!(args.contains(&"--since".to_string()));
        assert!(args.contains(&"--until".to_string()));
        assert!(args.contains(&"--group-by".to_string()));
        assert!(args.contains(&"day".to_string()));
        assert!(
            !args
                .iter()
                .any(|arg| matches!(arg.as_str(), "submit" | "login" | "tui" | "wrapped"))
        );
    }

    #[test]
    fn tokscale_graph_report_args_use_graph_subcommand_without_json_flag() {
        let args = tokscale_report_args(&ReconcileOptions {
            include_tokscale: true,
            tokscale_subcommand: Some("graph".into()),
            ..Default::default()
        });

        assert_eq!(args, vec!["graph".to_string(), "--no-spinner".to_string()]);
    }

    #[test]
    fn default_tokscale_command_prefers_local_binary_with_npx_latest_fallback() {
        let adapter = TokscaleCommandAdapter::new(None);
        let bins = adapter.candidate_bins();

        assert_eq!(bins[0], &PathBuf::from("tokscale"));
        assert_eq!(bins.last().unwrap(), &&PathBuf::from("npx"));
    }

    #[test]
    fn cmd_variant_generated_for_bare_names_only() {
        assert_eq!(
            cmd_variant(&PathBuf::from("tokscale")),
            Some(PathBuf::from("tokscale.cmd"))
        );
        assert_eq!(cmd_variant(&PathBuf::from("npx")), Some(PathBuf::from("npx.cmd")));
    }

    #[test]
    fn cmd_variant_not_generated_for_paths_or_extensions() {
        assert_eq!(cmd_variant(&PathBuf::from("/opt/bin/tokscale")), None);
        assert_eq!(cmd_variant(&PathBuf::from(r"C:\tools\tokscale.exe")), None);
        assert_eq!(cmd_variant(&PathBuf::from("tokscale.exe")), None);
        assert_eq!(cmd_variant(&PathBuf::from("tokscale.cmd")), None);
    }

    #[test]
    fn explicit_override_disables_cmd_variant_retry() {
        let explicit = TokscaleCommandAdapter::new(Some(PathBuf::from("/opt/bin/tokscale")));
        assert!(!explicit.candidates[0].allow_cmd_variant);

        let default = TokscaleCommandAdapter::new(None);
        assert!(default.candidates[0].allow_cmd_variant);
    }

    #[test]
    fn explicit_tokscale_binary_override_uses_no_npx_fallback() {
        let adapter = TokscaleCommandAdapter::new(Some(PathBuf::from("/opt/bin/tokscale")));

        assert_eq!(adapter.candidates.len(), 1);
        assert_eq!(adapter.candidates[0].bin, PathBuf::from("/opt/bin/tokscale"));
        assert!(adapter.candidates[0].base_args.is_empty());
    }

    #[test]
    fn parse_failed_for_invalid_json() {
        let collection = parse_tokscale_json(
            "not json",
            &ReconcileOptions {
                include_tokscale: true,
                ..Default::default()
            },
        );
        assert_eq!(collection.status, SourceStatus::ParseFailed);
    }

    #[test]
    fn candidate_order_without_sidecar_is_path_then_npx() {
        let adapter = TokscaleCommandAdapter::new(None);
        let bins = adapter.candidate_bins();
        // sidecar_tokscale_path() returns None in test env (no sidecar next to test binary)
        assert_eq!(bins[0], &PathBuf::from("tokscale"));
        assert_eq!(bins.last().unwrap(), &&PathBuf::from("npx"));
        assert!(bins.iter().all(|b| {
            let s = b.to_str().unwrap();
            s == "tokscale" || s == "npx" || s.contains("tokscale")
        }));
    }

    #[test]
    fn candidate_order_with_sidecar_inserts_between_path_and_npx() {
        // Simulate by placing a dummy file next to current_exe
        let exe = std::env::current_exe().unwrap();
        let dir = exe.parent().unwrap();
        let sidecar = dir.join(format!("tokscale{}", std::env::consts::EXE_SUFFIX));
        let created = if !sidecar.exists() {
            std::fs::write(&sidecar, b"dummy").unwrap();
            true
        } else {
            false
        };

        let adapter = TokscaleCommandAdapter::new(None);
        let bins = adapter.candidate_bins();

        assert_eq!(bins[0], &PathBuf::from("tokscale"));
        assert_eq!(*bins[1], sidecar);
        assert_eq!(bins[2], &PathBuf::from("npx"));
        assert_eq!(bins.len(), 3);

        if created {
            let _ = std::fs::remove_file(&sidecar);
        }
    }

    #[test]
    fn explicit_override_has_no_sidecar_candidate() {
        let adapter = TokscaleCommandAdapter::new(Some(PathBuf::from("/opt/bin/tokscale")));
        let bins = adapter.candidate_bins();
        assert_eq!(bins.len(), 1);
        assert_eq!(bins[0], &PathBuf::from("/opt/bin/tokscale"));
    }
}
