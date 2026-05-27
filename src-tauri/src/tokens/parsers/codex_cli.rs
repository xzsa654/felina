use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

use serde::Deserialize;

use crate::tokens::parsers::AgentParser;
use crate::tokens::types::{AgentId, TokenEvent};

// ---------------------------------------------------------------------------
// New format (Codex CLI >= 0.132.0) — session JSONL with typed events
// ---------------------------------------------------------------------------

/// Top-level JSONL line: { timestamp, type, payload }
#[derive(Deserialize, Clone)]
struct CodexSessionLine {
    #[serde(default)]
    timestamp: Option<String>,
    #[serde(rename = "type", default)]
    line_type: Option<String>,
    #[serde(default)]
    payload: Option<CodexPayload>,
}

/// Payload varies by line_type:
///   session_meta → model_provider
///   turn_context → model
///   event_msg    → type="token_count" → info.last_token_usage
#[derive(Deserialize, Clone)]
struct CodexPayload {
    // session_meta
    #[serde(default)]
    model_provider: Option<String>,
    // turn_context
    #[serde(default)]
    model: Option<String>,
    // event_msg
    #[serde(rename = "type", default)]
    payload_type: Option<String>,
    #[serde(default)]
    info: Option<CodexInfo>,
}

#[derive(Deserialize, Clone)]
struct CodexInfo {
    /// Per-turn token usage (incremental — what we want for individual events)
    #[serde(default)]
    last_token_usage: Option<CodexTokenUsage>,
    /// Cumulative session token usage (ignored to prevent double-counting)
    #[serde(default)]
    total_token_usage: Option<CodexTokenUsage>,
}

#[derive(Deserialize, Clone)]
struct CodexTokenUsage {
    #[serde(default)]
    input_tokens: Option<u64>,
    #[serde(default)]
    cached_input_tokens: Option<u64>,
    #[serde(default)]
    output_tokens: Option<u64>,
    #[serde(default)]
    reasoning_output_tokens: Option<u64>,
    #[serde(default)]
    total_tokens: Option<u64>,
}

// ---------------------------------------------------------------------------
// Legacy format (older Codex CLI) — flat model/usage/response
// ---------------------------------------------------------------------------

#[derive(Deserialize, Clone)]
struct LegacyCodexEntry {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<LegacyCodexUsage>,
    #[serde(default)]
    response: Option<LegacyCodexResponse>,
    #[serde(default)]
    choices: Option<Vec<LegacyCodexChoice>>,
    #[serde(default)]
    timestamp: Option<String>,
}

#[derive(Deserialize, Clone)]
struct LegacyCodexUsage {
    #[serde(default, alias = "prompt_tokens")]
    prompt_tokens: Option<u64>,
    #[serde(default, alias = "completion_tokens")]
    completion_tokens: Option<u64>,
    #[serde(default, alias = "total_tokens")]
    total_tokens: Option<u64>,
    #[serde(default, alias = "input_tokens")]
    input_tokens: Option<u64>,
    #[serde(default, alias = "output_tokens")]
    output_tokens: Option<u64>,
    #[serde(default, alias = "cache_read_input_tokens")]
    cache_read_tokens: Option<u64>,
    #[serde(default, rename = "cache_creation_input_tokens")]
    cache_write_tokens: Option<u64>,
}

#[derive(Deserialize, Clone)]
struct LegacyCodexResponse {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<LegacyCodexUsage>,
}

#[derive(Deserialize, Clone)]
struct LegacyCodexChoice {
    #[serde(default)]
    message: Option<LegacyCodexMessage>,
}

#[derive(Deserialize, Clone)]
struct LegacyCodexMessage {
    #[serde(default)]
    model: Option<String>,
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

pub struct CodexCliParser;

fn split_codex_input_cache(raw_input: u64, cached_input: u64) -> (u64, u64) {
    (raw_input.saturating_sub(cached_input), cached_input)
}

impl AgentParser for CodexCliParser {
    fn agent_id(&self) -> AgentId {
        AgentId::CodexCli
    }

    fn data_directories(&self) -> Vec<PathBuf> {
        vec![dirs::home_dir()
            .unwrap_or_default()
            .join(".codex")
            .join("sessions")]
    }

    fn file_patterns(&self) -> Vec<&str> {
        vec!["**/*.jsonl", "**/*.json"]
    }

    fn parse_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        match ext {
            "jsonl" => self.parse_jsonl(path),
            "json" => self.parse_json_file(path),
            _ => Ok(Vec::new()),
        }
    }
}

impl CodexCliParser {
    /// Parse new-style Codex CLI session JSONL (>= 0.132.0).
    ///
    /// The file is a sequence of typed events. We track `model` (from
    /// `turn_context`) and `provider` (from `session_meta`) across lines,
    /// then emit a `TokenEvent` each time we hit an `event_msg` whose
    /// `payload.type` is `"token_count"`, using `last_token_usage` (the
    /// per-turn increment) to avoid double-counting.
    fn parse_jsonl(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let file =
            fs::File::open(path).map_err(|e| format!("Cannot open {}: {}", path.display(), e))?;
        let reader = BufReader::new(file);
        let mut events = Vec::new();

        let session_id = path.file_stem().map(|s| s.to_string_lossy().to_string());

        // State tracked across lines in this session file
        let mut current_model: Option<String> = None;
        let mut provider: String = "openai".to_string();

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            if line.trim().is_empty() {
                continue;
            }

            // Try new format first
            let entry: CodexSessionLine = match serde_json::from_str(&line) {
                Ok(e) => e,
                Err(_) => {
                    // Fall back to legacy format
                    if let Ok(legacy) = serde_json::from_str::<LegacyCodexEntry>(&line) {
                        if let Some(event) = self.legacy_entry_to_event(&legacy, &session_id) {
                            events.push(event);
                        }
                    }
                    continue;
                }
            };

            match entry.line_type.as_deref() {
                Some("session_meta") => {
                    if let Some(ref p) = entry.payload {
                        if let Some(ref mp) = p.model_provider {
                            provider = mp.clone();
                        }
                    }
                }
                Some("turn_context") => {
                    if let Some(ref p) = entry.payload {
                        if let Some(ref m) = p.model {
                            current_model = Some(m.clone());
                        }
                    }
                }
                Some("event_msg") => {
                    if let Some(ref p) = entry.payload {
                        if p.payload_type.as_deref() == Some("token_count") {
                            if let Some(ref info) = p.info {
                                // Prefer per-turn usage; fall back to cumulative
                                let usage = info
                                    .last_token_usage
                                    .as_ref()
                                    .or(info.total_token_usage.as_ref());

                                if let Some(u) = usage {
                                    let input = u.input_tokens.unwrap_or(0);
                                    let output = u.output_tokens.unwrap_or(0);
                                    let total = u.total_tokens.unwrap_or(0);

                                    let cache_read_tokens = u.cached_input_tokens.unwrap_or(0);
                                    let (input_tokens, output_tokens) = if input == 0
                                        && output == 0
                                        && total > 0
                                    {
                                        ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
                                    } else {
                                        (
                                            split_codex_input_cache(input, cache_read_tokens).0,
                                            output,
                                        )
                                    };

                                    let model = current_model
                                        .clone()
                                        .unwrap_or_else(|| "unknown".to_string());

                                    let timestamp = entry
                                        .timestamp
                                        .as_deref()
                                        .and_then(crate::tokens::parse_iso8601_to_epoch)
                                        .unwrap_or(0);

                                    events.push(TokenEvent {
                                        agent: AgentId::CodexCli,
                                        provider: provider.clone(),
                                        model,
                                        timestamp,
                                        input_tokens,
                                        output_tokens,
                                        cache_read_tokens,
                                        cache_write_tokens: 0,
                                        reasoning_tokens: u.reasoning_output_tokens.unwrap_or(0),
                                        project: None,
                                        session_id: session_id.clone(),
                                    });
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(events)
    }

    /// Parse a standalone JSON file.
    /// Tries the new session-line format, then legacy, then generic.
    fn parse_json_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
        let session_id = path.file_stem().map(|s| s.to_string_lossy().to_string());

        // New format: single session-line object
        if let Ok(entry) = serde_json::from_str::<CodexSessionLine>(&content) {
            let mut events = Vec::new();
            self.process_new_format_line(
                &entry,
                &mut String::from("openai"),
                &mut None,
                &session_id,
                &mut events,
            );
            return Ok(events);
        }

        // New format: array of session-line objects
        if let Ok(entries) = serde_json::from_str::<Vec<CodexSessionLine>>(&content) {
            let mut events = Vec::new();
            let mut current_model: Option<String> = None;
            let mut provider: String = "openai".to_string();
            for entry in &entries {
                self.process_new_format_line(
                    entry,
                    &mut provider,
                    &mut current_model,
                    &session_id,
                    &mut events,
                );
            }
            return Ok(events);
        }

        // Legacy: single entry
        if let Ok(entry) = serde_json::from_str::<LegacyCodexEntry>(&content) {
            if let Some(event) = self.legacy_entry_to_event(&entry, &session_id) {
                return Ok(vec![event]);
            }
            return Ok(Vec::new());
        }

        // Legacy: array of entries
        if let Ok(entries) = serde_json::from_str::<Vec<LegacyCodexEntry>>(&content) {
            let mut events = Vec::new();
            for entry in &entries {
                if let Some(event) = self.legacy_entry_to_event(entry, &session_id) {
                    events.push(event);
                }
            }
            return Ok(events);
        }

        // Generic fallback: walk any JSON object looking for model/usage
        if let Ok(raw) = serde_json::from_str::<serde_json::Value>(&content) {
            return Ok(self.parse_json_value_generic(&raw, &session_id));
        }

        Ok(Vec::new())
    }

    // -- helpers ----------------------------------------------------------

    /// Process one new-format `CodexSessionLine`, updating tracked state
    /// and pushing any token event it produces.
    fn process_new_format_line(
        &self,
        entry: &CodexSessionLine,
        provider: &mut String,
        current_model: &mut Option<String>,
        session_id: &Option<String>,
        events: &mut Vec<TokenEvent>,
    ) {
        match entry.line_type.as_deref() {
            Some("session_meta") => {
                if let Some(ref p) = entry.payload {
                    if let Some(ref mp) = p.model_provider {
                        *provider = mp.clone();
                    }
                }
            }
            Some("turn_context") => {
                if let Some(ref p) = entry.payload {
                    if let Some(ref m) = p.model {
                        *current_model = Some(m.clone());
                    }
                }
            }
            Some("event_msg") => {
                if let Some(ref p) = entry.payload {
                    if p.payload_type.as_deref() == Some("token_count") {
                        if let Some(ref info) = p.info {
                            let usage = info
                                .last_token_usage
                                .as_ref()
                                .or(info.total_token_usage.as_ref());

                            if let Some(u) = usage {
                                let input = u.input_tokens.unwrap_or(0);
                                let output = u.output_tokens.unwrap_or(0);
                                let total = u.total_tokens.unwrap_or(0);

                                let cache_read_tokens = u.cached_input_tokens.unwrap_or(0);
                                let (input_tokens, output_tokens) = if input == 0
                                    && output == 0
                                    && total > 0
                                {
                                    ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
                                } else {
                                    (split_codex_input_cache(input, cache_read_tokens).0, output)
                                };

                                let model = current_model
                                    .clone()
                                    .unwrap_or_else(|| "unknown".to_string());

                                let timestamp = entry
                                    .timestamp
                                    .as_deref()
                                    .and_then(crate::tokens::parse_iso8601_to_epoch)
                                    .unwrap_or(0);

                                events.push(TokenEvent {
                                    agent: AgentId::CodexCli,
                                    provider: provider.clone(),
                                    model,
                                    timestamp,
                                    input_tokens,
                                    output_tokens,
                                    cache_read_tokens,
                                    cache_write_tokens: 0,
                                    reasoning_tokens: u.reasoning_output_tokens.unwrap_or(0),
                                    project: None,
                                    session_id: session_id.clone(),
                                });
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    /// Convert a legacy-format entry into a TokenEvent (if it has usage data).
    fn legacy_entry_to_event(
        &self,
        entry: &LegacyCodexEntry,
        session_id: &Option<String>,
    ) -> Option<TokenEvent> {
        let model = entry
            .model
            .clone()
            .or_else(|| entry.response.as_ref().and_then(|r| r.model.clone()))
            .or_else(|| {
                entry
                    .choices
                    .as_ref()
                    .and_then(|c| c.first())
                    .and_then(|ch| ch.message.as_ref())
                    .and_then(|m| m.model.clone())
            })
            .unwrap_or_else(|| "unknown".to_string());

        let usage = entry
            .usage
            .clone()
            .or_else(|| entry.response.as_ref().and_then(|r| r.usage.clone()))?;

        let input = usage.prompt_tokens.or(usage.input_tokens).unwrap_or(0);
        let output = usage.completion_tokens.or(usage.output_tokens).unwrap_or(0);
        let total = usage.total_tokens.unwrap_or(0);

        let cache_read_tokens = usage.cache_read_tokens.unwrap_or(0);
        let (input_tokens, output_tokens) = if input == 0 && output == 0 && total > 0 {
            ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
        } else {
            (split_codex_input_cache(input, cache_read_tokens).0, output)
        };

        let timestamp = entry
            .timestamp
            .as_deref()
            .and_then(crate::tokens::parse_iso8601_to_epoch)
            .unwrap_or(0);

        Some(TokenEvent {
            agent: AgentId::CodexCli,
            provider: "openai".to_string(),
            model,
            timestamp,
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_write_tokens: usage.cache_write_tokens.unwrap_or(0),
            reasoning_tokens: 0,
            project: None,
            session_id: session_id.clone(),
        })
    }

    /// Generic fallback: walk an arbitrary JSON value looking for model + usage.
    fn parse_json_value_generic(
        &self,
        value: &serde_json::Value,
        session_id: &Option<String>,
    ) -> Vec<TokenEvent> {
        let model = value
            .get("model")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                value
                    .get("response")
                    .and_then(|r| r.get("model"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            });

        let usage = value
            .get("usage")
            .or_else(|| value.get("response").and_then(|r| r.get("usage")));

        if let (Some(model), Some(usage)) = (model, usage) {
            let input = usage
                .get("input_tokens")
                .or_else(|| usage.get("prompt_tokens"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let output = usage
                .get("output_tokens")
                .or_else(|| usage.get("completion_tokens"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let total = usage
                .get("total_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            let cr = usage
                .get("cache_read_tokens")
                .or_else(|| usage.get("cache_read_input_tokens"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let (input_tokens, output_tokens) = if input == 0 && output == 0 && total > 0 {
                ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
            } else {
                (split_codex_input_cache(input, cr).0, output)
            };

            let cw = usage
                .get("cache_write_tokens")
                .or_else(|| usage.get("cache_creation_input_tokens"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            let timestamp = value
                .get("timestamp")
                .and_then(|v| v.as_str())
                .and_then(crate::tokens::parse_iso8601_to_epoch)
                .unwrap_or(0);

            vec![TokenEvent {
                agent: AgentId::CodexCli,
                provider: "openai".to_string(),
                model,
                timestamp,
                input_tokens,
                output_tokens,
                cache_read_tokens: cr,
                cache_write_tokens: cw,
                reasoning_tokens: 0,
                project: None,
                session_id: session_id.clone(),
            }]
        } else {
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::parsers::AgentParser;
    use std::fs;
    use std::path::PathBuf;

    fn temp_file(name: &str, ext: &str, content: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "felina_codex_parser_{}_{}.{}",
            name,
            std::process::id(),
            ext
        ));
        let _ = fs::remove_file(&path);
        fs::write(&path, content).expect("write fixture");
        path
    }

    #[test]
    fn new_format_subtracts_cached_input_from_raw_codex_input() {
        let path = temp_file(
            "cached_input",
            "jsonl",
            r#"{"timestamp":"2026-05-26T02:10:45.870Z","type":"turn_context","payload":{"model":"gpt-5.5"}}"#
                .to_string()
                .as_str(),
        );
        fs::write(
            &path,
            concat!(
                r#"{"timestamp":"2026-05-26T02:10:45.870Z","type":"turn_context","payload":{"model":"gpt-5.5"}}"#,
                "\n",
                r#"{"timestamp":"2026-05-26T02:10:45.870Z","type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":228220,"cached_input_tokens":227200,"output_tokens":48,"reasoning_output_tokens":0,"total_tokens":228268}}}}"#,
                "\n"
            ),
        )
        .expect("write fixture");

        let events = CodexCliParser.parse_file(&path).expect("parse");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].input_tokens, 1_020);
        assert_eq!(events[0].cache_read_tokens, 227_200);
        assert_eq!(events[0].output_tokens, 48);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn cached_input_normalization_saturates_when_cache_exceeds_input() {
        assert_eq!(split_codex_input_cache(100, 150), (0, 150));
    }
}
