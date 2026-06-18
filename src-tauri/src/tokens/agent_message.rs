//! Quota-window trigger messages.
//!
//! Sends a single minimal message to a provider to start (and thereby
//! control the expiry of) the usage window. Reuses the credentials already
//! read for the usage-limits fetch in `ccusage`. These paths intentionally
//! do NOT implement multi-turn conversation — one short request is enough to
//! open the window.

use std::time::Duration;

use crate::tokens::ccusage;

const CLAUDE_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
/// Small, current model — keeps the trigger cheap.
const CLAUDE_TRIGGER_MODEL: &str = "claude-haiku-4-5-20251001";
/// OAuth (claude.ai) tokens are only accepted on the Messages API when the
/// request identifies itself as Claude Code. Without this system preamble the
/// API rejects the OAuth bearer.
const CLAUDE_CODE_SYSTEM: &str = "You are Claude Code, Anthropic's official CLI for Claude.";

const CODEX_RESPONSES_URL: &str = "https://chatgpt.com/backend-api/codex/responses";
/// Fallback model when `~/.codex/config.toml` has no `model` key. ChatGPT-account
/// Codex rejects API-only models like `gpt-5-codex`, so default to a chat model.
const CODEX_FALLBACK_MODEL: &str = "gpt-5.5";

/// Read the active Codex model from `~/.codex/config.toml` (the same source the
/// Codex CLI uses), so the trigger always targets a model the account supports.
fn codex_model() -> String {
    let from_config = dirs::home_dir()
        .map(|h| h.join(".codex").join("config.toml"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|raw| raw.parse::<toml::Value>().ok())
        .and_then(|v| v.get("model").and_then(|m| m.as_str()).map(str::to_string));
    from_config.unwrap_or_else(|| CODEX_FALLBACK_MODEL.to_string())
}

fn blocking_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))
}

fn truncated(body: &str) -> String {
    body.trim().chars().take(160).collect::<String>()
}

/// Send a single short message to Claude via the Anthropic Messages API using
/// the existing Claude Code OAuth token. Returns `Ok(())` on a 2xx response,
/// otherwise an error string describing the failure.
pub fn send_claude_message(text: &str) -> Result<(), String> {
    send_claude_message_inner(ccusage::read_claude_oauth_token(), text)
}

/// Credential-injected core so the missing-credential path is unit-testable
/// without touching the network or process-global environment.
fn send_claude_message_inner(token: Result<String, String>, text: &str) -> Result<(), String> {
    let token = token?;
    let client = blocking_client()?;

    let body = serde_json::json!({
        "model": CLAUDE_TRIGGER_MODEL,
        "max_tokens": 16,
        "system": CLAUDE_CODE_SYSTEM,
        "messages": [{ "role": "user", "content": text }],
    });

    let resp = client
        .post(CLAUDE_MESSAGES_URL)
        .header("authorization", format!("Bearer {token}"))
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    let status = resp.status().as_u16();
    if (200..300).contains(&status) {
        Ok(())
    } else {
        let body = resp.text().unwrap_or_default();
        Err(format!("HTTP {status}: {}", truncated(&body)))
    }
}

/// Send a single short message to Codex via the ChatGPT backend responses
/// endpoint using the access token and account id from `~/.codex/auth.json`.
/// Returns `Ok(())` on a 2xx response, otherwise an error string.
pub fn send_codex_message(text: &str) -> Result<(), String> {
    send_codex_message_inner(ccusage::read_codex_auth(), text)
}

fn send_codex_message_inner(
    auth: Result<(String, String), String>,
    text: &str,
) -> Result<(), String> {
    let (access_token, account_id) = auth?;
    let client = blocking_client()?;

    // The ChatGPT-account responses endpoint requires `instructions` and
    // `stream: true`. We only need the request to be accepted (a 2xx opens the
    // usage window); the streamed body is intentionally not consumed.
    let body = serde_json::json!({
        "model": codex_model(),
        "instructions": "You are a helpful assistant.",
        "store": false,
        "stream": true,
        "input": [{
            "type": "message",
            "role": "user",
            "content": [{ "type": "input_text", "text": text }],
        }],
    });

    let resp = client
        .post(CODEX_RESPONSES_URL)
        .header("authorization", format!("Bearer {access_token}"))
        .header("ChatGPT-Account-Id", &account_id)
        .header("content-type", "application/json")
        .header("OpenAI-Beta", "responses=experimental")
        .json(&body)
        .send()
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    let status = resp.status().as_u16();
    // Drain the SSE stream to completion so the server actually finishes the
    // generation (and counts it). Dropping mid-stream can cancel it server-side.
    let body = resp.text().unwrap_or_default();
    if (200..300).contains(&status) {
        Ok(())
    } else {
        Err(format!("HTTP {status}: {}", truncated(&body)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_send_without_credentials_errors() {
        let err = send_claude_message_inner(Err("Credentials file not found".into()), "早安");
        assert_eq!(err, Err("Credentials file not found".into()));
    }

    #[test]
    fn codex_send_without_auth_errors() {
        let err = send_codex_message_inner(Err("~/.codex/auth.json not found".into()), "早安");
        assert_eq!(err, Err("~/.codex/auth.json not found".into()));
    }
}
