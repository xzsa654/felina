use std::path::PathBuf;

use crate::tokens::types::{AgentId, TokenEvent};

/// Each supported AI coding agent implements this trait.
pub trait AgentParser: Send + Sync {
    /// Human-readable agent identifier.
    fn agent_id(&self) -> AgentId;
    /// Data directories this agent stores its data in.
    fn data_directories(&self) -> Vec<PathBuf>;
    /// File glob patterns to scan (e.g. "**/*.jsonl", "**/*.db").
    fn file_patterns(&self) -> Vec<&str>;
    /// Parse a single file into TokenEvents.
    fn parse_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String>;
    /// Whether this agent is detected as installed.
    fn is_available(&self) -> bool {
        self.data_directories().iter().any(|d| d.exists())
    }
}

/// Registry of all available parsers.
pub struct ParserRegistry {
    parsers: Vec<Box<dyn AgentParser>>,
}

impl ParserRegistry {
    pub fn new() -> Self {
        ParserRegistry {
            parsers: Vec::new(),
        }
    }

    /// Register a parser.
    pub fn register(&mut self, parser: Box<dyn AgentParser>) {
        self.parsers.push(parser);
    }

    /// Return parsers whose agent is detected as installed.
    pub fn available_parsers(&self) -> Vec<&dyn AgentParser> {
        self.parsers
            .iter()
            .filter(|p| p.is_available())
            .map(|p| p.as_ref())
            .collect()
    }

    /// Look up a parser by agent ID.
    pub fn get_parser(&self, agent: &AgentId) -> Option<&dyn AgentParser> {
        self.parsers
            .iter()
            .find(|p| p.agent_id() == *agent)
            .map(|p| p.as_ref())
    }

    /// Return all registered parsers (available or not).
    pub fn all_parsers(&self) -> &Vec<Box<dyn AgentParser>> {
        &self.parsers
    }
}

impl Default for ParserRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// Declare sub-modules
pub mod claude_code;
pub mod codex_cli;
pub mod gemini_cli;
