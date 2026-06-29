//! Quota-window trigger messages.
//!
//! Sends a single minimal message to a provider to start (and thereby
//! control the expiry of) the usage window. Reuses the credentials already
//! read for the usage-limits fetch in `ccusage`. These paths intentionally
//! do NOT implement multi-turn conversation — one short request is enough to
//! open the window.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

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
const CODEX_ORIGINATOR: &str = "codex_cli_rs";
const CODEX_USER_AGENT: &str = "codex_cli_rs/0.0.0 (Unknown 0; unknown) unknown";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentCompletion {
    pub markdown: String,
    pub model: String,
}

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

fn sanitize_credential_error(provider: &str) -> String {
    format!("JESSE_AGENT_AUTH_REQUIRED:{provider}")
}

fn provider_http_error(provider: &str, status: u16, _body: &str) -> String {
    if matches!(status, 401 | 403) {
        return sanitize_credential_error(provider);
    }
    format!("{provider} request failed with HTTP {status}")
}

/// Send a single short message to Claude via the Anthropic Messages API using
/// the existing Claude Code OAuth token. Returns `Ok(())` on a 2xx response,
/// otherwise an error string describing the failure.
pub fn send_claude_message(text: &str) -> Result<(), String> {
    send_claude_message_inner(ccusage::read_claude_oauth_token(), text)
}

pub fn generate_claude_assistant(prompt: &str) -> Result<AgentCompletion, String> {
    generate_claude_assistant_inner(ccusage::read_claude_oauth_token(), prompt)
}

fn extract_claude_text(body: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    let content = value.get("content")?.as_array()?;
    let text = content
        .iter()
        .filter_map(|item| {
            if item.get("type").and_then(|v| v.as_str()) == Some("text") {
                item.get("text").and_then(|v| v.as_str())
            } else {
                None
            }
        })
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn generate_claude_assistant_inner(
    token: Result<String, String>,
    prompt: &str,
) -> Result<AgentCompletion, String> {
    let token = token.map_err(|_| sanitize_credential_error("Claude"))?;
    let client = blocking_client()?;

    let body = serde_json::json!({
        "model": CLAUDE_TRIGGER_MODEL,
        "max_tokens": 1200,
        "system": CLAUDE_CODE_SYSTEM,
        "messages": [{ "role": "user", "content": prompt }],
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
    let body = resp.text().unwrap_or_default();
    if !(200..300).contains(&status) {
        return Err(provider_http_error("Claude", status, &body));
    }
    let markdown = extract_claude_text(&body)
        .ok_or_else(|| "Claude returned no assistant text".to_string())?;
    Ok(AgentCompletion {
        markdown,
        model: CLAUDE_TRIGGER_MODEL.to_string(),
    })
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

pub fn generate_codex_assistant(prompt: &str) -> Result<AgentCompletion, String> {
    generate_codex_assistant_inner(ccusage::read_codex_auth(), prompt)
}

fn append_codex_text_from_value(value: &serde_json::Value, out: &mut String) {
    match value {
        serde_json::Value::Object(map) => {
            let type_hint = map.get("type").and_then(|v| v.as_str()).unwrap_or_default();
            let role_hint = map.get("role").and_then(|v| v.as_str()).unwrap_or_default();
            if type_hint.contains("output_text") || type_hint == "text" || role_hint == "assistant"
            {
                if let Some(text) = map
                    .get("delta")
                    .or_else(|| map.get("text"))
                    .or_else(|| map.get("content"))
                    .and_then(|v| v.as_str())
                {
                    out.push_str(text);
                }
            }
            for value in map.values() {
                append_codex_text_from_value(value, out);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                append_codex_text_from_value(item, out);
            }
        }
        _ => {}
    }
}

fn collect_codex_response_shape(
    value: &serde_json::Value,
    types: &mut Vec<String>,
    keys: &mut Vec<String>,
) {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(type_hint) = map.get("type").and_then(|v| v.as_str()) {
                push_unique(types, type_hint);
            }
            for key in map.keys().take(8) {
                push_unique(keys, key);
            }
            for value in map.values() {
                collect_codex_response_shape(value, types, keys);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items.iter().take(12) {
                collect_codex_response_shape(item, types, keys);
            }
        }
        _ => {}
    }
}

fn push_unique(values: &mut Vec<String>, value: &str) {
    if values.len() >= 10 || values.iter().any(|existing| existing == value) {
        return;
    }
    values.push(value.to_string());
}

fn codex_response_shape(body: &str) -> String {
    let mut types = Vec::new();
    let mut keys = Vec::new();
    let mut event_lines = 0usize;
    let mut data_lines = 0usize;
    let mut json_data_lines = 0usize;
    let mut non_json_data_lines = 0usize;
    let mut non_sse_lines = 0usize;
    for line in body.lines() {
        let trimmed = line.trim();
        let raw = if let Some(rest) = trimmed.strip_prefix("data:") {
            data_lines += 1;
            rest.trim()
        } else {
            if trimmed.starts_with("event:") {
                event_lines += 1;
            } else if !trimmed.is_empty() {
                non_sse_lines += 1;
            }
            trimmed
        };
        if raw.is_empty() || raw == "[DONE]" || raw.starts_with("event:") {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) {
            json_data_lines += 1;
            collect_codex_response_shape(&value, &mut types, &mut keys);
        } else if trimmed.starts_with("data:") {
            non_json_data_lines += 1;
        }
    }
    format!(
        "bytes={}; lines={}; events={}; data={}; json_data={}; non_json_data={}; non_sse={}; types=[{}]; keys=[{}]",
        body.len(),
        body.lines().count(),
        event_lines,
        data_lines,
        json_data_lines,
        non_json_data_lines,
        non_sse_lines,
        if types.is_empty() { "none".to_string() } else { types.join(",") },
        if keys.is_empty() { "none".to_string() } else { keys.join(",") },
    )
}

fn extract_codex_text(body: &str) -> Option<String> {
    let mut out = String::new();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(body) {
        append_codex_text_from_value(&value, &mut out);
        if !out.trim().is_empty() {
            return Some(out.trim().to_string());
        }
    }

    for line in body.lines() {
        let trimmed = line.trim();
        let raw = if let Some(rest) = trimmed.strip_prefix("data:") {
            rest.trim()
        } else {
            trimmed
        };
        if raw.is_empty() || raw == "[DONE]" || raw.starts_with("event:") {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) {
            append_codex_text_from_value(&value, &mut out);
        }
    }

    if out.trim().is_empty() {
        None
    } else {
        Some(out.trim().to_string())
    }
}

fn codex_streaming_assistant_body(model: &str, prompt: &str) -> serde_json::Value {
    serde_json::json!({
        "model": model,
        "instructions": "You are Jesse, Felina's assistant. Return concise markdown.",
        "store": false,
        "stream": true,
        "include": ["reasoning.encrypted_content"],
        "input": [{
            "type": "message",
            "role": "user",
            "content": [{ "type": "input_text", "text": prompt }],
        }],
    })
}

fn codex_session_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("felina-{}-{millis}", std::process::id())
}

fn post_codex_assistant_request(
    client: &reqwest::blocking::Client,
    endpoint: &str,
    access_token: &str,
    account_id: &str,
    model: &str,
    prompt: &str,
    session_id: &str,
) -> Result<(u16, String), String> {
    let body = codex_streaming_assistant_body(model, prompt);
    let resp = client
        .post(endpoint)
        .header("authorization", format!("Bearer {access_token}"))
        .header("ChatGPT-Account-Id", account_id)
        .header("content-type", "application/json")
        .header("accept", "text/event-stream")
        .header("originator", CODEX_ORIGINATOR)
        .header("user-agent", CODEX_USER_AGENT)
        .header("session_id", session_id)
        .header("OpenAI-Beta", "responses=experimental")
        .json(&body)
        .send()
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    let status = resp.status().as_u16();
    let body = resp.text().unwrap_or_default();
    Ok((status, body))
}

fn generate_codex_assistant_inner(
    auth: Result<(String, String), String>,
    prompt: &str,
) -> Result<AgentCompletion, String> {
    generate_codex_assistant_with_endpoint_inner(auth, prompt, CODEX_RESPONSES_URL)
}

fn generate_codex_assistant_with_endpoint_inner(
    auth: Result<(String, String), String>,
    prompt: &str,
    endpoint: &str,
) -> Result<AgentCompletion, String> {
    let (access_token, account_id) = auth.map_err(|_| sanitize_credential_error("Codex"))?;
    if access_token.trim().is_empty() || account_id.trim().is_empty() {
        return Err(sanitize_credential_error("Codex"));
    }
    let client = blocking_client()?;
    let model = codex_model();
    let session_id = codex_session_id();

    let (status, body) = post_codex_assistant_request(
        &client,
        endpoint,
        &access_token,
        &account_id,
        &model,
        prompt,
        &session_id,
    )?;
    if !(200..300).contains(&status) {
        return Err(provider_http_error("Codex", status, &body));
    }
    if let Some(markdown) = extract_codex_text(&body) {
        return Ok(AgentCompletion { markdown, model });
    }

    if body.trim().is_empty() {
        let stream_shape = codex_response_shape(&body);
        let (fallback_status, fallback_body) = post_codex_assistant_request(
            &client,
            endpoint,
            &access_token,
            &account_id,
            &model,
            prompt,
            &session_id,
        )?;
        if !(200..300).contains(&fallback_status) {
            return Err(provider_http_error(
                "Codex",
                fallback_status,
                &fallback_body,
            ));
        }
        if let Some(markdown) = extract_codex_text(&fallback_body) {
            return Ok(AgentCompletion { markdown, model });
        }
        return Err(format!(
            "Codex returned no assistant text (stream_shape={}; fallback_shape={})",
            stream_shape,
            codex_response_shape(&fallback_body)
        ));
    }

    Err(format!(
        "Codex returned no assistant text ({})",
        codex_response_shape(&body)
    ))
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
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

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

    #[test]
    fn claude_text_extraction_reads_content_blocks() {
        let body = r#"{
            "content": [
                { "type": "text", "text": "First line." },
                { "type": "text", "text": "Second line." }
            ]
        }"#;

        assert_eq!(
            extract_claude_text(body),
            Some("First line.\nSecond line.".to_string())
        );
    }

    #[test]
    fn codex_text_extraction_reads_sse_output_text_delta() {
        let body = concat!(
            "event: response.output_text.delta\n",
            "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}\n\n",
            "event: response.output_text.delta\n",
            "data: {\"type\":\"response.output_text.delta\",\"delta\":\" Jesse\"}\n\n",
            "data: [DONE]\n"
        );

        assert_eq!(extract_codex_text(body), Some("Hello Jesse".to_string()));
    }

    #[test]
    fn codex_text_extraction_reads_assistant_text_content() {
        let body = concat!(
            "event: response.completed\n",
            "data: {\"type\":\"response.completed\",\"response\":{\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Hello from message\"}]}]}}\n\n",
            "data: [DONE]\n"
        );

        assert_eq!(
            extract_codex_text(body),
            Some("Hello from message".to_string())
        );
    }

    #[test]
    fn codex_text_extraction_reads_full_json_response() {
        let body = r#"{
            "type": "response.completed",
            "response": {
                "output": [{
                    "type": "message",
                    "role": "assistant",
                    "content": [{ "type": "output_text", "text": "Hello from full json" }]
                }]
            }
        }"#;

        assert_eq!(
            extract_codex_text(body),
            Some("Hello from full json".to_string())
        );
    }

    fn read_http_request(stream: &mut std::net::TcpStream) -> String {
        let mut bytes = Vec::new();
        let mut buf = [0u8; 512];
        let mut header_end = None;
        while header_end.is_none() {
            let count = stream.read(&mut buf).expect("read request headers");
            assert!(count > 0, "client closed before request headers");
            bytes.extend_from_slice(&buf[..count]);
            header_end = bytes.windows(4).position(|window| window == b"\r\n\r\n");
        }

        let header_end = header_end.expect("headers should be complete") + 4;
        let headers = String::from_utf8_lossy(&bytes[..header_end]);
        let content_length = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                if name.eq_ignore_ascii_case("content-length") {
                    value.trim().parse::<usize>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0);

        let mut body_bytes = bytes.len().saturating_sub(header_end);
        while body_bytes < content_length {
            let count = stream.read(&mut buf).expect("read request body");
            assert!(count > 0, "client closed before request body");
            bytes.extend_from_slice(&buf[..count]);
            body_bytes += count;
        }

        String::from_utf8(bytes).expect("request should be utf8")
    }

    #[test]
    fn codex_assistant_retries_stream_when_stream_body_is_empty() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
        let url = format!("http://{}", listener.local_addr().expect("mock addr"));
        let server = thread::spawn(move || {
            let (mut first, _) = listener.accept().expect("first request");
            let first_request = read_http_request(&mut first);
            assert!(first_request.contains("\"stream\":true"));
            assert!(first_request.contains("\"include\":[\"reasoning.encrypted_content\"]"));
            assert!(first_request.contains("accept: text/event-stream"));
            assert!(first_request.contains("originator: codex_cli_rs"));
            assert!(first_request.contains("session_id: "));
            first
                .write_all(b"HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
                .expect("write first response");

            let (mut second, _) = listener.accept().expect("second request");
            let second_request = read_http_request(&mut second);
            assert!(second_request.contains("\"stream\":true"));
            assert!(second_request.contains("accept: text/event-stream"));
            let response_body =
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Fallback text\"}\n\n";
            let response = format!(
                "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            second
                .write_all(response.as_bytes())
                .expect("write second response");
        });

        let completion = generate_codex_assistant_with_endpoint_inner(
            Ok(("secret-token".into(), "account-123".into())),
            "secret prompt",
            &url,
        )
        .expect("fallback should produce assistant text");

        server.join().expect("mock server should finish");
        assert_eq!(completion.markdown, "Fallback text");
    }

    #[test]
    fn codex_assistant_empty_stream_fallback_error_omits_secrets() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
        let url = format!("http://{}", listener.local_addr().expect("mock addr"));
        let server = thread::spawn(move || {
            let (mut first, _) = listener.accept().expect("first request");
            let first_request = read_http_request(&mut first);
            assert!(first_request.contains("\"stream\":true"));
            first
                .write_all(b"HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
                .expect("write first response");

            let (mut second, _) = listener.accept().expect("second request");
            let second_request = read_http_request(&mut second);
            assert!(second_request.contains("\"stream\":true"));
            let response_body = "data: secret response body\n\n";
            let response = format!(
                "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            second
                .write_all(response.as_bytes())
                .expect("write second response");
        });

        let err = generate_codex_assistant_with_endpoint_inner(
            Ok(("secret-token".into(), "account-123".into())),
            "secret prompt",
            &url,
        )
        .unwrap_err();

        server.join().expect("mock server should finish");
        assert!(err.contains("stream_shape="));
        assert!(err.contains("fallback_shape="));
        assert!(!err.contains("secret-token"));
        assert!(!err.contains("account-123"));
        assert!(!err.contains("secret prompt"));
        assert!(!err.contains("secret response body"));
    }

    #[test]
    fn codex_shape_summary_omits_raw_text() {
        let body = "data: {\"type\":\"response.failed\",\"error\":{\"message\":\"secret prompt text\"}}\n\n";
        let shape = codex_response_shape(body);

        assert!(shape.contains("response.failed"));
        assert!(shape.contains("error"));
        assert!(shape.contains("json_data=1"));
        assert!(!shape.contains("secret prompt text"));
    }

    #[test]
    fn codex_shape_summary_reports_empty_body() {
        let shape = codex_response_shape("");

        assert!(shape.contains("bytes=0"));
        assert!(shape.contains("data=0"));
        assert!(shape.contains("types=[none]"));
    }

    #[test]
    fn codex_shape_summary_reports_non_json_data_without_body_text() {
        let shape = codex_response_shape("event: message\ndata: secret non-json body\n\n");

        assert!(shape.contains("events=1"));
        assert!(shape.contains("data=1"));
        assert!(shape.contains("non_json_data=1"));
        assert!(!shape.contains("secret non-json body"));
    }

    #[test]
    fn assistant_generation_without_credentials_errors_without_secrets() {
        let err =
            generate_codex_assistant_inner(Err("secret-token account-123".to_string()), "prompt")
                .unwrap_err();

        assert!(!err.contains("secret-token"));
        assert!(!err.contains("account-123"));
    }

    #[test]
    fn claude_assistant_generation_without_credentials_errors_without_secrets() {
        let err = generate_claude_assistant_inner(Err("secret-oauth-token".to_string()), "prompt")
            .unwrap_err();

        assert!(!err.contains("secret-oauth-token"));
        assert!(err.contains("JESSE_AGENT_AUTH_REQUIRED:Claude"));
    }

    #[test]
    fn codex_assistant_generation_rejects_empty_account_id_before_http() {
        let err =
            generate_codex_assistant_inner(Ok(("token".into(), "".into())), "prompt").unwrap_err();

        assert!(err.contains("JESSE_AGENT_AUTH_REQUIRED:Codex"));
        assert!(!err.contains("token"));
    }

    #[test]
    fn provider_http_error_message_omits_raw_body() {
        let err = provider_http_error("Codex", 500, "prompt and account diagnostics");

        assert!(err.contains("Codex request failed with HTTP 500"));
        assert!(!err.contains("prompt"));
        assert!(!err.contains("account diagnostics"));
    }

    #[test]
    fn provider_auth_http_errors_use_stable_hint_code() {
        let err = provider_http_error("Codex", 401, "prompt and account diagnostics");

        assert_eq!(err, "JESSE_AGENT_AUTH_REQUIRED:Codex");
        assert!(!err.contains("prompt"));
        assert!(!err.contains("account diagnostics"));
    }
}
