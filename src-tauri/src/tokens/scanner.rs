use rayon::prelude::*;
use walkdir::WalkDir;

use crate::tokens::parsers::{AgentParser, ParserRegistry};
use crate::tokens::scan_state::ScanState;
use crate::tokens::types::{ScanError, TokenEvent};

/// Output from a scanner run.
pub struct ScanOutput {
    pub events: Vec<TokenEvent>,
    pub files_scanned: u64,
    pub files_skipped: u64,
    pub errors: Vec<ScanError>,
    pub agents_scanned: u32,
}

pub struct TokenScanner {
    registry: ParserRegistry,
}

impl TokenScanner {
    pub fn new(registry: ParserRegistry) -> Self {
        TokenScanner { registry }
    }

    /// Scan all available agents incrementally, using persisted cursors to
    /// determine which files need processing.
    /// Returns Err on system-level errors (e.g. scan state read/write failure).
    /// Parse errors are collected per-file in ScanOutput.errors.
    pub fn scan_all(&self, scan_state: &ScanState) -> Result<ScanOutput, String> {
        let parsers = self.registry.available_parsers();

        let results: Vec<Result<ScanOutput, String>> = parsers
            .par_iter()
            .map(|parser| self.scan_parser(*parser, scan_state))
            .collect();

        let mut all_events = Vec::new();
        let mut total_scanned = 0u64;
        let mut total_skipped = 0u64;
        let mut all_errors = Vec::new();

        for r in results {
            match r {
                Ok(output) => {
                    all_events.extend(output.events);
                    total_scanned += output.files_scanned;
                    total_skipped += output.files_skipped;
                    all_errors.extend(output.errors);
                }
                Err(system_err) => {
                    // Propagate system-level errors immediately
                    return Err(system_err);
                }
            }
        }

        // Track agents_scanned as the count of parsers actually scanned
        let agents_scanned = parsers.len() as u32;

        Ok(ScanOutput {
            events: all_events,
            files_scanned: total_scanned,
            files_skipped: total_skipped,
            errors: all_errors,
            agents_scanned,
        })
    }

    /// Scan a date range (filter by timestamp after the full scan).
    pub fn scan_date_range(
        &self,
        scan_state: &ScanState,
        _start: i64,
        _end: i64,
    ) -> Result<ScanOutput, String> {
        let output = self.scan_all(scan_state)?;
        let filtered: Vec<TokenEvent> = output
            .events
            .into_iter()
            .filter(|e| e.timestamp >= _start && e.timestamp <= _end)
            .collect();
        let agents_scanned = output.agents_scanned;
        Ok(ScanOutput {
            events: filtered,
            agents_scanned,
            ..output
        })
    }

    fn scan_parser(
        &self,
        parser: &dyn AgentParser,
        scan_state: &ScanState,
    ) -> Result<ScanOutput, String> {
        let agent = parser.agent_id();
        let mut events = Vec::new();
        let mut files_scanned = 0u64;
        let mut files_skipped = 0u64;
        let mut errors = Vec::new();
        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        for dir in parser.data_directories() {
            if !dir.exists() {
                continue;
            }

            let source_key = dir.to_string_lossy().to_string();

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

            // Collect matching files with their mtime
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
                    let mtime = e
                        .metadata()
                        .ok()?
                        .modified()
                        .ok()?
                        .duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| d.as_secs() as i64)?;
                    Some((path, mtime))
                })
                .collect();

            // Look up the cursor for this agent+source
            let cursor = scan_state.get_cursor(&agent, &source_key).map_err(|e| {
                format!(
                    "Failed to read scan cursor for {} at {}: {}",
                    agent, source_key, e
                )
            })?;

            // Track the max mtime among successfully processed files for cursor update.
            // Initialize from existing cursor so that if there are parse errors we don't
            // regress below the previous successful position.
            let prev_cursor_mtime = cursor.as_ref().map(|c| c.last_mtime).unwrap_or(0);
            let mut max_processed_mtime = prev_cursor_mtime;

            // Sort by mtime ascending for stable processing
            files.sort_by(|a, b| a.1.cmp(&b.1));

            // Track whether this source had any parse errors so we can decide
            // whether it's safe to advance the cursor.
            let mut source_had_errors = false;
            // Collect errors for THIS directory only; never bleed errors from a
            // previous directory into the current source key.
            let mut dir_errors: Vec<ScanError> = Vec::new();

            for (path, file_mtime) in files {
                // Decide whether to scan: scan if mtime > cursor mtime, or if no cursor exists
                let should_scan = match &cursor {
                    None => true,
                    Some(c) => file_mtime > c.last_mtime,
                };

                if !should_scan {
                    files_skipped += 1;
                    continue;
                }

                files_scanned += 1;
                match parser.parse_file(&path) {
                    Ok(mut file_events) => {
                        // Use file mtime only as fallback when parser didn't set a timestamp
                        for ev in &mut file_events {
                            if ev.timestamp == 0 {
                                ev.timestamp = file_mtime;
                            }
                        }
                        events.extend(file_events);
                        if file_mtime > max_processed_mtime {
                            max_processed_mtime = file_mtime;
                        }
                    }
                    Err(err) => {
                        source_had_errors = true;
                        dir_errors.push(ScanError {
                            agent: agent.clone(),
                            source: path.to_string_lossy().to_string(),
                            message: err,
                        });
                    }
                }
            }

            // Always persist the scan attempt timestamp for this source so that
            // last_scanned reflects the most recent refresh, not just the last
            // refresh that found new files.
            // IMPORTANT: if this source had any parse errors, DO NOT advance the
            // cursor mtime — the failed file(s) must be retried on the next refresh.
            // See design.md: "Do not advance cursor past failed files".
            let cursor_mtime = if source_had_errors {
                prev_cursor_mtime
            } else {
                max_processed_mtime
            };
            scan_state
                .upsert_cursor(&agent, &source_key, cursor_mtime, now_ts)
                .map_err(|e| {
                    format!(
                        "Failed to persist scan cursor for {} at {}: {}",
                        agent, source_key, e
                    )
                })?;

            // Record the last error for THIS directory only.
            // Using dir_errors (not the outer errors vec) prevents a prior
            // directory's error from being attributed to a later clean directory.
            if let Some(last_err) = dir_errors.last() {
                scan_state
                    .upsert_error(&agent, &source_key, &last_err.message)
                    .map_err(|e| {
                        format!(
                            "Failed to persist error summary for {} at {}: {}",
                            agent, source_key, e
                        )
                    })?;
            }

            errors.extend(dir_errors);
        }

        Ok(ScanOutput {
            events,
            files_scanned,
            files_skipped,
            errors,
            agents_scanned: 1,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::parsers::ParserRegistry;
    use crate::tokens::scan_state::ScanState;
    use crate::tokens::types::AgentId;
    use std::fs;
    use std::io::Write;
    use std::path::PathBuf;

    /// Return a per-test temp DB path that will never collide with the real
    /// ~/.felina/tokens.db or with other tests running in parallel.
    fn temp_db(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("glyphic_scanner_{}.db", name))
    }

    fn cleanup_db(path: &PathBuf) {
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    /// A minimal parser for testing that reads mock JSONL files.
    struct TestParser {
        agent: AgentId,
        dirs: Vec<PathBuf>,
    }

    impl AgentParser for TestParser {
        fn agent_id(&self) -> AgentId {
            self.agent.clone()
        }
        fn data_directories(&self) -> Vec<PathBuf> {
            self.dirs.clone()
        }
        fn file_patterns(&self) -> Vec<&str> {
            vec!["**/*.jsonl"]
        }
        fn parse_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
            let content = fs::read_to_string(path).map_err(|e| format!("read error: {}", e))?;
            let mut events = Vec::new();
            for line in content.lines() {
                if line.trim().is_empty() {
                    continue;
                }
                let ev: TokenEvent =
                    serde_json::from_str(line).map_err(|e| format!("json error: {}", e))?;
                events.push(ev);
            }
            Ok(events)
        }
    }

    fn make_event(ts: i64, input: u64, output: u64) -> TokenEvent {
        TokenEvent {
            agent: AgentId::ClaudeCode,
            provider: "anthropic".into(),
            model: "claude-sonnet".into(),
            timestamp: ts,
            input_tokens: input,
            output_tokens: output,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            project: None,
            session_id: None,
        }
    }

    #[test]
    fn test_seventy_five_changed_files_are_all_scanned() {
        let tmp = std::env::temp_dir().join("glyphic_test_75files");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        for i in 0..75 {
            let path = tmp.join(format!("conv_{:03}.jsonl", i));
            let ev = make_event(now - 3600 + i as i64, 100 + i, 50 + i);
            let line = serde_json::to_string(&ev).unwrap();
            let mut f = fs::File::create(&path).unwrap();
            writeln!(f, "{}", line).unwrap();
        }

        let parser = TestParser {
            agent: AgentId::ClaudeCode,
            dirs: vec![tmp.clone()],
        };

        let db = temp_db("seventy_five_files");
        cleanup_db(&db);
        let scan_state = ScanState::with_path(db.clone()).unwrap();
        let mut registry = ParserRegistry::new();
        registry.register(Box::new(parser));
        let scanner = TokenScanner::new(registry);

        let output = scanner
            .scan_all(&scan_state)
            .expect("scan_all should succeed");
        assert_eq!(
            output.files_scanned, 75,
            "All 75 changed files should be scanned, got {}",
            output.files_scanned
        );
        assert_eq!(output.events.len(), 75);

        cleanup_db(&db);
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_old_file_with_new_events_is_rescanned() {
        let tmp = std::env::temp_dir().join("glyphic_test_oldfile");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Create 3 files
        for i in 0..3 {
            let path = tmp.join(format!("conv_{:03}.jsonl", i));
            let ev = make_event(now - 3600 + i as i64, 100 + i, 50 + i);
            let line = serde_json::to_string(&ev).unwrap();
            let mut f = fs::File::create(&path).unwrap();
            writeln!(f, "{}", line).unwrap();
        }

        let make_parser = || TestParser {
            agent: AgentId::ClaudeCode,
            dirs: vec![tmp.clone()],
        };

        let db = temp_db("old_file_rescan");
        cleanup_db(&db);

        // First scan: all 3 files should be scanned
        {
            let scan_state = ScanState::with_path(db.clone()).unwrap();
            let mut registry = ParserRegistry::new();
            registry.register(Box::new(make_parser()));
            let scanner = TokenScanner::new(registry);
            let output = scanner
                .scan_all(&scan_state)
                .expect("First scan should succeed");
            assert_eq!(output.files_scanned, 3);
            assert_eq!(output.events.len(), 3);
            // scan_state is dropped — simulates end of first refresh
        }

        // Wait to ensure mtime crosses a second boundary
        std::thread::sleep(std::time::Duration::from_secs(2));

        // Modify the oldest file (conv_000.jsonl) by appending a new event
        let path = tmp.join("conv_000.jsonl");
        let new_ev = make_event(now + 1, 999, 888);
        let new_line = serde_json::to_string(&new_ev).unwrap();
        {
            let mut f = fs::OpenOptions::new().append(true).open(&path).unwrap();
            writeln!(f, "{}", new_line).unwrap();
        }

        // Second scan: only the modified file should be scanned
        {
            let scan_state = ScanState::with_path(db.clone()).unwrap();
            let mut registry = ParserRegistry::new();
            registry.register(Box::new(make_parser()));
            let scanner = TokenScanner::new(registry);
            let output = scanner
                .scan_all(&scan_state)
                .expect("Second scan should succeed");

            assert_eq!(
                output.files_scanned, 1,
                "Only the modified file should be scanned"
            );
            assert_eq!(output.files_skipped, 2);
            assert!(
                output.events.len() >= 1,
                "Should have at least the new event"
            );
            let has_new = output
                .events
                .iter()
                .any(|e| e.input_tokens == 999 && e.output_tokens == 888);
            assert!(has_new, "The new event should be in the parsed events");
        }

        cleanup_db(&db);
        let _ = fs::remove_dir_all(&tmp);
    }

    /// A parser that fails for files containing "bad" in the name.
    struct FailingTestParser {
        agent: AgentId,
        dirs: Vec<PathBuf>,
    }

    impl AgentParser for FailingTestParser {
        fn agent_id(&self) -> AgentId {
            self.agent.clone()
        }
        fn data_directories(&self) -> Vec<PathBuf> {
            self.dirs.clone()
        }
        fn file_patterns(&self) -> Vec<&str> {
            vec!["**/*.jsonl"]
        }
        fn parse_file(&self, path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
            let filename = path.file_name().unwrap_or_default().to_string_lossy();
            if filename.contains("bad") {
                return Err(format!("simulated parse error in {}", filename));
            }
            let content = fs::read_to_string(path).map_err(|e| format!("read error: {}", e))?;
            let mut events = Vec::new();
            for line in content.lines() {
                if line.trim().is_empty() {
                    continue;
                }
                let ev: TokenEvent =
                    serde_json::from_str(line).map_err(|e| format!("json error: {}", e))?;
                events.push(ev);
            }
            Ok(events)
        }
    }

    #[test]
    fn test_bad_file_error_collected_others_continue() {
        let tmp = std::env::temp_dir().join("glyphic_test_badfile");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let good_files = ["conv_001.jsonl", "conv_002.jsonl"];
        let bad_file = "conv_bad.jsonl";

        for name in &good_files {
            let path = tmp.join(name);
            let ev = make_event(now, 100, 50);
            let line = serde_json::to_string(&ev).unwrap();
            fs::write(&path, line).unwrap();
        }
        fs::write(tmp.join(bad_file), "{}").unwrap();

        let parser = FailingTestParser {
            agent: AgentId::ClaudeCode,
            dirs: vec![tmp.clone()],
        };

        let db = temp_db("bad_file_collected");
        cleanup_db(&db);
        let scan_state = ScanState::with_path(db.clone()).unwrap();
        let mut registry = ParserRegistry::new();
        registry.register(Box::new(parser));
        let scanner = TokenScanner::new(registry);

        let output = scanner
            .scan_all(&scan_state)
            .expect("scan_all should succeed");

        assert_eq!(output.files_scanned, 3);
        assert_eq!(output.events.len(), 2, "Good files should produce 2 events");
        assert_eq!(output.errors.len(), 1, "Should have 1 parse error");
        let err = &output.errors[0];
        assert_eq!(err.agent, AgentId::ClaudeCode);
        assert!(
            err.source.contains("bad"),
            "Error source should identify the bad file"
        );
        assert!(
            err.message.contains("simulated parse error"),
            "Error message should be descriptive"
        );

        cleanup_db(&db);
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_cursor_not_advanced_past_failed_file() {
        let tmp = std::env::temp_dir().join("glyphic_test_cursor_fail");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Create files with ascending mtimes: conv_001 (old), conv_bad (mid), conv_003 (new)
        let ev = make_event(now, 100, 50);
        let line = serde_json::to_string(&ev).unwrap();

        fs::write(tmp.join("conv_001.jsonl"), &line).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        fs::write(tmp.join("conv_bad.jsonl"), "{}").unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        fs::write(tmp.join("conv_003.jsonl"), &line).unwrap();

        let make_parser = || FailingTestParser {
            agent: AgentId::ClaudeCode,
            dirs: vec![tmp.clone()],
        };

        let db = temp_db("cursor_not_advanced");
        cleanup_db(&db);

        // First scan: bad file fails, newer good file succeeds.
        // Cursor must NOT advance past the bad file.
        let first_scan = {
            let scan_state = ScanState::with_path(db.clone()).unwrap();
            let mut registry = ParserRegistry::new();
            registry.register(Box::new(make_parser()));
            let scanner = TokenScanner::new(registry);
            scanner
                .scan_all(&scan_state)
                .expect("First scan should succeed")
        };
        assert_eq!(first_scan.errors.len(), 1, "Should have 1 parse error");
        assert!(
            first_scan.errors[0].source.contains("bad"),
            "Error should be from the bad file"
        );
        assert_eq!(
            first_scan.events.len(),
            2,
            "Good files should produce 2 events"
        );

        // Second scan: bad file must be retried because cursor was not advanced.
        let second_scan = {
            let scan_state = ScanState::with_path(db.clone()).unwrap();
            let cursor = scan_state
                .get_cursor(&AgentId::ClaudeCode, &tmp.to_string_lossy())
                .expect("get_cursor should succeed");
            assert!(cursor.is_some(), "Cursor should exist (scan was attempted)");
            assert_eq!(
                cursor.unwrap().last_mtime,
                0,
                "Cursor mtime should NOT have advanced past a failed file"
            );

            let mut registry = ParserRegistry::new();
            registry.register(Box::new(make_parser()));
            let scanner = TokenScanner::new(registry);
            scanner
                .scan_all(&scan_state)
                .expect("Second scan should succeed")
        };

        assert!(second_scan.files_scanned > 0, "Files should be rescanned");
        assert_eq!(second_scan.errors.len(), 1, "Bad file should fail again");
        assert!(
            second_scan.errors[0].source.contains("bad"),
            "Error should be from the same bad file"
        );

        cleanup_db(&db);
        let _ = fs::remove_dir_all(&tmp);
    }

    /// A parser that reports as unavailable (for testing coverage).
    struct UnavailableTestParser {
        agent: AgentId,
        dirs: Vec<PathBuf>,
    }

    impl AgentParser for UnavailableTestParser {
        fn agent_id(&self) -> AgentId {
            self.agent.clone()
        }
        fn data_directories(&self) -> Vec<PathBuf> {
            self.dirs.clone()
        }
        fn file_patterns(&self) -> Vec<&str> {
            vec!["**/*.jsonl"]
        }
        fn parse_file(&self, _path: &PathBuf) -> Result<Vec<TokenEvent>, String> {
            Ok(vec![])
        }
        fn is_available(&self) -> bool {
            false
        }
    }

    #[test]
    fn test_agents_scanned_reflects_available_parsers() {
        let tmp = std::env::temp_dir().join("glyphic_test_agents_scanned");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let ev = make_event(1716400000, 100, 50);
        let line = serde_json::to_string(&ev).unwrap();
        fs::write(tmp.join("test.jsonl"), &line).unwrap();

        let db = temp_db("agents_scanned");
        cleanup_db(&db);
        let scan_state = ScanState::with_path(db.clone()).unwrap();
        let mut registry = ParserRegistry::new();
        registry.register(Box::new(TestParser {
            agent: AgentId::ClaudeCode,
            dirs: vec![tmp.clone()],
        }));
        registry.register(Box::new(UnavailableTestParser {
            agent: AgentId::GeminiCli,
            dirs: vec![std::path::PathBuf::from("/nonexistent/path")],
        }));

        let scanner = TokenScanner::new(registry);
        let output = scanner
            .scan_all(&scan_state)
            .expect("scan_all should succeed");

        assert_eq!(
            output.agents_scanned, 1,
            "agents_scanned should be 1 (only the available parser), got {}",
            output.agents_scanned
        );

        cleanup_db(&db);
        let _ = fs::remove_dir_all(&tmp);
    }
}
