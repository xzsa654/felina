use rusqlite::params;
use std::sync::Mutex;

use crate::tokens::pricing::PricingService;
use crate::tokens::storage::TokenStorage;
use crate::tokens::types::*;

fn weekday_name(dow: u8) -> &'static str {
    match dow {
        0 => "Sun",
        1 => "Mon",
        2 => "Tue",
        3 => "Wed",
        4 => "Thu",
        5 => "Fri",
        6 => "Sat",
        _ => "???",
    }
}

pub struct TokenAggregator {
    pub(crate) storage: TokenStorage,
    pub(crate) pricing: Mutex<PricingService>,
}

impl TokenAggregator {
    pub fn new() -> Result<Self, String> {
        let storage = TokenStorage::new()?;
        let pricing = Mutex::new(PricingService::new());
        Ok(TokenAggregator { storage, pricing })
    }

    /// Build a complete analytics response.
    pub fn build_analytics(
        &self,
        granularity: TimeGranularity,
        date_start: Option<i64>,
        date_end: Option<i64>,
        filter_agent: Option<String>,
        filter_model: Option<String>,
    ) -> Result<TokenAnalytics, String> {
        let conn = self
            .storage
            .connection()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        // Build WHERE clause fragments
        let mut conditions = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref agent) = filter_agent {
            conditions.push(format!("agent = ?{}", param_values.len() + 1));
            param_values.push(Box::new(agent.clone()));
        }
        if let Some(ref model) = filter_model {
            conditions.push(format!("model = ?{}", param_values.len() + 1));
            param_values.push(Box::new(model.clone()));
        }
        if let Some(start) = date_start {
            conditions.push(format!("timestamp >= ?{}", param_values.len() + 1));
            param_values.push(Box::new(start));
        }
        if let Some(end) = date_end {
            conditions.push(format!("timestamp <= ?{}", param_values.len() + 1));
            param_values.push(Box::new(end));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Convert params to slice of &dyn ToSql
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        // Total aggregates
        let agg_sql = format!(
            "SELECT COUNT(*), COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0),
                    COALESCE(SUM(reasoning_tokens),0)
             FROM token_events {}",
            where_clause
        );

        let (event_count, total_input, total_output, total_cache_read, total_cache_write, total_reasoning): (
            u64, u64, u64, u64, u64, u64,
        ) = conn
            .query_row(&agg_sql, params_refs.as_slice(), |row| {
                Ok((
                    row.get::<_, i64>(0)? as u64,
                    row.get::<_, i64>(1)? as u64,
                    row.get::<_, i64>(2)? as u64,
                    row.get::<_, i64>(3)? as u64,
                    row.get::<_, i64>(4)? as u64,
                    row.get::<_, i64>(5)? as u64,
                ))
            })
            .unwrap_or((0, 0, 0, 0, 0, 0));

        // Compute total cost from model-level data
        let mut total_cost = 0.0;
        let model_sql = format!(
            "SELECT model, COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0)
             FROM token_events {} GROUP BY model",
            where_clause
        );
        if let Ok(mut stmt) = conn.prepare(&model_sql) {
            let rows = stmt
                .query_map(params_refs.as_slice(), |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)? as u64,
                        row.get::<_, i64>(2)? as u64,
                        row.get::<_, i64>(3)? as u64,
                        row.get::<_, i64>(4)? as u64,
                    ))
                });
            if let Ok(rows) = rows {
                for row in rows.flatten() {
                    let (model, inp, out, cr, cw) = row;
                    let mut pricing = self.pricing.lock().unwrap();
                    let event = TokenEvent {
                        agent: AgentId::ClaudeCode,
                        provider: String::new(),
                        model,
                        timestamp: 0,
                        input_tokens: inp,
                        output_tokens: out,
                        cache_read_tokens: cr,
                        cache_write_tokens: cw,
                        reasoning_tokens: 0,
                        project: None,
                        session_id: None,
                    };
                    total_cost += pricing.calculate_cost(&event);
                }
            }
        }

        // Time series
        let time_series = self.build_time_series(
            &conn,
            &where_clause,
            &granularity,
            params_refs.as_slice(),
        )?;

        // Fill per-bucket costs via per-label×model pricing
        let time_series = self.fill_time_series_costs(
            &conn,
            &where_clause,
            &granularity,
            params_refs.as_slice(),
            time_series,
        )?;

        // Model breakdown
        let model_breakdown = self.build_model_breakdown(&conn, &where_clause, params_refs.as_slice())?;

        // Agent breakdown
        let agent_breakdown = self.build_agent_breakdown(&conn, &where_clause, params_refs.as_slice())?;

        // Hourly heatmap (last 7 days)
        let hourly_heatmap = self.build_hourly_heatmap(&conn, &where_clause, params_refs.as_slice())?;

        Ok(TokenAnalytics {
            period_start: date_start
                .map(|t| t.to_string())
                .unwrap_or_default(),
            period_end: date_end.map(|t| t.to_string()).unwrap_or_default(),
            total_input_tokens: total_input,
            total_output_tokens: total_output,
            total_cache_read_tokens: total_cache_read,
            total_cache_write_tokens: total_cache_write,
            total_reasoning_tokens: total_reasoning,
            total_cost_usd: total_cost,
            event_count,
            time_series,
            model_breakdown,
            agent_breakdown,
            hourly_heatmap,
        })
    }

    fn build_time_series(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        granularity: &TimeGranularity,
        params: &[&dyn rusqlite::types::ToSql],
    ) -> Result<Vec<TokenBucket>, String> {
        let (strftime_fmt, _label_example) = match granularity {
            TimeGranularity::Hourly => ("%Y-%m-%dT%H", "2026-05-19T14"),
            TimeGranularity::Daily => ("%Y-%m-%d", "2026-05-19"),
            TimeGranularity::Weekly => ("%Y-W%W", "2026-W20"),
            TimeGranularity::Monthly => ("%Y-%m", "2026-05"),
        };

        let sql = format!(
            "SELECT strftime('{}', datetime(timestamp, 'unixepoch')) as label,
                    COUNT(*),
                    COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0),
                    COALESCE(SUM(reasoning_tokens),0),
                    COUNT(DISTINCT agent), COUNT(DISTINCT model)
             FROM token_events {}
             GROUP BY label ORDER BY label",
            strftime_fmt, where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Time series query error: {}", e))?;

        let buckets = stmt
            .query_map(params, |row| {
                Ok(TokenBucket {
                    label: row.get(0)?,
                    event_count: row.get::<_, i64>(1)? as u64,
                    input_tokens: row.get::<_, i64>(2)? as u64,
                    output_tokens: row.get::<_, i64>(3)? as u64,
                    cache_read_tokens: row.get::<_, i64>(4)? as u64,
                    cache_write_tokens: row.get::<_, i64>(5)? as u64,
                    reasoning_tokens: row.get::<_, i64>(6)? as u64,
                    agent_count: row.get::<_, i64>(7)? as u64,
                    model_count: row.get::<_, i64>(8)? as u64,
                    cost_usd: 0.0, // computed separately
                })
            })
            .map_err(|e| format!("Time series map error: {}", e))?;

        Ok(buckets.filter_map(|r| r.ok()).collect())
    }

    /// Compute per-label costs for time_series buckets via per-model pricing.
    fn fill_time_series_costs(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        granularity: &TimeGranularity,
        params: &[&dyn rusqlite::types::ToSql],
        mut buckets: Vec<TokenBucket>,
    ) -> Result<Vec<TokenBucket>, String> {
        let strftime_fmt = match granularity {
            TimeGranularity::Hourly => "%Y-%m-%dT%H",
            TimeGranularity::Daily => "%Y-%m-%d",
            TimeGranularity::Weekly => "%Y-W%W",
            TimeGranularity::Monthly => "%Y-%m",
        };

        let sql = format!(
            "SELECT strftime('{}', datetime(timestamp, 'unixepoch')) as label,
                    model,
                    COALESCE(SUM(input_tokens),0),
                    COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0),
                    COALESCE(SUM(cache_write_tokens),0)
             FROM token_events {}
             GROUP BY label, model
             ORDER BY label",
            strftime_fmt, where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Time series cost query error: {}", e))?;

        let rows = stmt
            .query_map(params, |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)? as u64,
                    row.get::<_, i64>(3)? as u64,
                    row.get::<_, i64>(4)? as u64,
                    row.get::<_, i64>(5)? as u64,
                ))
            })
            .map_err(|e| format!("Time series cost map error: {}", e))?;

        let mut label_costs: std::collections::HashMap<String, f64> =
            std::collections::HashMap::new();
        for row in rows.flatten() {
            let (label, model, input, output, cr, cw) = row;
            let mut pricing = self.pricing.lock().unwrap();
            let event = TokenEvent {
                agent: AgentId::ClaudeCode,
                provider: String::new(),
                model,
                timestamp: 0,
                input_tokens: input,
                output_tokens: output,
                cache_read_tokens: cr,
                cache_write_tokens: cw,
                reasoning_tokens: 0,
                project: None,
                session_id: None,
            };
            let cost = pricing.calculate_cost(&event);
            *label_costs.entry(label).or_default() += cost;
        }

        for bucket in &mut buckets {
            bucket.cost_usd = label_costs.get(&bucket.label).copied().unwrap_or(0.0);
        }

        Ok(buckets)
    }

    fn build_model_breakdown(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        params: &[&dyn rusqlite::types::ToSql],
    ) -> Result<Vec<ModelBreakdown>, String> {
        let sql = format!(
            "SELECT model, provider, agent,
                    COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0),
                    COALESCE(SUM(reasoning_tokens),0), COUNT(*)
             FROM token_events {}
             GROUP BY model, provider, agent
             ORDER BY COALESCE(SUM(input_tokens),0) + COALESCE(SUM(output_tokens),0) DESC",
            where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Model breakdown query error: {}", e))?;

        let rows = stmt
            .query_map(params, |row| {
                let model: String = row.get(0)?;
                let provider: String = row.get(1)?;
                let agent_str: String = row.get(2)?;
                let input: u64 = row.get::<_, i64>(3)? as u64;
                let output: u64 = row.get::<_, i64>(4)? as u64;
                let cr: u64 = row.get::<_, i64>(5)? as u64;
                let cw: u64 = row.get::<_, i64>(6)? as u64;
                let reasoning: u64 = row.get::<_, i64>(7)? as u64;
                let count: u64 = row.get::<_, i64>(8)? as u64;

                let agent = match agent_str.as_str() {
                    "codex-cli" => AgentId::CodexCli,
                    "gemini-cli" => AgentId::GeminiCli,
                    _ => AgentId::ClaudeCode,
                };

                Ok(ModelBreakdown {
                    model,
                    provider,
                    agent,
                    input_tokens: input,
                    output_tokens: output,
                    cache_read_tokens: cr,
                    cache_write_tokens: cw,
                    reasoning_tokens: reasoning,
                    cost_usd: 0.0, // filled below
                    event_count: count,
                })
            })
            .map_err(|e| format!("Model breakdown map error: {}", e))?;

        let mut models: Vec<ModelBreakdown> = rows.filter_map(|r| r.ok()).collect();

        // Fill costs
        for m in &mut models {
            let mut pricing = self.pricing.lock().unwrap();
            let event = TokenEvent {
                agent: m.agent.clone(),
                provider: m.provider.clone(),
                model: m.model.clone(),
                timestamp: 0,
                input_tokens: m.input_tokens,
                output_tokens: m.output_tokens,
                cache_read_tokens: m.cache_read_tokens,
                cache_write_tokens: m.cache_write_tokens,
                reasoning_tokens: m.reasoning_tokens,
                project: None,
                session_id: None,
            };
            m.cost_usd = pricing.calculate_cost(&event);
        }

        Ok(models)
    }

    fn build_agent_breakdown(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        params: &[&dyn rusqlite::types::ToSql],
    ) -> Result<Vec<AgentBreakdown>, String> {
        let sql = format!(
            "SELECT agent,
                    COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0),
                    COUNT(*)
             FROM token_events {}
             GROUP BY agent",
            where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Agent breakdown query error: {}", e))?;

        let rows = stmt
            .query_map(params, |row| {
                let agent_str: String = row.get(0)?;
                let agent = match agent_str.as_str() {
                    "codex-cli" => AgentId::CodexCli,
                    "gemini-cli" => AgentId::GeminiCli,
                    _ => AgentId::ClaudeCode,
                };

                Ok(AgentBreakdown {
                    agent,
                    input_tokens: row.get::<_, i64>(1)? as u64,
                    output_tokens: row.get::<_, i64>(2)? as u64,
                    cache_read_tokens: row.get::<_, i64>(3)? as u64,
                    cache_write_tokens: row.get::<_, i64>(4)? as u64,
                    cost_usd: 0.0,
                    event_count: row.get::<_, i64>(5)? as u64,
                })
            })
            .map_err(|e| format!("Agent breakdown map error: {}", e))?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    fn build_hourly_heatmap(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        params: &[&dyn rusqlite::types::ToSql],
    ) -> Result<Vec<HourlyHeatmapEntry>, String> {
        // Group by day-of-week (0=Sun..6=Sat) + hour
        let sql = format!(
            "SELECT CAST(strftime('%w', datetime(timestamp, 'unixepoch')) AS INTEGER) as dow,
                    CAST(strftime('%H', datetime(timestamp, 'unixepoch')) AS INTEGER) as hour,
                    COALESCE(SUM(input_tokens + output_tokens),0) as total_tokens
             FROM token_events {}
             GROUP BY dow, hour ORDER BY dow, hour",
            where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Heatmap query error: {}", e))?;

        let rows = stmt
            .query_map(params, |row| {
                Ok((
                    row.get::<_, i64>(0)? as u8,
                    row.get::<_, i64>(1)? as u8,
                    row.get::<_, i64>(2)? as u64,
                ))
            })
            .map_err(|e| format!("Heatmap map error: {}", e))?;

        let mut entries: Vec<HourlyHeatmapEntry> = rows
            .filter_map(|r| r.ok())
            .map(|(dow, hour, total_tokens)| HourlyHeatmapEntry {
                day: weekday_name(dow).to_string(),
                hour,
                total_tokens,
                cost_usd: 0.0,
            })
            .collect();

        // Fill per day-of-week×hour costs via per-model pricing
        let cost_sql = format!(
            "SELECT CAST(strftime('%w', datetime(timestamp, 'unixepoch')) AS INTEGER) as dow,
                    CAST(strftime('%H', datetime(timestamp, 'unixepoch')) AS INTEGER) as hour,
                    model,
                    COALESCE(SUM(input_tokens),0),
                    COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0),
                    COALESCE(SUM(cache_write_tokens),0)
             FROM token_events {}
             GROUP BY dow, hour, model
             ORDER BY dow, hour",
            where_clause
        );

        if let Ok(mut cost_stmt) = conn.prepare(&cost_sql) {
            let cost_rows = cost_stmt
                .query_map(params, |row| {
                    Ok((
                        row.get::<_, i64>(0)? as u8,
                        row.get::<_, i64>(1)? as u8,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)? as u64,
                        row.get::<_, i64>(4)? as u64,
                        row.get::<_, i64>(5)? as u64,
                        row.get::<_, i64>(6)? as u64,
                    ))
                });

            if let Ok(cost_rows) = cost_rows {
                let mut dow_hour_costs: std::collections::HashMap<(u8, u8), f64> =
                    std::collections::HashMap::new();
                for row in cost_rows.flatten() {
                    let (dow, hour, model, input, output, cr, cw) = row;
                    let mut pricing = self.pricing.lock().unwrap();
                    let event = TokenEvent {
                        agent: AgentId::ClaudeCode,
                        provider: String::new(),
                        model,
                        timestamp: 0,
                        input_tokens: input,
                        output_tokens: output,
                        cache_read_tokens: cr,
                        cache_write_tokens: cw,
                        reasoning_tokens: 0,
                        project: None,
                        session_id: None,
                    };
                    let cost = pricing.calculate_cost(&event);
                    *dow_hour_costs.entry((dow, hour)).or_default() += cost;
                }

                for entry in &mut entries {
                    // Re-derive the dow from the day name to match cost map
                    let dow = match entry.day.as_str() {
                        "Sun" => 0u8,
                        "Mon" => 1u8,
                        "Tue" => 2u8,
                        "Wed" => 3u8,
                        "Thu" => 4u8,
                        "Fri" => 5u8,
                        "Sat" => 6u8,
                        _ => 99u8,
                    };
                    entry.cost_usd = dow_hour_costs.get(&(dow, entry.hour)).copied().unwrap_or(0.0);
                }
            }
        }

        Ok(entries)
    }

    /// Build cache efficiency metrics.
    pub fn build_cache_efficiency(
        &self,
        date_start: Option<i64>,
        date_end: Option<i64>,
    ) -> Result<CacheEfficiency, String> {
        let analytics = self.build_analytics(
            TimeGranularity::Daily,
            date_start,
            date_end,
            None,
            None,
        )?;

        let total_input = analytics.total_input_tokens + analytics.total_cache_read_tokens;
        let cache_hit_ratio = if total_input > 0 {
            analytics.total_cache_read_tokens as f64 / total_input as f64
        } else {
            0.0
        };

        // Cache cost saved = cache_read * (regular_input_price - cache_read_price)
        // Using Sonnet pricing as default: regular input $3/M, cache read $0.3/M
        let cache_cost_saved = analytics.total_cache_read_tokens as f64 / 1_000_000.0 * (3.0 - 0.3);

        Ok(CacheEfficiency {
            total_input_tokens: analytics.total_input_tokens,
            cache_read_tokens: analytics.total_cache_read_tokens,
            cache_write_tokens: analytics.total_cache_write_tokens,
            cache_hit_ratio,
            cache_cost_saved,
        })
    }

    /// Trigger a re-scan and return result.
    pub fn refresh(&self) -> Result<RefreshResult, String> {
        use crate::tokens::scanner::TokenScanner;

        let registry = {
            let mut r = crate::tokens::parsers::ParserRegistry::new();
            r.register(Box::new(
                crate::tokens::parsers::claude_code::ClaudeCodeParser::new(),
            ));
            r
        };

        let scanner = TokenScanner::new(registry);
        let events = scanner.scan_all()?;
        let inserted = self.storage.upsert_events(&events)?;

        Ok(RefreshResult {
            agents_scanned: 1,
            events_parsed: inserted,
            errors: Vec::new(),
        })
    }

    /// Get status of available agents.
    pub fn get_agent_status(&self) -> Result<Vec<AgentStatus>, String> {
        let registry = {
            let mut r = crate::tokens::parsers::ParserRegistry::new();
            r.register(Box::new(
                crate::tokens::parsers::claude_code::ClaudeCodeParser::new(),
            ));
            r
        };

        let mut statuses = Vec::new();
        for parser in registry.all_parsers() {
            let agent = parser.agent_id();
            let available = parser.is_available();

            // Get event count from DB
            let conn = self
                .storage
                .connection()
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            let event_count: u64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM token_events WHERE agent = ?1",
                    params![agent.to_string()],
                    |row| row.get::<_, i64>(0).map(|v| v as u64),
                )
                .unwrap_or(0);

            let last_scanned = conn
                .query_row(
                    "SELECT MAX(timestamp) FROM token_events WHERE agent = ?1",
                    params![agent.to_string()],
                    |row| row.get::<_, Option<i64>>(0),
                )
                .unwrap_or(None)
                .map(|ts| ts.to_string());

            statuses.push(AgentStatus {
                agent,
                name: parser.agent_id().to_string(),
                available,
                last_scanned,
                event_count,
                total_cost_usd: 0.0,
            });
        }

        Ok(statuses)
    }

    /// Get model breakdown only.
    pub fn get_model_breakdown(
        &self,
        date_start: Option<i64>,
        date_end: Option<i64>,
    ) -> Result<Vec<ModelBreakdown>, String> {
        let analytics =
            self.build_analytics(TimeGranularity::Daily, date_start, date_end, None, None)?;
        Ok(analytics.model_breakdown)
    }
}
