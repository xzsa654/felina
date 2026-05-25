use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

use serde::Deserialize;

use crate::tokens::parsers::AgentParser;
use crate::tokens::types::{AgentId, TokenEvent};

/// Partial parse of a conversation JSONL line for usage info.
#[derive(Deserialize)]
struct ConversationLine {
    #[serde(default)]
    message: Option<AssistantMessage>,
    #[serde(default)]
    timestamp: Option<String>,
}

#[derive(Deserialize)]
struct AssistantMessage {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Usage {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default, rename = "cache_read_input_tokens")]
    cache_read_input_tokens: Option<u64>,
    #[serde(default, rename = "cache_creation_input_tokens")]
    cache_creation_input_tokens: Option<u64>,
}

/// Stats cache JSON (from ~/.claude/stats-cache.json).
#[derive(Deserialize)]
struct StatsCache {
    #[serde(default)]
    model_usage: Option<std::collections::HashMap<String, ModelUsageEntry>>,
}

#[derive(Deserialize)]
struct ModelUsageEntry {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
    #[serde(default)]
    cache_creation_input_tokens: u64,
}

pub struct ClaudeCodeParser;

impl AgentParser for ClaudeCodeParser {
    fn agent_id(&self) -> AgentId {
        AgentId::ClaudeCode
    }

    fn data_directories(&self) -> Vec<PathBuf> {
        let home = dirs::home_dir().unwrap_or_default();
        vec![home.join(".claude").join("projects"), home.join(".claude")]
    }

    fn file_patterns(&self) -> Vec<&str> {
        vec!["**/*.jsonl", "stats-cache.json"]
    }

    fn parse_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Handle stats-cache.json separately
        if file_name == "stats-cache.json" {
            return self.parse_stats_cache(path);
        }

        // Regular conversation JSONL
        self.parse_conversation_jsonl(path)
    }

    fn is_available(&self) -> bool {
        self.data_directories().iter().any(|d| d.exists())
    }
}

impl ClaudeCodeParser {
    pub fn new() -> Self {
        ClaudeCodeParser
    }

    fn parse_conversation_jsonl(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let file =
            fs::File::open(path).map_err(|e| format!("Cannot open {}: {}", path.display(), e))?;
        let reader = BufReader::new(file);
        let mut events = Vec::new();

        let project = path
            .parent()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string());

        // Derive session ID from file stem (the UUID filename)
        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .or_else(|| {
                path.parent()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().to_string())
            });

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            if line.trim().is_empty() {
                continue;
            }

            let parsed: ConversationLine = match serde_json::from_str(&line) {
                Ok(p) => p,
                Err(_) => continue,
            };

            if let Some(msg) = parsed.message {
                if let Some(usage) = msg.usage {
                    let model = msg.model.unwrap_or_else(|| "unknown".to_string());
                    let timestamp = parsed
                        .timestamp
                        .as_deref()
                        .and_then(crate::tokens::parse_iso8601_to_epoch)
                        .unwrap_or(0);

                    events.push(TokenEvent {
                        agent: AgentId::ClaudeCode,
                        provider: "anthropic".to_string(),
                        model,
                        timestamp,
                        input_tokens: usage.input_tokens,
                        output_tokens: usage.output_tokens,
                        cache_read_tokens: usage.cache_read_input_tokens.unwrap_or(0),
                        cache_write_tokens: usage.cache_creation_input_tokens.unwrap_or(0),
                        reasoning_tokens: 0,
                        project: project.clone(),
                        session_id: session_id.clone(),
                    });
                }
            }
        }

        Ok(events)
    }

    fn parse_stats_cache(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
        let cache: StatsCache = serde_json::from_str(&content)
            .map_err(|e| format!("Cannot parse stats-cache.json: {}", e))?;

        let mut events = Vec::new();

        if let Some(model_usage) = cache.model_usage {
            for (model, entry) in model_usage {
                // stats-cache doesn't have per-event timestamps, use 0
                events.push(TokenEvent {
                    agent: AgentId::ClaudeCode,
                    provider: "anthropic".to_string(),
                    model,
                    timestamp: 0,
                    input_tokens: entry.input_tokens,
                    output_tokens: entry.output_tokens,
                    cache_read_tokens: entry.cache_read_input_tokens,
                    cache_write_tokens: entry.cache_creation_input_tokens,
                    reasoning_tokens: 0,
                    project: None,
                    session_id: Some("stats-cache".to_string()),
                });
            }
        }

        Ok(events)
    }
}
