use rusqlite::params;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::tokens::pricing::PricingService;
use crate::tokens::scan_state::ScanState;
use crate::tokens::storage::{
    TokenStorage, SOURCE_FELINA_PARSER, SOURCE_PARSER_FALLBACK, SOURCE_TOKSCALE_EXPORT,
};
#[cfg(test)]
use crate::tokens::tokscale::TokscaleAdapter;
use crate::tokens::tokscale_ingestion;
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

fn parse_agent_id(agent: &str) -> AgentId {
    match agent {
        "codex-cli" => AgentId::CodexCli,
        "gemini-cli" => AgentId::GeminiCli,
        _ => AgentId::ClaudeCode,
    }
}

fn is_synthetic_tokscale_session(session_id: &str) -> bool {
    session_id.starts_with("tokscale-")
}

pub struct TokenAggregator {
    pub(crate) storage: TokenStorage,
    pub(crate) pricing: Mutex<PricingService>,
    /// Cached result of pick_dated_source() — cleared on every refresh so the
    /// next query re-evaluates after new data is ingested.
    pub(crate) dated_source_cache: Mutex<Option<String>>,
}

impl TokenAggregator {
    pub fn new() -> Result<Self, String> {
        let storage = TokenStorage::new()?;
        let mut svc = PricingService::new();
        // Kick off background fetch of LiteLLM prices (no-op if cache is fresh).
        svc.try_fetch_litellm();
        let pricing = Mutex::new(svc);
        Ok(TokenAggregator {
            storage,
            pricing,
            dated_source_cache: Mutex::new(None),
        })
    }

    /// Build a complete analytics response.
    ///
    /// `source_override`:
    ///   - `None`             → use the preferred source for the granularity
    ///   - `Some("auto_dated")` → pick the source with the most timestamp > 0 records
    ///   - `Some("<name>")`   → use that source directly
    pub fn build_analytics(
        &self,
        granularity: TimeGranularity,
        date_start: Option<i64>,
        date_end: Option<i64>,
        filter_agent: Option<String>,
        filter_model: Option<String>,
        source_override: Option<String>,
    ) -> Result<TokenAnalytics, String> {
        let active_source = match source_override.as_deref() {
            Some("auto_dated") => self.pick_dated_source()?,
            Some(s) => s.to_string(),
            None => self.default_analytics_source(&granularity)?,
        };
        eprintln!(
            "tokens: build_analytics granularity={:?} source_override={:?} resolved_source={}",
            granularity, source_override, active_source
        );

        let conn = self
            .storage
            .connection()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        // Build WHERE clause fragments
        let mut conditions = vec!["source = ?1".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        param_values.push(Box::new(active_source));

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
            "SELECT COALESCE(SUM(event_count),0), COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0), COALESCE(SUM(cache_write_tokens),0),
                    COALESCE(SUM(reasoning_tokens),0)
             FROM token_events {}",
            where_clause
        );

        let (
            event_count,
            total_input,
            total_output,
            total_cache_read,
            total_cache_write,
            total_reasoning,
        ): (u64, u64, u64, u64, u64, u64) = conn
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
            let rows = stmt.query_map(params_refs.as_slice(), |row| {
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
        let time_series =
            self.build_time_series(&conn, &where_clause, &granularity, params_refs.as_slice())?;

        // Fill per-bucket costs via per-label×model pricing
        let time_series = self.fill_time_series_costs(
            &conn,
            &where_clause,
            &granularity,
            params_refs.as_slice(),
            time_series,
        )?;

        // Model breakdown
        let model_breakdown =
            self.build_model_breakdown(&conn, &where_clause, params_refs.as_slice())?;

        // Agent breakdown
        let agent_breakdown =
            self.build_agent_breakdown(&conn, &where_clause, params_refs.as_slice())?;

        // Top sessions for the same scope as the current analytics query.
        let top_sessions =
            self.build_top_sessions(&conn, &where_clause, params_refs.as_slice(), 5)?;

        // Hourly heatmap (last 7 days)
        let hourly_heatmap =
            self.build_hourly_heatmap(&conn, &where_clause, params_refs.as_slice())?;

        Ok(TokenAnalytics {
            period_start: date_start.map(|t| t.to_string()).unwrap_or_default(),
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
            top_sessions,
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
            "SELECT CASE WHEN timestamp = 0 THEN 'all' ELSE strftime('{}', datetime(timestamp, 'unixepoch', 'localtime')) END as label,
                    COALESCE(SUM(event_count),0),
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
            "SELECT CASE WHEN timestamp = 0 THEN 'all' ELSE strftime('{}', datetime(timestamp, 'unixepoch', 'localtime')) END as label,
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
                    COALESCE(SUM(reasoning_tokens),0), COALESCE(SUM(event_count),0)
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

                let agent = parse_agent_id(&agent_str);

                Ok(ModelBreakdown {
                    model,
                    provider,
                    agent,
                    input_tokens: input,
                    output_tokens: output,
                    cache_read_tokens: cr,
                    cache_write_tokens: cw,
                    reasoning_tokens: reasoning,
                    cost_usd: 0.0,
                    event_count: count,
                    max_input_tokens: None, // filled below
                })
            })
            .map_err(|e| format!("Model breakdown map error: {}", e))?;

        let mut models: Vec<ModelBreakdown> = rows.filter_map(|r| r.ok()).collect();

        // Fill costs + context window
        for m in &mut models {
            let mut pricing = self.pricing.lock().unwrap();
            if let Ok(p) = pricing.get_price(&m.model) {
                m.max_input_tokens = p.max_input_tokens;
            }
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
                    COALESCE(SUM(reasoning_tokens),0), COALESCE(SUM(event_count),0)
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
                let agent = parse_agent_id(&agent_str);

                Ok(AgentBreakdown {
                    agent,
                    input_tokens: row.get::<_, i64>(1)? as u64,
                    output_tokens: row.get::<_, i64>(2)? as u64,
                    cache_read_tokens: row.get::<_, i64>(3)? as u64,
                    cache_write_tokens: row.get::<_, i64>(4)? as u64,
                    reasoning_tokens: row.get::<_, i64>(5)? as u64,
                    cost_usd: 0.0,
                    event_count: row.get::<_, i64>(6)? as u64,
                })
            })
            .map_err(|e| format!("Agent breakdown map error: {}", e))?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    fn build_top_sessions(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        params: &[&dyn rusqlite::types::ToSql],
        limit: usize,
    ) -> Result<Vec<DaySessionBreakdown>, String> {
        #[derive(Default)]
        struct SessionRollup {
            project: Option<String>,
            model: String,
            model_tokens: u64,
            tokens: u64,
            messages: u64,
            cost_usd: f64,
        }

        let sql = format!(
            "SELECT agent,
                    session_id,
                    project,
                    model,
                    provider,
                    COALESCE(SUM(input_tokens),0),
                    COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0),
                    COALESCE(SUM(cache_write_tokens),0),
                    COALESCE(SUM(reasoning_tokens),0),
                    COALESCE(SUM(event_count),0)
             FROM token_events {}
             AND session_id IS NOT NULL
             AND session_id != ''
             GROUP BY agent, session_id, project, model, provider",
            where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Top sessions query error: {}", e))?;

        let rows = stmt
            .query_map(params, |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)? as u64,
                    row.get::<_, i64>(6)? as u64,
                    row.get::<_, i64>(7)? as u64,
                    row.get::<_, i64>(8)? as u64,
                    row.get::<_, i64>(9)? as u64,
                    row.get::<_, i64>(10)? as u64,
                ))
            })
            .map_err(|e| format!("Top sessions map error: {}", e))?;

        let mut rollups: HashMap<(String, String), SessionRollup> = HashMap::new();
        for row in rows.flatten() {
            let (
                agent,
                session_id,
                project,
                model,
                provider,
                input,
                output,
                cr,
                cw,
                reasoning,
                messages,
            ) = row;
            if is_synthetic_tokscale_session(&session_id) {
                continue;
            }
            let tokens = input + output + cr + cw + reasoning;
            let entry = rollups
                .entry((agent.clone(), session_id))
                .or_insert_with(SessionRollup::default);

            entry.tokens += tokens;
            entry.messages += messages;
            if entry.project.is_none() {
                entry.project = project;
            }
            if tokens > entry.model_tokens {
                entry.model = model.clone();
                entry.model_tokens = tokens;
            }

            let mut pricing = self.pricing.lock().unwrap();
            let event = TokenEvent {
                agent: parse_agent_id(&agent),
                provider,
                model,
                timestamp: 0,
                input_tokens: input,
                output_tokens: output,
                cache_read_tokens: cr,
                cache_write_tokens: cw,
                reasoning_tokens: reasoning,
                project: None,
                session_id: None,
            };
            entry.cost_usd += pricing.calculate_cost(&event);
        }

        let mut sessions: Vec<DaySessionBreakdown> = rollups
            .into_iter()
            .map(|((agent, session_id), rollup)| DaySessionBreakdown {
                session_id,
                agent: parse_agent_id(&agent),
                project: rollup.project,
                model: rollup.model,
                tokens: rollup.tokens,
                messages: rollup.messages,
                cost_usd: rollup.cost_usd,
                transcript_available: false,
            })
            .collect();

        sessions.sort_by(|a, b| {
            b.tokens
                .cmp(&a.tokens)
                .then_with(|| a.session_id.cmp(&b.session_id))
        });
        sessions.truncate(limit);
        Ok(sessions)
    }

    fn build_hourly_heatmap(
        &self,
        conn: &rusqlite::Connection,
        where_clause: &str,
        params: &[&dyn rusqlite::types::ToSql],
    ) -> Result<Vec<HourlyHeatmapEntry>, String> {
        // Group by day-of-week (0=Sun..6=Sat) + hour
        let sql = format!(
            "SELECT CAST(strftime('%w', datetime(timestamp, 'unixepoch', 'localtime')) AS INTEGER) as dow,
                    CAST(strftime('%H', datetime(timestamp, 'unixepoch', 'localtime')) AS INTEGER) as hour,
                    COALESCE(SUM(input_tokens + output_tokens),0) as total_tokens
             FROM token_events {}
             AND timestamp > 0
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
            "SELECT CAST(strftime('%w', datetime(timestamp, 'unixepoch', 'localtime')) AS INTEGER) as dow,
                    CAST(strftime('%H', datetime(timestamp, 'unixepoch', 'localtime')) AS INTEGER) as hour,
                    model,
                    COALESCE(SUM(input_tokens),0),
                    COALESCE(SUM(output_tokens),0),
                    COALESCE(SUM(cache_read_tokens),0),
                    COALESCE(SUM(cache_write_tokens),0)
             FROM token_events {}
             AND timestamp > 0
             GROUP BY dow, hour, model
             ORDER BY dow, hour",
            where_clause
        );

        if let Ok(mut cost_stmt) = conn.prepare(&cost_sql) {
            let cost_rows = cost_stmt.query_map(params, |row| {
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
                    entry.cost_usd = dow_hour_costs
                        .get(&(dow, entry.hour))
                        .copied()
                        .unwrap_or(0.0);
                }
            }
        }

        Ok(entries)
    }

    /// Resolve the source to query (auto_dated, explicit name, or active).
    fn resolve_source(&self, source_override: Option<&str>) -> Result<String, String> {
        match source_override {
            Some("auto_dated") => self.pick_dated_source(),
            Some(s) => Ok(s.to_string()),
            None => self
                .storage
                .active_source()
                .map_err(|e| format!("active_source error: {}", e)),
        }
    }

    /// Hourly token distribution for a single day (YYYY-MM-DD, local time).
    pub fn build_day_hourly(
        &self,
        date: &str,
        source_override: Option<String>,
    ) -> Result<Vec<DayHourlyBucket>, String> {
        let source = self.resolve_source(source_override.as_deref())?;
        let conn = self
            .storage
            .connection()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let sql = "SELECT CAST(strftime('%H', datetime(timestamp,'unixepoch','localtime')) AS INTEGER),
                          COALESCE(SUM(input_tokens+output_tokens+cache_read_tokens+cache_write_tokens),0),
                          COALESCE(SUM(event_count),0)
                   FROM token_events
                   WHERE source=?1 AND date(timestamp,'unixepoch','localtime')=?2 AND timestamp>0
                   GROUP BY 1 ORDER BY 1";

        let mut stmt = conn
            .prepare(sql)
            .map_err(|e| format!("hourly query: {}", e))?;
        let rows = stmt
            .query_map(rusqlite::params![source, date], |row| {
                Ok(DayHourlyBucket {
                    hour: row.get::<_, i64>(0)? as u8,
                    tokens: row.get::<_, i64>(1)? as u64,
                    messages: row.get::<_, i64>(2)? as u64,
                })
            })
            .map_err(|e| format!("hourly map: {}", e))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// Per-project token breakdown for a single day.
    pub fn build_day_project_breakdown(
        &self,
        date: &str,
        source_override: Option<String>,
    ) -> Result<Vec<DayProjectBreakdown>, String> {
        let source = self.resolve_source(source_override.as_deref())?;
        let conn = self
            .storage
            .connection()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let sql = "SELECT COALESCE(NULLIF(project,''), '(no project)'),
                          COALESCE(SUM(input_tokens+output_tokens+cache_read_tokens+cache_write_tokens),0),
                          COALESCE(SUM(event_count),0)
                   FROM token_events
                   WHERE source=?1 AND date(timestamp,'unixepoch','localtime')=?2
                   GROUP BY project ORDER BY 2 DESC LIMIT 10";

        let mut stmt = conn
            .prepare(sql)
            .map_err(|e| format!("project query: {}", e))?;
        let rows = stmt
            .query_map(rusqlite::params![source, date], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)? as u64,
                    row.get::<_, i64>(2)? as u64,
                ))
            })
            .map_err(|e| format!("project map: {}", e))?;

        let mut result: Vec<DayProjectBreakdown> = rows
            .filter_map(|r| r.ok())
            .map(|(project, tokens, messages)| DayProjectBreakdown {
                project,
                tokens,
                messages,
                cost_usd: 0.0,
            })
            .collect();

        // Fill costs per project via model breakdown
        for p in &mut result {
            let cost_sql = "SELECT model, provider,
                                   COALESCE(SUM(input_tokens),0),
                                   COALESCE(SUM(output_tokens),0),
                                   COALESCE(SUM(cache_read_tokens),0),
                                   COALESCE(SUM(cache_write_tokens),0)
                            FROM token_events
                            WHERE source=?1 AND date(timestamp,'unixepoch','localtime')=?2
                              AND COALESCE(NULLIF(project,''), '(no project)')=?3
                            GROUP BY model, provider";
            if let Ok(mut stmt2) = conn.prepare(cost_sql) {
                if let Ok(crows) =
                    stmt2.query_map(rusqlite::params![source, date, p.project], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, i64>(2)? as u64,
                            row.get::<_, i64>(3)? as u64,
                            row.get::<_, i64>(4)? as u64,
                            row.get::<_, i64>(5)? as u64,
                        ))
                    })
                {
                    for crow in crows.flatten() {
                        let (model, provider, inp, out, cr, cw) = crow;
                        let mut pricing = self.pricing.lock().unwrap();
                        let event = TokenEvent {
                            agent: AgentId::ClaudeCode,
                            provider,
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
                        p.cost_usd += pricing.calculate_cost(&event);
                    }
                }
            }
        }
        Ok(result)
    }

    /// Top sessions by token consumption for a single day.
    pub fn build_day_top_sessions(
        &self,
        date: &str,
        limit: u64,
        source_override: Option<String>,
    ) -> Result<Vec<DaySessionBreakdown>, String> {
        let source = self.resolve_source(source_override.as_deref())?;
        let conn = self
            .storage
            .connection()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let sql = "SELECT session_id,
                          agent,
                          project,
                          model,
                          COALESCE(SUM(input_tokens+output_tokens+cache_read_tokens+cache_write_tokens),0),
                          COALESCE(SUM(event_count),0),
                          provider
                   FROM token_events
                   WHERE source=?1 AND date(timestamp,'unixepoch','localtime')=?2
                     AND session_id IS NOT NULL
                   GROUP BY agent, session_id ORDER BY 5 DESC LIMIT ?3";

        let mut stmt = conn
            .prepare(sql)
            .map_err(|e| format!("sessions query: {}", e))?;
        let rows = stmt
            .query_map(rusqlite::params![source, date, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)? as u64,
                    row.get::<_, i64>(5)? as u64,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|e| format!("sessions map: {}", e))?;

        let mut result: Vec<DaySessionBreakdown> = rows
            .filter_map(|r| r.ok())
            .map(
                |(session_id, agent, project, model, tokens, messages, _provider)| {
                    if is_synthetic_tokscale_session(&session_id) {
                        return None;
                    }
                    let agent = match agent.as_str() {
                        "codex-cli" => AgentId::CodexCli,
                        "gemini-cli" => AgentId::GeminiCli,
                        _ => AgentId::ClaudeCode,
                    };
                    Some(DaySessionBreakdown {
                        session_id,
                        agent,
                        project,
                        model,
                        tokens,
                        messages,
                        cost_usd: 0.0,
                        transcript_available: false,
                    })
                },
            )
            .flatten()
            .collect();

        // Fill costs
        for s in &mut result {
            let cost_sql = "SELECT model, provider,
                                   COALESCE(SUM(input_tokens),0),
                                   COALESCE(SUM(output_tokens),0),
                                   COALESCE(SUM(cache_read_tokens),0),
                                   COALESCE(SUM(cache_write_tokens),0)
                            FROM token_events
                            WHERE source=?1 AND date(timestamp,'unixepoch','localtime')=?2
                              AND session_id=?3
                            GROUP BY model, provider";
            if let Ok(mut stmt2) = conn.prepare(cost_sql) {
                if let Ok(crows) =
                    stmt2.query_map(rusqlite::params![source, date, s.session_id], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, i64>(2)? as u64,
                            row.get::<_, i64>(3)? as u64,
                            row.get::<_, i64>(4)? as u64,
                            row.get::<_, i64>(5)? as u64,
                        ))
                    })
                {
                    for crow in crows.flatten() {
                        let (model, provider, inp, out, cr, cw) = crow;
                        let mut pricing = self.pricing.lock().unwrap();
                        let event = TokenEvent {
                            agent: AgentId::ClaudeCode,
                            provider,
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
                        s.cost_usd += pricing.calculate_cost(&event);
                    }
                }
            }
        }
        Ok(result)
    }

    /// Build model breakdown for a single calendar day (YYYY-MM-DD, local time).
    pub fn build_day_model_breakdown(
        &self,
        date: &str,
        source_override: Option<String>,
    ) -> Result<Vec<ModelBreakdown>, String> {
        let source = match source_override.as_deref() {
            Some("auto_dated") => self.pick_dated_source()?,
            Some(s) => s.to_string(),
            None => self
                .storage
                .active_source()
                .unwrap_or_else(|_| SOURCE_FELINA_PARSER.to_string()),
        };

        let conn = self
            .storage
            .connection()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let where_clause = "WHERE source = ?1 AND date(timestamp,'unixepoch','localtime') = ?2";
        let params: Vec<Box<dyn rusqlite::types::ToSql>> =
            vec![Box::new(source), Box::new(date.to_string())];
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();

        self.build_model_breakdown(&conn, where_clause, params_refs.as_slice())
    }

    /// Build both monthly and daily analytics in a single call.
    ///
    /// `monthly_source`: source for the Overview/Models monthly query.
    ///   Pass `None` to use active_source (fast — tokscale for "all time").
    ///   Pass `Some("auto_dated")` only when a date range is active.
    ///
    /// `daily_source`: source for the Daily tab.
    ///   Always pass `Some("auto_dated")` — tokscale has no timestamps.
    pub fn build_analytics_pair(
        &self,
        date_start: Option<i64>,
        date_end: Option<i64>,
        monthly_source: Option<String>,
        daily_source: Option<String>,
    ) -> Result<TokenAnalyticsPair, String> {
        let monthly = self.build_analytics(
            TimeGranularity::Monthly,
            date_start,
            date_end,
            None,
            None,
            monthly_source,
        )?;
        let daily = self.build_analytics(
            TimeGranularity::Daily,
            date_start,
            date_end,
            None,
            None,
            daily_source,
        )?;
        Ok(TokenAnalyticsPair { monthly, daily })
    }

    /// Build cache efficiency metrics.
    pub fn build_cache_efficiency(
        &self,
        date_start: Option<i64>,
        date_end: Option<i64>,
        source_override: Option<String>,
    ) -> Result<CacheEfficiency, String> {
        let analytics = self.build_analytics(
            TimeGranularity::Daily,
            date_start,
            date_end,
            None,
            None,
            source_override,
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

    /// Pick the default source for analytics when no explicit override is provided.
    ///
    /// Aggregate views prefer `tokscale_export` when it exists because that is the
    /// source refreshed by `refresh_token_data`. Daily views keep using the active
    /// ingestion source so rollback and parser-only setups still behave as before.
    fn default_analytics_source(&self, granularity: &TimeGranularity) -> Result<String, String> {
        match granularity {
            TimeGranularity::Hourly | TimeGranularity::Weekly | TimeGranularity::Monthly => {
                let tokscale_count = self
                    .storage
                    .count_events_for_source(SOURCE_TOKSCALE_EXPORT)
                    .unwrap_or(0);
                if tokscale_count > 0 {
                    eprintln!(
                        "tokens: default analytics source {:?} -> {} ({} events)",
                        granularity, SOURCE_TOKSCALE_EXPORT, tokscale_count
                    );
                    Ok(SOURCE_TOKSCALE_EXPORT.to_string())
                } else {
                    let source = self
                        .storage
                        .active_source()
                        .map_err(|e| format!("active_source error: {}", e))?;
                    eprintln!(
                        "tokens: default analytics source {:?} -> active_source {} (tokscale_export missing)",
                        granularity, source
                    );
                    Ok(source)
                }
            }
            TimeGranularity::Daily => {
                let tokscale_count = self
                    .storage
                    .count_events_for_source(SOURCE_TOKSCALE_EXPORT)
                    .unwrap_or(0);
                if tokscale_count > 0 {
                    eprintln!(
                        "tokens: default analytics source {:?} -> {} ({} events)",
                        granularity, SOURCE_TOKSCALE_EXPORT, tokscale_count
                    );
                    Ok(SOURCE_TOKSCALE_EXPORT.to_string())
                } else {
                    let source = self
                        .storage
                        .active_source()
                        .map_err(|e| format!("active_source error: {}", e))?;
                    eprintln!(
                        "tokens: default analytics source {:?} -> active_source {} (tokscale_export missing)",
                        granularity, source
                    );
                    Ok(source)
                }
            }
        }
    }

    /// Pick the source that has the most events with a real timestamp (> 0).
    /// Result is cached in-memory — one SQL query on first call, free thereafter.
    fn pick_dated_source(&self) -> Result<String, String> {
        // Return cached value if available.
        {
            let cache = self
                .dated_source_cache
                .lock()
                .map_err(|e| format!("dated_source_cache lock error: {}", e))?;
            if let Some(ref s) = *cache {
                return Ok(s.clone());
            }
        }

        // Prefer tokscale_export when it has timestamped events.
        let tokscale_count = self
            .storage
            .count_events_for_source(SOURCE_TOKSCALE_EXPORT)
            .unwrap_or(0);
        if tokscale_count > 0 {
            if let Ok(mut cache) = self.dated_source_cache.lock() {
                *cache = Some(SOURCE_TOKSCALE_EXPORT.to_string());
            }
            return Ok(SOURCE_TOKSCALE_EXPORT.to_string());
        }

        // Fall back to the source with the most timestamped events.
        let dated_source = {
            let conn = self
                .storage
                .connection()
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            let mut stmt = conn
                .prepare(
                    "SELECT source, COUNT(*) as cnt
                     FROM token_events
                     WHERE timestamp > 0
                     GROUP BY source
                     ORDER BY cnt DESC
                     LIMIT 1",
                )
                .map_err(|e| format!("pick_dated_source prepare error: {}", e))?;
            stmt.query_row([], |row| row.get::<_, String>(0)).ok()
        };

        let source = dated_source.unwrap_or_else(|| {
            self.storage
                .active_source()
                .unwrap_or_else(|_| SOURCE_FELINA_PARSER.to_string())
        });

        if let Ok(mut cache) = self.dated_source_cache.lock() {
            *cache = Some(source.clone());
        }

        Ok(source)
    }

    /// Invalidate the dated-source cache (called after refresh ingests new data).
    fn invalidate_dated_source_cache(&self) {
        if let Ok(mut cache) = self.dated_source_cache.lock() {
            *cache = None;
        }
    }

    /// Run the Felina parser scan and upsert results under SOURCE_FELINA_PARSER.
    /// Called alongside tokscale so the Daily tab always has dated records.
    ///
    /// If `felina_parser` has no dated events yet, the scan cursor is cleared
    /// first so that a full historical scan is performed instead of an
    /// incremental one. This handles the case where the cursor was previously
    /// advanced by an unrelated scan before any felina_parser data existed.
    fn run_parser_scan(&self) -> Result<u64, String> {
        use crate::tokens::scanner::TokenScanner;

        // Check whether we already have dated felina_parser events.
        let has_dated = {
            let conn = self
                .storage
                .connection()
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM token_events WHERE source = ?1 AND timestamp > 0",
                    rusqlite::params![SOURCE_FELINA_PARSER],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            count > 0
        };

        // No dated data yet → clear cursors so the scan reads every file.
        if !has_dated {
            let conn = self
                .storage
                .connection()
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            let _ = conn.execute(
                "DELETE FROM scan_state WHERE agent IN ('claude-code', 'codex-cli', 'gemini-cli')",
                [],
            );
        }

        let registry = {
            let mut r = crate::tokens::parsers::ParserRegistry::new();
            r.register(Box::new(
                crate::tokens::parsers::claude_code::ClaudeCodeParser::new(),
            ));
            r.register(Box::new(crate::tokens::parsers::codex_cli::CodexCliParser));
            r.register(Box::new(
                crate::tokens::parsers::gemini_cli::GeminiCliParser,
            ));
            r
        };

        let scan_state = ScanState::new()?;
        let scanner = TokenScanner::new(registry);
        let output = scanner.scan_all(&scan_state)?;
        self.storage
            .upsert_events_for_source(&output.events, SOURCE_FELINA_PARSER, "parser")
    }

    /// Trigger a tokscale-backed refresh and return result.
    pub fn refresh(&self) -> Result<RefreshResult, String> {
        self.refresh_with_options(false)
    }

    pub fn refresh_with_options(
        &self,
        allow_parser_fallback: bool,
    ) -> Result<RefreshResult, String> {
        self.refresh_from_ingestion_result(
            tokscale_ingestion::ingest_with_default_adapter(&self.storage),
            allow_parser_fallback,
        )
    }

    #[cfg(test)]
    fn refresh_with_adapter(
        &self,
        adapter: &dyn TokscaleAdapter,
        allow_parser_fallback: bool,
    ) -> Result<RefreshResult, String> {
        self.refresh_from_ingestion_result(
            tokscale_ingestion::ingest_with_adapter(&self.storage, adapter),
            allow_parser_fallback,
        )
    }

    fn refresh_from_ingestion_result(
        &self,
        result: Result<tokscale_ingestion::TokscaleIngestionOutput, String>,
        allow_parser_fallback: bool,
    ) -> Result<RefreshResult, String> {
        // Prune events older than 90 days on every refresh (best-effort, non-fatal).
        let _ = self.storage.prune_older_than(90);
        self.invalidate_dated_source_cache();

        match result {
            Ok(output) => {
                // tokscale succeeded — also run the parser so felina_parser
                // records (with real per-day timestamps) are populated in the
                // DB. The Daily tab uses "auto_dated" which picks this source.
                // Errors here are best-effort and do not affect the response.
                let _ = self.run_parser_scan();

                Ok(RefreshResult {
                    agents_scanned: 0,
                    files_scanned: 1,
                    files_skipped: 0,
                    events_parsed: output.event_counts.iter().sum(),
                    events_inserted: output.events.len() as u64,
                    errors: Vec::new(),
                    active_source: crate::tokens::storage::SOURCE_TOKSCALE_EXPORT.to_string(),
                    status: output.source_status,
                    last_successful_source: Some(
                        crate::tokens::storage::SOURCE_TOKSCALE_EXPORT.to_string(),
                    ),
                    fallback_used: false,
                })
            }
            Err(err) if allow_parser_fallback => self.refresh_parser_fallback(&err),
            Err(err) => {
                let active_source = self
                    .storage
                    .active_source()
                    .unwrap_or_else(|_| SOURCE_FELINA_PARSER.to_string());
                let status = err
                    .split(':')
                    .next()
                    .unwrap_or(tokscale_ingestion::STATUS_COMMAND_FAILED)
                    .to_string();
                Ok(RefreshResult {
                    agents_scanned: 0,
                    files_scanned: 0,
                    files_skipped: 0,
                    events_parsed: 0,
                    events_inserted: 0,
                    errors: vec![tokscale_ingestion::scan_error_from_status(
                        &status,
                        Some(err),
                    )],
                    active_source: active_source.clone(),
                    status,
                    last_successful_source: Some(active_source),
                    fallback_used: false,
                })
            }
        }
    }

    /// Explicit diagnostic fallback to the legacy Felina parser path.
    pub fn refresh_parser_fallback(&self, reason: &str) -> Result<RefreshResult, String> {
        let _ = self.storage.prune_older_than(90);
        use crate::tokens::scanner::TokenScanner;

        let registry = {
            let mut r = crate::tokens::parsers::ParserRegistry::new();
            r.register(Box::new(
                crate::tokens::parsers::claude_code::ClaudeCodeParser::new(),
            ));
            r.register(Box::new(crate::tokens::parsers::codex_cli::CodexCliParser));
            r.register(Box::new(
                crate::tokens::parsers::gemini_cli::GeminiCliParser,
            ));
            r
        };

        let scan_state = ScanState::new()?;
        let scanner = TokenScanner::new(registry);
        let output = scanner.scan_all(&scan_state)?;
        let parsed_count = output.events.len() as u64;
        let inserted = self.storage.upsert_events_for_source(
            &output.events,
            SOURCE_PARSER_FALLBACK,
            "fallback",
        )?;
        self.storage.set_active_source(SOURCE_PARSER_FALLBACK)?;
        let mut errors = output.errors;
        errors.push(ScanError {
            agent: AgentId::ClaudeCode,
            source: "tokscale_export".into(),
            message: format!("parser fallback used after tokscale failure: {}", reason),
        });

        Ok(RefreshResult {
            agents_scanned: output.agents_scanned,
            files_scanned: output.files_scanned,
            files_skipped: output.files_skipped,
            events_parsed: parsed_count,
            events_inserted: inserted,
            errors,
            active_source: SOURCE_PARSER_FALLBACK.to_string(),
            status: "parser_fallback".to_string(),
            last_successful_source: Some(SOURCE_PARSER_FALLBACK.to_string()),
            fallback_used: true,
        })
    }

    /// Get status of available agents using scan state cursors for last_scanned
    /// and last_error, not MAX(token_events.timestamp).
    pub fn get_agent_status(&self) -> Result<Vec<AgentStatus>, String> {
        use crate::tokens::scan_state::ScanState;

        let registry = {
            let mut r = crate::tokens::parsers::ParserRegistry::new();
            r.register(Box::new(
                crate::tokens::parsers::claude_code::ClaudeCodeParser::new(),
            ));
            r.register(Box::new(crate::tokens::parsers::codex_cli::CodexCliParser));
            r.register(Box::new(
                crate::tokens::parsers::gemini_cli::GeminiCliParser,
            ));
            r
        };

        let scan_state = ScanState::new()?;
        let active_source = self
            .storage
            .active_source()
            .unwrap_or_else(|_| SOURCE_FELINA_PARSER.to_string());

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
                    "SELECT COALESCE(SUM(event_count),0) FROM token_events WHERE agent = ?1 AND source = ?2",
                    params![agent.to_string(), active_source],
                    |row| row.get::<_, i64>(0).map(|v| v as u64),
                )
                .unwrap_or(0);

            // Read scan state for this agent: collect last_scan_ts and last_error
            // from all sources. The last_scanned is the max last_scan_ts across all
            // source paths for this agent.
            let mut last_scan_ts: Option<i64> = None;
            let mut last_error: Option<String> = None;

            for dir in parser.data_directories() {
                let source_key = dir.to_string_lossy().to_string();
                if let Ok(Some(cursor)) = scan_state.get_cursor(&agent, &source_key) {
                    if cursor.last_scan_ts > 0 {
                        last_scan_ts = Some(match last_scan_ts {
                            Some(existing) => existing.max(cursor.last_scan_ts),
                            None => cursor.last_scan_ts,
                        });
                    }
                    if cursor.last_error.is_some() && last_error.is_none() {
                        last_error = cursor.last_error;
                    }
                }
            }

            let last_scanned = last_scan_ts.map(|ts| ts.to_string());

            statuses.push(AgentStatus {
                agent,
                name: parser.agent_id().to_string(),
                available,
                last_scanned,
                event_count,
                total_cost_usd: 0.0,
                last_error,
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
        let analytics = self.build_analytics(
            TimeGranularity::Daily,
            date_start,
            date_end,
            None,
            None,
            None,
        )?;
        Ok(analytics.model_breakdown)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::reconciliation::{
        ReconcileOptions, ReconciliationRecord, SourceCollection, SourceStatus, TokenSource,
    };
    use crate::tokens::storage::{
        SOURCE_FELINA_PARSER, SOURCE_PARSER_FALLBACK, SOURCE_TOKSCALE_EXPORT,
    };
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    fn temp_db(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("glyphic_aggregator_{}.db", name))
    }

    fn cleanup_db(path: &PathBuf) {
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
    }

    fn aggregator(name: &str) -> (TokenAggregator, PathBuf) {
        let db = temp_db(name);
        cleanup_db(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("storage");
        (
            TokenAggregator {
                storage,
                pricing: Mutex::new(PricingService::new()),
                dated_source_cache: Mutex::new(None),
            },
            db,
        )
    }

    fn event(agent: AgentId, model: &str, input: u64, output: u64, session: &str) -> TokenEvent {
        TokenEvent {
            agent,
            provider: "anthropic".into(),
            model: model.into(),
            timestamp: 1_700_000_000,
            input_tokens: input,
            output_tokens: output,
            cache_read_tokens: 30,
            cache_write_tokens: 40,
            reasoning_tokens: 50,
            project: None,
            session_id: Some(session.into()),
        }
    }

    #[test]
    fn day_top_sessions_include_agent_identity_and_sort_by_tokens() {
        let (aggregator, db) = aggregator("day_top_sessions_agent_sort");
        aggregator
            .storage
            .upsert_events(&[
                event(AgentId::ClaudeCode, "claude-sonnet", 100, 20, "shared"),
                event(AgentId::CodexCli, "gpt-5", 800, 300, "shared"),
                event(AgentId::GeminiCli, "gemini-pro", 200, 40, "gemini"),
            ])
            .expect("insert events");

        let sessions = aggregator
            .build_day_top_sessions("2023-11-15", 10, None)
            .expect("top sessions");

        assert_eq!(sessions.len(), 3);
        assert_eq!(sessions[0].agent, AgentId::CodexCli);
        assert_eq!(sessions[0].session_id, "shared");
        assert_eq!(sessions[0].tokens, 1_170);
        assert_eq!(sessions[1].agent, AgentId::GeminiCli);
        assert_eq!(sessions[1].tokens, 310);
        assert_eq!(sessions[2].agent, AgentId::ClaudeCode);
        assert_eq!(sessions[2].session_id, "shared");
        assert_eq!(sessions[2].tokens, 190);
        cleanup_db(&db);
    }

    #[test]
    fn analytics_response_includes_top_five_sessions_for_current_scope() {
        let (aggregator, db) = aggregator("analytics_top_sessions");
        aggregator
            .storage
            .upsert_events(&[
                event(AgentId::ClaudeCode, "claude-sonnet", 100, 20, "s1"),
                event(AgentId::CodexCli, "gpt-5", 800, 300, "s2"),
                event(AgentId::GeminiCli, "gemini-pro", 200, 40, "s3"),
                event(AgentId::ClaudeCode, "claude-sonnet", 180, 20, "s4"),
                event(AgentId::CodexCli, "gpt-5", 120, 20, "s5"),
                event(AgentId::GeminiCli, "gemini-pro", 60, 20, "s6"),
                event(
                    AgentId::ClaudeCode,
                    "claude-sonnet",
                    9_000,
                    9_000,
                    "tokscale-claude",
                ),
            ])
            .expect("insert events");

        let analytics = aggregator
            .build_analytics(TimeGranularity::Daily, None, None, None, None, None)
            .expect("analytics");

        assert_eq!(analytics.top_sessions.len(), 5);
        assert_eq!(analytics.top_sessions[0].agent, AgentId::CodexCli);
        assert_eq!(analytics.top_sessions[0].session_id, "s2");
        assert_eq!(analytics.top_sessions[0].tokens, 1_220);
        assert!(!analytics
            .top_sessions
            .iter()
            .any(|session| session.session_id == "tokscale-claude"));
        assert!(!analytics
            .top_sessions
            .iter()
            .any(|session| session.session_id == "s6"));
        cleanup_db(&db);
    }

    #[test]
    fn analytics_response_uses_active_tokscale_source_without_legacy_totals() {
        let (aggregator, db) = aggregator("active_tokscale_shape");
        aggregator
            .storage
            .upsert_events(&[event(
                AgentId::ClaudeCode,
                "legacy-model",
                9_000,
                9_000,
                "legacy",
            )])
            .expect("legacy insert");
        let tokscale_event = event(AgentId::CodexCli, "gpt-5.1-codex", 1_000, 200, "tokscale");
        aggregator
            .storage
            .replace_tokscale_records(&[(&tokscale_event, 7)], "tokscale-test")
            .expect("tokscale replace");

        let analytics = aggregator
            .build_analytics(TimeGranularity::Daily, None, None, None, None, None)
            .expect("analytics");
        let json = serde_json::to_value(&analytics).expect("analytics json");

        assert_eq!(analytics.total_input_tokens, 1_000);
        assert_eq!(analytics.total_output_tokens, 200);
        assert_eq!(analytics.total_cache_read_tokens, 30);
        assert_eq!(analytics.total_cache_write_tokens, 40);
        assert_eq!(analytics.total_reasoning_tokens, 50);
        assert_eq!(analytics.event_count, 7);
        assert_eq!(analytics.agent_breakdown[0].agent, AgentId::CodexCli);
        assert_eq!(analytics.agent_breakdown[0].reasoning_tokens, 50);
        assert!(json.get("time_series").is_some());
        assert!(json.get("model_breakdown").is_some());
        assert!(json.get("agent_breakdown").is_some());
        assert!(json.get("top_sessions").is_some());
        cleanup_db(&db);
    }

    #[test]
    fn monthly_analytics_prefers_tokscale_export_over_parser_fallback_active_source() {
        let (aggregator, db) = aggregator("monthly_prefers_tokscale");
        aggregator
            .storage
            .upsert_events(&[event(
                AgentId::ClaudeCode,
                "legacy-model",
                321,
                123,
                "legacy",
            )])
            .expect("legacy insert");
        let tokscale_event = event(AgentId::CodexCli, "gpt-5.1-codex", 1_000, 200, "tokscale");
        aggregator
            .storage
            .replace_tokscale_records(&[(&tokscale_event, 7)], "tokscale-test")
            .expect("tokscale replace");
        aggregator
            .storage
            .set_active_source(SOURCE_PARSER_FALLBACK)
            .expect("active source");

        let analytics = aggregator
            .build_analytics(TimeGranularity::Monthly, None, None, None, None, None)
            .expect("analytics");

        assert_eq!(analytics.total_input_tokens, 1_000);
        assert_eq!(analytics.total_output_tokens, 200);
        assert_eq!(analytics.event_count, 7);
        assert_eq!(analytics.model_breakdown[0].model, "gpt-5.1-codex");
        cleanup_db(&db);
    }

    #[test]
    fn active_source_can_roll_back_to_legacy_parser_rows() {
        let (aggregator, db) = aggregator("rollback_source");
        aggregator
            .storage
            .upsert_events(&[event(
                AgentId::ClaudeCode,
                "legacy-model",
                321,
                123,
                "legacy",
            )])
            .expect("legacy insert");
        let tokscale_event = event(AgentId::CodexCli, "gpt-5.1-codex", 999, 111, "tokscale");
        aggregator
            .storage
            .replace_tokscale_records(&[(&tokscale_event, 3)], "tokscale-test")
            .expect("tokscale replace");

        aggregator
            .storage
            .set_active_source(SOURCE_FELINA_PARSER)
            .expect("rollback active source");
        let analytics = aggregator
            .build_analytics(TimeGranularity::Daily, None, None, None, None, None)
            .expect("analytics");

        assert_eq!(analytics.total_input_tokens, 321);
        assert_eq!(analytics.total_output_tokens, 123);
        assert_eq!(analytics.event_count, 1);
        assert_eq!(analytics.model_breakdown[0].model, "legacy-model");
        cleanup_db(&db);
    }

    #[test]
    fn all_scope_tokscale_rows_are_labeled_all_not_refresh_day() {
        let (aggregator, db) = aggregator("all_scope_label");
        let mut tokscale_event = event(AgentId::CodexCli, "gpt-5.1-codex", 999, 111, "tokscale");
        tokscale_event.timestamp = 0;
        aggregator
            .storage
            .replace_tokscale_records(&[(&tokscale_event, 3)], "tokscale-test")
            .expect("tokscale replace");

        let analytics = aggregator
            .build_analytics(TimeGranularity::Daily, None, None, None, None, None)
            .expect("analytics");

        assert_eq!(analytics.time_series.len(), 1);
        assert_eq!(analytics.time_series[0].label, "all");
        assert!(analytics.hourly_heatmap.is_empty());
        cleanup_db(&db);
    }

    #[test]
    fn refresh_reports_tokscale_failure_without_automatic_parser_fallback() {
        let (aggregator, db) = aggregator("refresh_failure_no_fallback");
        aggregator
            .storage
            .set_active_source(SOURCE_TOKSCALE_EXPORT)
            .expect("active source");

        let result = aggregator
            .refresh_with_adapter(
                &StaticAdapter(SourceCollection {
                    source: TokenSource::TokscaleExport,
                    status: SourceStatus::CommandFailed,
                    message: Some("exit 1".into()),
                    version: None,
                    records: Vec::new(),
                }),
                false,
            )
            .expect("refresh result");

        assert_eq!(result.status, tokscale_ingestion::STATUS_COMMAND_FAILED);
        assert_eq!(result.active_source, SOURCE_TOKSCALE_EXPORT);
        assert_eq!(
            result.last_successful_source.as_deref(),
            Some(SOURCE_TOKSCALE_EXPORT)
        );
        assert!(!result.fallback_used);
        assert_eq!(result.events_inserted, 0);
        assert!(result.errors[0].message.contains("exit 1"));
        cleanup_db(&db);
    }

    #[test]
    fn refresh_success_reports_tokscale_source_and_message_count() {
        let (aggregator, db) = aggregator("refresh_success");
        let result = aggregator
            .refresh_with_adapter(
                &StaticAdapter(SourceCollection {
                    source: TokenSource::TokscaleExport,
                    status: SourceStatus::Ok,
                    message: None,
                    version: None,
                    records: vec![ReconciliationRecord {
                        source: TokenSource::TokscaleExport,
                        agent: "claude-code".into(),
                        provider: "anthropic".into(),
                        model: "claude-sonnet-4-6".into(),
                        timestamp_bucket: "all".into(),
                        session_id: None,
                        input_tokens: 10,
                        output_tokens: 20,
                        cache_read_tokens: 30,
                        cache_write_tokens: 40,
                        reasoning_tokens: 50,
                        event_count: 6,
                        source_metadata: BTreeMap::from([(
                            "client".to_string(),
                            "claude".to_string(),
                        )]),
                    }],
                }),
                false,
            )
            .expect("refresh result");

        assert_eq!(result.status, tokscale_ingestion::STATUS_OK);
        assert_eq!(result.active_source, SOURCE_TOKSCALE_EXPORT);
        assert_eq!(result.events_parsed, 6);
        assert_eq!(result.events_inserted, 1);
        assert_eq!(
            result.last_successful_source.as_deref(),
            Some(SOURCE_TOKSCALE_EXPORT)
        );
        assert!(!result.fallback_used);
        cleanup_db(&db);
    }

    struct StaticAdapter(SourceCollection);

    impl TokscaleAdapter for StaticAdapter {
        fn collect(&self, _options: &ReconcileOptions) -> SourceCollection {
            self.0.clone()
        }
    }
}
