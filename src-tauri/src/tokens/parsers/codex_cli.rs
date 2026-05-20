use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

use serde::Deserialize;

use crate::tokens::parsers::AgentParser;
use crate::tokens::types::{AgentId, TokenEvent};

/// Partial parse of a Codex CLI session JSONL line or JSON entry.
#[derive(Deserialize, Clone)]
struct CodexEntry {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<CodexUsage>,
    /// Some formats nest usage under a root-level field
    #[serde(default)]
    response: Option<CodexResponse>,
    #[serde(default)]
    choices: Option<Vec<CodexChoice>>,
    #[serde(default)]
    timestamp: Option<String>,
}

#[derive(Deserialize, Clone)]
struct CodexUsage {
    /// OpenAI-style field names
    #[serde(default, alias = "prompt_tokens")]
    prompt_tokens: Option<u64>,
    #[serde(default, alias = "completion_tokens")]
    completion_tokens: Option<u64>,
    #[serde(default, alias = "total_tokens")]
    total_tokens: Option<u64>,
    /// Anthropic-style field names
    #[serde(default, alias = "input_tokens")]
    input_tokens: Option<u64>,
    #[serde(default, alias = "output_tokens")]
    output_tokens: Option<u64>,
    /// Cache tokens
    #[serde(default, alias = "cache_read_input_tokens")]
    cache_read_tokens: Option<u64>,
    #[serde(default, rename = "cache_creation_input_tokens")]
    cache_write_tokens: Option<u64>,
}

#[derive(Deserialize, Clone)]
struct CodexResponse {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<CodexUsage>,
}

#[derive(Deserialize, Clone)]
struct CodexChoice {
    #[serde(default)]
    message: Option<CodexMessage>,
}

#[derive(Deserialize, Clone)]
struct CodexMessage {
    #[serde(default)]
    model: Option<String>,
}

pub struct CodexCliParser;

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
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match ext {
            "jsonl" => self.parse_jsonl(path),
            "json" => self.parse_json_file(path),
            _ => Ok(Vec::new()),
        }
    }
}

impl CodexCliParser {
    fn parse_jsonl(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let file = fs::File::open(path)
            .map_err(|e| format!("Cannot open {}: {}", path.display(), e))?;
        let reader = BufReader::new(file);
        let mut events = Vec::new();

        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string());

        for line in reader.lines().take(500) {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            if line.trim().is_empty() {
                continue;
            }

            let entry: CodexEntry = match serde_json::from_str(&line) {
                Ok(e) => e,
                Err(_) => continue,
            };

            let model = entry
                .model
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
                .or_else(|| entry.response.as_ref().and_then(|r| r.usage.clone()));

            if let Some(u) = usage {
                let input = u
                    .prompt_tokens
                    .or(u.input_tokens)
                    .unwrap_or(0);
                let output = u
                    .completion_tokens
                    .or(u.output_tokens)
                    .unwrap_or(0);
                let total = u.total_tokens.unwrap_or(0);

                // If we only have total but not input/output split,
                // estimate input≈70%, output≈30% of non-zero total
                let (input_tokens, output_tokens) = if input == 0 && output == 0 && total > 0 {
                    ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
                } else {
                    // If total is given but matches input+output, fine;
                    // if input/output is given but total differs, trust input/output
                    (input, output)
                };

                let timestamp = entry
                    .timestamp
                    .as_deref()
                    .and_then(crate::tokens::parse_iso8601_to_epoch)
                    .unwrap_or(0);

                events.push(TokenEvent {
                    agent: AgentId::CodexCli,
                    provider: "openai".to_string(),
                    model,
                    timestamp,
                    input_tokens,
                    output_tokens,
                    cache_read_tokens: u.cache_read_tokens.unwrap_or(0),
                    cache_write_tokens: u.cache_write_tokens.unwrap_or(0),
                    reasoning_tokens: 0,
                    project: None,
                    session_id: session_id.clone(),
                });
            }
        }

        Ok(events)
    }

    fn parse_json_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;

        // Try parsing as a single JSON object or array
        if let Ok(entry) = serde_json::from_str::<CodexEntry>(&content) {
            return self.entry_to_events(&entry, path);
        }

        // Try parsing as an array of entries
        if let Ok(entries) = serde_json::from_str::<Vec<CodexEntry>>(&content) {
            let mut events = Vec::new();
            for entry in entries {
                events.extend(self.entry_to_events(&entry, path)?);
            }
            return Ok(events);
        }

        // Generic: try any JSON object with potential model/usage fields
        if let Ok(raw) =
            serde_json::from_str::<serde_json::Value>(&content)
        {
            return Ok(self.parse_json_value(&raw, path));
        }

        Ok(Vec::new())
    }

    fn entry_to_events(
        &self,
        entry: &CodexEntry,
        path: &PathBuf,
    ) -> Result<Vec<TokenEvent>, String> {
        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string());

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
            .or_else(|| entry.response.as_ref().and_then(|r| r.usage.clone()));

        if let Some(u) = usage {
            let input = u.prompt_tokens.or(u.input_tokens).unwrap_or(0);
            let output = u.completion_tokens.or(u.output_tokens).unwrap_or(0);
            let total = u.total_tokens.unwrap_or(0);

            let (input_tokens, output_tokens) = if input == 0 && output == 0 && total > 0 {
                ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
            } else {
                (input, output)
            };

            let timestamp = entry
                .timestamp
                .as_deref()
                .and_then(crate::tokens::parse_iso8601_to_epoch)
                .unwrap_or(0);

            Ok(vec![TokenEvent {
                agent: AgentId::CodexCli,
                provider: "openai".to_string(),
                model,
                timestamp,
                input_tokens,
                output_tokens,
                cache_read_tokens: u.cache_read_tokens.unwrap_or(0),
                cache_write_tokens: u.cache_write_tokens.unwrap_or(0),
                reasoning_tokens: 0,
                project: None,
                session_id,
            }])
        } else {
            Ok(Vec::new())
        }
    }

    fn parse_json_value(
        &self,
        value: &serde_json::Value,
        path: &PathBuf,
    ) -> Vec<TokenEvent> {
        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string());

        // Try to find model and usage at any nesting level
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

        let usage = value.get("usage").or_else(|| {
            value.get("response").and_then(|r| r.get("usage"))
        });

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

            let (input_tokens, output_tokens) = if input == 0 && output == 0 && total > 0 {
                ((total as f64 * 0.7) as u64, (total as f64 * 0.3) as u64)
            } else {
                (input, output)
            };

            let cr = usage
                .get("cache_read_tokens")
                .or_else(|| usage.get("cache_read_input_tokens"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
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
                session_id,
            }]
        } else {
            Vec::new()
        }
    }
}
