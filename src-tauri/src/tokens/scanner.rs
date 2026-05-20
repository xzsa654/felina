use rayon::prelude::*;
use walkdir::WalkDir;

use crate::tokens::parsers::{AgentParser, ParserRegistry};
use crate::tokens::types::TokenEvent;

const MAX_FILES_PER_SCAN: usize = 50;

pub struct TokenScanner {
    registry: ParserRegistry,
}

impl TokenScanner {
    pub fn new(registry: ParserRegistry) -> Self {
        TokenScanner { registry }
    }

    /// Scan all available agents in parallel, returning all token events.
    pub fn scan_all(&self) -> Result<Vec<TokenEvent>, String> {
        let parsers = self.registry.available_parsers();

        let events: Vec<TokenEvent> = parsers
            .par_iter()
            .flat_map(|parser| self.scan_parser(*parser))
            .collect();

        Ok(events)
    }

    /// Scan a date range (filter by timestamp if source provides it).
    pub fn scan_date_range(&self, _start: i64, _end: i64) -> Result<Vec<TokenEvent>, String> {
        let events = self.scan_all()?;
        Ok(events
            .into_iter()
            .filter(|e| e.timestamp >= _start && e.timestamp <= _end)
            .collect())
    }

    fn scan_parser(&self, parser: &dyn AgentParser) -> Vec<TokenEvent> {
        let mut events = Vec::new();

        for dir in parser.data_directories() {
            if !dir.exists() {
                continue;
            }

            // Collect file extensions from glob patterns (e.g. "**/*.jsonl" -> "jsonl")
            let extensions: Vec<&str> = parser
                .file_patterns()
                .iter()
                .filter_map(|p| {
                    if let Some(idx) = p.rfind('.') {
                        Some(&p[idx + 1..])
                    } else {
                        None
                    }
                })
                .collect();

            // Collect matching files with their mtime for sorting
            let mut files: Vec<_> = WalkDir::new(&dir)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| {
                    let path = e.path();
                    extensions.iter().any(|ext| {
                        path.extension()
                            .and_then(|ex| ex.to_str())
                            .map(|ex| ex == *ext)
                            .unwrap_or(false)
                    })
                })
                .filter_map(|e| {
                    let path = e.path().to_path_buf();
                    let mtime = e.metadata().ok()?.modified().ok()?;
                    Some((path, mtime))
                })
                .collect();

            // Sort by mtime descending (most recent first), limit to MAX_FILES_PER_SCAN
            files.sort_by(|a, b| b.1.cmp(&a.1));
            let limit = MAX_FILES_PER_SCAN.min(files.len());

            // Process limited files (no rayon needed — limited to 50)
            for (path, mtime) in files.into_iter().take(limit) {
                let ts = mtime
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                match parser.parse_file(&path) {
                    Ok(mut file_events) => {
                        // Use file mtime only as fallback when parser didn't set a timestamp
                        for ev in &mut file_events {
                            if ev.timestamp == 0 {
                                ev.timestamp = ts;
                            }
                        }
                        events.extend(file_events);
                    }
                    Err(err) => {
                        eprintln!(
                            "TokenScanner: error parsing {}: {}",
                            path.display(),
                            err
                        );
                    }
                }
            }
        }

        events
    }
}
