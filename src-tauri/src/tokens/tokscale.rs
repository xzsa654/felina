use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::Command;

use serde_json::Value;

use crate::tokens::reconciliation::{
    aggregate_records, ReconcileOptions, ReconciliationRecord, SourceCollection, SourceStatus,
    TokenSource,
};
use crate::tokens::types::AgentId;

pub trait TokscaleAdapter {
    fn collect(&self, options: &ReconcileOptions) -> SourceCollection;
}

pub struct TokscaleCommandAdapter {
    bin: PathBuf,
    base_args: Vec<String>,
    fallback: Option<(PathBuf, Vec<String>)>,
}

impl TokscaleCommandAdapter {
    pub fn new(bin: Option<PathBuf>) -> Self {
        if let Some(bin) = bin {
            return Self {
                bin,
                base_args: Vec::new(),
                fallback: None,
            };
        }

        Self {
            bin: PathBuf::from("tokscale"),
            base_args: Vec::new(),
            fallback: Some((
                PathBuf::from("npx"),
                vec!["--yes".to_string(), "tokscale@2.1.3".to_string()],
            )),
        }
    }
}

impl TokscaleAdapter for TokscaleCommandAdapter {
    fn collect(&self, options: &ReconcileOptions) -> SourceCollection {
        let report_args = tokscale_report_args(options);
        let output = match run_tokscale_command(&self.bin, &self.base_args, &report_args) {
            Ok(output) => output,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => match &self.fallback {
                Some((bin, args)) => match run_tokscale_command(bin, args, &report_args) {
                    Ok(output) => output,
                    Err(fallback_error)
                        if fallback_error.kind() == std::io::ErrorKind::NotFound =>
                    {
                        return SourceCollection {
                            source: TokenSource::TokscaleExport,
                            status: SourceStatus::MissingBinary,
                            message: Some(format!(
                                "{} not found and pinned npx fallback is unavailable",
                                self.bin.display()
                            )),
                            version: None,
                            records: Vec::new(),
                        };
                    }
                    Err(fallback_error) => {
                        return SourceCollection {
                            source: TokenSource::TokscaleExport,
                            status: SourceStatus::CommandFailed,
                            message: Some(fallback_error.to_string()),
                            version: None,
                            records: Vec::new(),
                        };
                    }
                },
                None => {
                    return SourceCollection {
                        source: TokenSource::TokscaleExport,
                        status: SourceStatus::MissingBinary,
                        message: Some(format!("{} not found", self.bin.display())),
                        version: None,
                        records: Vec::new(),
                    };
                }
            },
            Err(e) => {
                return SourceCollection {
                    source: TokenSource::TokscaleExport,
                    status: SourceStatus::CommandFailed,
                    message: Some(e.to_string()),
                    version: None,
                    records: Vec::new(),
                };
            }
        };

        if !output.status.success() {
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
) -> std::io::Result<std::process::Output> {
    let mut command = Command::new(bin);
    for arg in base_args {
        command.arg(arg);
    }
    for arg in report_args {
        command.arg(arg);
    }
    command.output()
}

pub fn tokscale_report_args(options: &ReconcileOptions) -> Vec<String> {
    let mut args = vec!["--json".to_string(), "--no-spinner".to_string()];
    if let Some(start) = options.date_start {
        args.push("--since".to_string());
        args.push(epoch_to_date(start));
    }
    if let Some(end) = options.date_end {
        args.push("--until".to_string());
        args.push(epoch_to_date(end));
    }
    args
}

pub fn parse_tokscale_json(raw: &str, options: &ReconcileOptions) -> SourceCollection {
    let value: Value = match serde_json::from_str(raw) {
        Ok(value) => value,
        Err(e) => {
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
    match value {
        Value::Array(items) => {
            for item in items {
                collect_records_from_value(item, out, schema_errors);
            }
        }
        Value::Object(map) => {
            match record_from_object(map) {
                Ok(Some(record)) => out.push(record),
                Ok(None) => {}
                Err(err) => schema_errors.push(err),
            }
            for child in map.values() {
                collect_records_from_value(child, out, schema_errors);
            }
        }
        _ => {}
    }
}

fn record_from_object(
    map: &serde_json::Map<String, Value>,
) -> Result<Option<ReconciliationRecord>, String> {
    if !is_usage_candidate(map) {
        return Ok(None);
    }

    let input = required_number_any(
        map,
        &["input_tokens", "prompt_tokens", "input", "totalInput"],
        "input",
    )?;
    let output = required_number_any(
        map,
        &[
            "output_tokens",
            "completion_tokens",
            "output",
            "totalOutput",
        ],
        "output",
    )?;
    let cache_read = required_number_any(
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
    let cache_write = required_number_any(
        map,
        &[
            "cache_write_tokens",
            "cache_creation_input_tokens",
            "cacheWrite",
            "totalCacheWrite",
        ],
        "cacheWrite",
    )?;
    let reasoning = number_any(
        map,
        &["reasoning_tokens", "reasoning_output_tokens", "reasoning"],
    );
    if input + output + cache_read + cache_write + reasoning == 0 {
        return Ok(None);
    }

    let model = string_any(map, &["model", "model_name"])
        .ok_or_else(|| "tokscale usage row missing model".to_string())?;
    let agent = parse_agent(
        string_any(map, &["agent", "client", "tool"])
            .ok_or_else(|| format!("tokscale usage row for {} missing client", model))?,
    )
    .ok_or_else(|| format!("tokscale usage row for {} has unsupported client", model))?
    .to_string();
    let provider = string_any(map, &["provider", "model_provider"])
        .ok_or_else(|| format!("tokscale usage row for {} missing provider", model))?;
    let timestamp = number_any(map, &["timestamp", "created_at", "time"]) as i64;
    let session_id = string_any(map, &["session_id", "session", "conversation_id"]);
    let event_count = required_number_any(
        map,
        &["event_count", "messageCount", "totalMessages"],
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
        timestamp_bucket: if timestamp > 0 {
            epoch_to_date(timestamp)
        } else {
            "all".to_string()
        },
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

fn is_usage_candidate(map: &serde_json::Map<String, Value>) -> bool {
    map.contains_key("model")
        || map.contains_key("model_name")
        || map.contains_key("client")
        || map.contains_key("agent")
        || map.contains_key("tool")
}

fn required_number_any(
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
    Err(format!("tokscale usage row missing {} field", label))
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

fn parse_agent(agent: String) -> Option<AgentId> {
    let normalized = agent.to_lowercase();
    if normalized.contains("codex") {
        Some(AgentId::CodexCli)
    } else if normalized.contains("gemini") {
        Some(AgentId::GeminiCli)
    } else if normalized == "claude" || normalized.contains("claude-code") {
        Some(AgentId::ClaudeCode)
    } else {
        None
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
    fn unsupported_schema_for_unknown_clients_or_zero_token_rows() {
        let cases = [
            r#"{"entries":[{"client":"unknown-agent","model":"mystery","provider":"unknown","input":10,"output":1,"cacheRead":0,"cacheWrite":0,"reasoning":0,"messageCount":1}]}"#,
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
        assert!(collection
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("cacheRead"));
        assert!(collection.records.is_empty());
    }

    #[test]
    fn tokscale_report_args_only_use_local_report_flags() {
        let args = tokscale_report_args(&ReconcileOptions {
            date_start: Some(1_769_472_000),
            date_end: Some(1_769_558_399),
            include_tokscale: true,
            ..Default::default()
        });

        assert!(args.contains(&"--json".to_string()));
        assert!(args.contains(&"--no-spinner".to_string()));
        assert!(args.contains(&"--since".to_string()));
        assert!(args.contains(&"--until".to_string()));
        assert!(!args
            .iter()
            .any(|arg| matches!(arg.as_str(), "submit" | "login" | "tui" | "wrapped")));
    }

    #[test]
    fn default_tokscale_command_prefers_local_binary_with_pinned_npx_fallback() {
        let adapter = TokscaleCommandAdapter::new(None);

        assert_eq!(adapter.bin, PathBuf::from("tokscale"));
        assert!(adapter.base_args.is_empty());
        assert_eq!(
            adapter.fallback,
            Some((
                PathBuf::from("npx"),
                vec!["--yes".to_string(), "tokscale@2.1.3".to_string()]
            ))
        );
    }

    #[test]
    fn explicit_tokscale_binary_override_uses_no_npx_fallback() {
        let adapter = TokscaleCommandAdapter::new(Some(PathBuf::from("/opt/bin/tokscale")));

        assert_eq!(adapter.bin, PathBuf::from("/opt/bin/tokscale"));
        assert!(adapter.base_args.is_empty());
        assert!(adapter.fallback.is_none());
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
}
