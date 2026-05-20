use std::path::PathBuf;

use crate::tokens::parsers::AgentParser;
use crate::tokens::types::{AgentId, TokenEvent};

pub struct GeminiCliParser;

impl AgentParser for GeminiCliParser {
    fn agent_id(&self) -> AgentId {
        AgentId::GeminiCli
    }

    fn data_directories(&self) -> Vec<PathBuf> {
        vec![dirs::home_dir()
            .unwrap_or_default()
            .join(".gemini")
            .join("tmp")]
    }

    fn file_patterns(&self) -> Vec<&str> {
        vec!["**/*.json"]
    }

    fn parse_file(&self, _path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
        // TODO: Implement Gemini CLI parsing in Phase 3
        Ok(Vec::new())
    }
}
