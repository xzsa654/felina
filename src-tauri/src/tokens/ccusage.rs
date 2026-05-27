//! ccusage adapter — per-agent quota snapshots.
//! github: ryoppippi/ccusage

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const QUOTA_BACKOFF_BASE: Duration = Duration::from_secs(60);
const QUOTA_BACKOFF_MAX: Duration = Duration::from_secs(30 * 60);
const QUOTA_TTL_MIN_SECONDS: u64 = 30;
const QUOTA_TTL_MAX_SECONDS: u64 = 60 * 60;

// ── Anthropic rate limits (from oauth/usage API) ─────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RateLimitBucket {
    pub utilization: Option<f64>,
    pub resets_at: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct AnthropicRateLimits {
    pub five_hour: RateLimitBucket,
    pub seven_day: RateLimitBucket,
    pub available: bool,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct OauthUsageResponse {
    five_hour: Option<RateLimitBucket>,
    seven_day: Option<RateLimitBucket>,
}

#[derive(Deserialize)]
struct KeychainCredentials {
    #[serde(rename = "claudeAiOauth")]
    claude_ai_oauth: Option<OauthEntry>,
}

#[derive(Deserialize)]
struct OauthEntry {
    #[serde(rename = "accessToken")]
    access_token: String,
}

fn read_claude_oauth_token() -> Result<String, String> {
    // Try macOS Keychain first
    if cfg!(target_os = "macos") {
        let out = Command::new("security")
            .args([
                "find-generic-password",
                "-s",
                "Claude Code-credentials",
                "-w",
            ])
            .output();
        if let Ok(out) = out {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let creds: KeychainCredentials = serde_json::from_str(&raw)
                    .map_err(|e| format!("Credentials parse error: {}", e))?;
                return creds
                    .claude_ai_oauth
                    .map(|o| o.access_token)
                    .ok_or_else(|| "No OAuth entry in credentials".into());
            }
        }
    }

    // Fallback: ~/.claude/.credentials.json (Windows / Linux / macOS without Keychain)
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let cred_path = home.join(".claude").join(".credentials.json");
    let raw = std::fs::read_to_string(&cred_path)
        .map_err(|_| format!("Credentials file not found: {}", cred_path.display()))?;
    let creds: KeychainCredentials =
        serde_json::from_str(&raw).map_err(|e| format!("Credentials parse error: {}", e))?;
    creds
        .claude_ai_oauth
        .map(|o| o.access_token)
        .ok_or_else(|| "No OAuth entry in credentials".into())
}

/// Read Claude Code OAuth token and fetch Anthropic usage limits.
pub fn fetch_anthropic_rate_limits() -> AnthropicRateLimits {
    // 1. Get token — macOS: Keychain, Windows/Linux: ~/.claude/.credentials.json
    let token = match read_claude_oauth_token() {
        Ok(t) => t,
        Err(e) => {
            return AnthropicRateLimits {
                error: Some(e),
                ..Default::default()
            }
        }
    };

    // 2. Call Anthropic oauth/usage API
    // curl exits 0 even on HTTP 4xx/5xx; use -w to append the HTTP status code.
    let output = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "8",
            "-w",
            "\n%{http_code}", // append status on a new line
            "-H",
            &format!("Authorization: Bearer {}", token),
            "-H",
            "anthropic-version: 2023-06-01",
            "https://api.anthropic.com/api/oauth/usage",
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout);
            // Split body and HTTP status code (appended by -w)
            let (body, http_status) = if let Some(pos) = raw.rfind('\n') {
                let status: u16 = raw[pos + 1..].trim().parse().unwrap_or(0);
                (&raw[..pos], status)
            } else {
                (raw.as_ref(), 0u16)
            };

            if !(200..300).contains(&http_status) {
                return AnthropicRateLimits {
                    error: Some(format!(
                        "HTTP {}: {}",
                        http_status,
                        body.trim().chars().take(120).collect::<String>()
                    )),
                    ..Default::default()
                };
            }

            match serde_json::from_str::<OauthUsageResponse>(body) {
                Ok(resp) => {
                    let five = resp.five_hour.unwrap_or_default();
                    let seven = resp.seven_day.unwrap_or_default();
                    // If both utilization values are None the response was likely an error body
                    if five.utilization.is_none() && seven.utilization.is_none() {
                        return AnthropicRateLimits {
                            error: Some(format!(
                                "No usage data in response: {}",
                                body.trim().chars().take(120).collect::<String>()
                            )),
                            ..Default::default()
                        };
                    }
                    AnthropicRateLimits {
                        five_hour: five,
                        seven_day: seven,
                        available: true,
                        error: None,
                    }
                }
                Err(e) => AnthropicRateLimits {
                    error: Some(format!("Parse error: {}", e)),
                    ..Default::default()
                },
            }
        }
        Ok(out) => AnthropicRateLimits {
            error: Some(format!(
                "curl error: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            )),
            ..Default::default()
        },
        Err(e) => AnthropicRateLimits {
            error: Some(format!("curl failed: {}", e)),
            ..Default::default()
        },
    }
}

// ── OpenAI / Codex rate limits ────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug, Default)]
pub struct CodexRateLimits {
    pub primary_pct: Option<f64>, // 5-hour window %
    pub primary_reset: Option<String>,
    pub secondary_pct: Option<f64>, // 7-day window %
    pub secondary_reset: Option<String>,
    pub plan_type: Option<String>,
    pub available: bool,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct WhamUsageResponse {
    plan_type: Option<String>,
    rate_limit: Option<WhamRateLimit>,
}

#[derive(Deserialize)]
struct WhamRateLimit {
    primary_window: Option<WhamWindow>,
    secondary_window: Option<WhamWindow>,
}

#[derive(Deserialize)]
struct WhamWindow {
    used_percent: Option<f64>,
    reset_at: Option<i64>, // unix epoch seconds
}

#[derive(Deserialize)]
struct CodexAuth {
    tokens: Option<CodexTokens>,
}

#[derive(Deserialize)]
struct CodexTokens {
    access_token: Option<String>,
    account_id: Option<String>,
}

pub fn fetch_codex_rate_limits() -> CodexRateLimits {
    // Read credentials from ~/.codex/auth.json
    let home = dirs::home_dir().unwrap_or_default();
    let auth_path = home.join(".codex").join("auth.json");

    let auth_raw = match std::fs::read_to_string(&auth_path) {
        Ok(s) => s,
        Err(_) => {
            return CodexRateLimits {
                error: Some("~/.codex/auth.json not found".into()),
                ..Default::default()
            }
        }
    };

    let auth: CodexAuth = match serde_json::from_str(&auth_raw) {
        Ok(a) => a,
        Err(e) => {
            return CodexRateLimits {
                error: Some(format!("auth parse: {}", e)),
                ..Default::default()
            }
        }
    };

    let tokens = match auth.tokens {
        Some(t) => t,
        None => {
            return CodexRateLimits {
                error: Some("No tokens in auth.json".into()),
                ..Default::default()
            }
        }
    };
    let access_token = match tokens.access_token {
        Some(t) => t,
        None => {
            return CodexRateLimits {
                error: Some("No access_token".into()),
                ..Default::default()
            }
        }
    };
    let account_id = tokens.account_id.unwrap_or_default();

    let out = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "8",
            "-w",
            "\n%{http_code}",
            "-H",
            &format!("Authorization: Bearer {}", access_token),
            "-H",
            &format!("ChatGPT-Account-Id: {}", account_id),
            "-H",
            "Content-Type: application/json",
            "https://chatgpt.com/backend-api/wham/usage",
        ])
        .output();

    match out {
        Ok(o) if o.status.success() => {
            let raw = String::from_utf8_lossy(&o.stdout);
            let (body, http_status) = if let Some(pos) = raw.rfind('\n') {
                let s: u16 = raw[pos + 1..].trim().parse().unwrap_or(0);
                (&raw[..pos], s)
            } else {
                (raw.as_ref(), 0u16)
            };
            if !(200..300).contains(&http_status) {
                return CodexRateLimits {
                    error: Some(format!("HTTP {}", http_status)),
                    ..Default::default()
                };
            }
            match serde_json::from_str::<WhamUsageResponse>(body) {
                Ok(resp) => {
                    let rl = resp.rate_limit.unwrap_or(WhamRateLimit {
                        primary_window: None,
                        secondary_window: None,
                    });
                    let to_iso = |ts: i64| -> String {
                        use std::time::{Duration, UNIX_EPOCH};
                        // Simple epoch → ISO-8601 via format
                        let secs = ts;
                        let d = UNIX_EPOCH + Duration::from_secs(secs as u64);
                        let dur = d.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
                        // Use the parse_iso approach in reverse: just format as ISO string
                        format!("{}Z", chrono_simple(dur))
                    };
                    let primary_reset = rl
                        .primary_window
                        .as_ref()
                        .and_then(|w| w.reset_at)
                        .map(to_iso);
                    let secondary_reset = rl
                        .secondary_window
                        .as_ref()
                        .and_then(|w| w.reset_at)
                        .map(to_iso);
                    CodexRateLimits {
                        primary_pct: rl.primary_window.and_then(|w| w.used_percent),
                        primary_reset,
                        secondary_pct: rl.secondary_window.and_then(|w| w.used_percent),
                        secondary_reset,
                        plan_type: resp.plan_type,
                        available: true,
                        error: None,
                    }
                }
                Err(e) => CodexRateLimits {
                    error: Some(format!("parse: {}", e)),
                    ..Default::default()
                },
            }
        }
        Ok(o) => CodexRateLimits {
            error: Some(format!("HTTP {}", o.status)),
            ..Default::default()
        },
        Err(e) => CodexRateLimits {
            error: Some(format!("curl: {}", e)),
            ..Default::default()
        },
    }
}

/// Minimal epoch-to-ISO conversion (no external crate needed).
fn chrono_simple(secs: u64) -> String {
    let s = secs as i64;
    let (mut y, mut m, mut d) = (1970i64, 1i64, 1i64);
    let mut remaining = s;
    // walk forward year by year (fast enough for near-future dates)
    loop {
        let days_in_year = if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
            366
        } else {
            365
        };
        if remaining < days_in_year * 86400 {
            break;
        }
        remaining -= days_in_year * 86400;
        y += 1;
    }
    let days_in_months: [i64; 12] = {
        let feb = if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
            29
        } else {
            28
        };
        [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    for days in days_in_months.iter() {
        if remaining < days * 86400 {
            break;
        }
        remaining -= days * 86400;
        m += 1;
    }
    d += remaining / 86400;
    remaining %= 86400;
    let h = remaining / 3600;
    remaining %= 3600;
    let min = remaining / 60;
    let sec = remaining % 60;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}", y, m, d, h, min, sec)
}

// ── Gemini rate limits ────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug, Default)]
pub struct GeminiRateLimits {
    pub primary_pct: Option<f64>,
    pub primary_reset: Option<String>,
    pub available: bool,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct GeminiQuotaResponse {
    rate_limit: Option<GeminiRateLimit>,
}

#[derive(Deserialize)]
struct GeminiRateLimit {
    buckets: Option<Vec<GeminiBucket>>,
}

#[derive(Deserialize)]
struct GeminiBucket {
    used_percent: Option<f64>,
    resets_at: Option<String>,
}

#[derive(Deserialize)]
struct GeminiOauthCreds {
    access_token: Option<String>,
}

pub fn fetch_gemini_rate_limits() -> GeminiRateLimits {
    let home = dirs::home_dir().unwrap_or_default();
    let creds_path = home.join(".gemini").join("oauth_creds.json");

    let creds_raw = match std::fs::read_to_string(&creds_path) {
        Ok(s) => s,
        Err(_) => {
            return GeminiRateLimits {
                error: Some("Gemini CLI not installed".into()),
                ..Default::default()
            }
        }
    };

    let creds: GeminiOauthCreds = match serde_json::from_str(&creds_raw) {
        Ok(c) => c,
        Err(e) => {
            return GeminiRateLimits {
                error: Some(format!("creds parse: {}", e)),
                ..Default::default()
            }
        }
    };

    let token = match creds.access_token {
        Some(t) => t,
        None => {
            return GeminiRateLimits {
                error: Some("No access_token in oauth_creds.json".into()),
                ..Default::default()
            }
        }
    };

    let out = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "8",
            "-w",
            "\n%{http_code}",
            "-H",
            &format!("Authorization: Bearer {}", token),
            "-H",
            "Content-Type: application/json",
            "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
        ])
        .output();

    match out {
        Ok(o) if o.status.success() => {
            let raw = String::from_utf8_lossy(&o.stdout);
            let (body, http_status) = if let Some(pos) = raw.rfind('\n') {
                let s: u16 = raw[pos + 1..].trim().parse().unwrap_or(0);
                (&raw[..pos], s)
            } else {
                (raw.as_ref(), 0u16)
            };
            if !(200..300).contains(&http_status) {
                return GeminiRateLimits {
                    error: Some(format!("HTTP {}", http_status)),
                    ..Default::default()
                };
            }
            match serde_json::from_str::<GeminiQuotaResponse>(body) {
                Ok(resp) => {
                    let first_bucket = resp
                        .rate_limit
                        .and_then(|rl| rl.buckets)
                        .and_then(|b| b.into_iter().next());
                    GeminiRateLimits {
                        primary_pct: first_bucket.as_ref().and_then(|b| b.used_percent),
                        primary_reset: first_bucket.and_then(|b| b.resets_at),
                        available: true,
                        error: None,
                    }
                }
                Err(e) => GeminiRateLimits {
                    error: Some(format!("parse: {}", e)),
                    ..Default::default()
                },
            }
        }
        Ok(o) => GeminiRateLimits {
            error: Some(format!("HTTP {}", o.status)),
            ..Default::default()
        },
        Err(e) => GeminiRateLimits {
            error: Some(format!("curl: {}", e)),
            ..Default::default()
        },
    }
}

// ── Combined snapshot ─────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct QuotaSnapshot {
    pub anthropic_limits: AnthropicRateLimits,
    pub codex_limits: CodexRateLimits,
    pub gemini_limits: GeminiRateLimits,
    pub fetched_at: String,
    pub expires_at: String,
    pub next_refresh_at: String,
    pub stale: bool,
}

#[derive(Clone, Debug)]
struct QuotaCache {
    snapshot: QuotaSnapshot,
    fetched_at: SystemTime,
    rate_limited_until: Option<SystemTime>,
    failure_count: u32,
}

static QUOTA_CACHE: OnceLock<Mutex<Option<QuotaCache>>> = OnceLock::new();

fn quota_cache() -> &'static Mutex<Option<QuotaCache>> {
    QUOTA_CACHE.get_or_init(|| Mutex::new(None))
}

fn system_time_secs(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn system_time_iso(time: SystemTime) -> String {
    format!("{}Z", chrono_simple(system_time_secs(time)))
}

fn with_quota_metadata(
    mut snapshot: QuotaSnapshot,
    fetched_at: SystemTime,
    expires_at: SystemTime,
    next_refresh_at: SystemTime,
    stale: bool,
) -> QuotaSnapshot {
    snapshot.fetched_at = system_time_iso(fetched_at);
    snapshot.expires_at = system_time_iso(expires_at);
    snapshot.next_refresh_at = system_time_iso(next_refresh_at);
    snapshot.stale = stale;
    snapshot
}

fn quota_has_429(snapshot: &QuotaSnapshot) -> bool {
    [
        snapshot.anthropic_limits.error.as_deref(),
        snapshot.codex_limits.error.as_deref(),
        snapshot.gemini_limits.error.as_deref(),
    ]
    .into_iter()
    .flatten()
    .any(|error| error.contains("429"))
}

fn quota_backoff_duration(failure_count: u32) -> Duration {
    let multiplier = 1u32.checked_shl(failure_count.min(4)).unwrap_or(16);
    QUOTA_BACKOFF_BASE
        .saturating_mul(multiplier)
        .min(QUOTA_BACKOFF_MAX)
}

fn quota_cache_ttl() -> Duration {
    let seconds = crate::commands::budget::get_budget()
        .map(|settings| settings.quota_ttl_seconds)
        .unwrap_or_else(|_| crate::commands::budget::default_quota_ttl_seconds())
        .clamp(QUOTA_TTL_MIN_SECONDS, QUOTA_TTL_MAX_SECONDS);
    Duration::from_secs(seconds)
}

pub fn fetch_quota_snapshot() -> QuotaSnapshot {
    let ((anthropic_limits, codex_limits), gemini_limits) = rayon::join(
        || rayon::join(fetch_anthropic_rate_limits, fetch_codex_rate_limits),
        fetch_gemini_rate_limits,
    );
    let now = SystemTime::now();
    QuotaSnapshot {
        anthropic_limits,
        codex_limits,
        gemini_limits,
        fetched_at: system_time_iso(now),
        expires_at: system_time_iso(now),
        next_refresh_at: system_time_iso(now),
        stale: false,
    }
}

pub fn get_quota_snapshot_cached() -> QuotaSnapshot {
    let now = SystemTime::now();
    let mut cache = quota_cache().lock().unwrap_or_else(|e| e.into_inner());

    if let Some(cached) = cache.as_ref() {
        let expires_at = cached.fetched_at + quota_cache_ttl();

        if let Some(until) = cached.rate_limited_until {
            if now < until {
                return with_quota_metadata(
                    cached.snapshot.clone(),
                    cached.fetched_at,
                    expires_at,
                    until,
                    true,
                );
            }
        }

        if now < expires_at {
            return with_quota_metadata(
                cached.snapshot.clone(),
                cached.fetched_at,
                expires_at,
                expires_at,
                false,
            );
        }
    }

    let fetched = fetch_quota_snapshot();
    let fetched_at = SystemTime::now();
    let expires_at = fetched_at + quota_cache_ttl();
    let previous_failure_count = cache.as_ref().map(|c| c.failure_count).unwrap_or(0);

    let (failure_count, rate_limited_until) = if quota_has_429(&fetched) {
        let failure_count = previous_failure_count.saturating_add(1);
        let until = fetched_at + quota_backoff_duration(failure_count);
        (failure_count, Some(until))
    } else {
        (0, None)
    };

    let next_refresh_at = rate_limited_until.unwrap_or(expires_at);
    let snapshot = with_quota_metadata(fetched, fetched_at, expires_at, next_refresh_at, false);

    *cache = Some(QuotaCache {
        snapshot: snapshot.clone(),
        fetched_at,
        rate_limited_until,
        failure_count,
    });

    snapshot
}
