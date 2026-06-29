use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::tokens::agent_message;

const MAX_CONTEXT_BYTES: usize = 24_000;
const MAX_CHAT_MESSAGE_CHARS: usize = 4_000;
const MAX_CHAT_TRANSCRIPT_CHARS: usize = 12_000;
const ASSISTANT_TIMEOUT_SECONDS: u64 = 45;
const JESSE_STYLE_GUIDE: &str = "\
Tone: witty and lightly humorous, like a chunky pink mascot with good timing, but never trade accuracy for jokes. \
Keep jokes short and subordinate to the data. Do not guess. If the provided context is missing the value needed to answer, say exactly what is missing.";
const TOKEN_WINDOW_FACTS: &str = "\
Token window facts Jesse must follow: Claude Code quota windows default to a 5-hour window that starts when the first message is sent and opens that window. \
When explaining the quota-window scheduler, define it as setting when Claude Code should automatically send the first quota-management message so the quota/billing window starts at that time. \
Example: if the first Claude Code message is sent at 07:00, the 5-hour window resets at 12:00. \
The quota-window scheduler only controls when that first Claude Code message is sent; it does not magically reset usage by itself. \
Do not infer reset time, expiry time, savings, or quota status unless the context explicitly provides the window start, reset timestamp, or enough metrics. \
Apply the Claude Code 5-hour rule only when the provider or context is Claude Code; do not reuse that rule for Codex.";
const RESPONSE_OPENING_RULE: &str = "\
First line: write one very plain-language sentence explaining what this /tokens feature or dragged section is for. \
Do not start with a heading, metric dump, JSON field, or joke.";
const RESPONSE_EXAMPLE_RULE: &str = "\
Use concrete examples whenever explaining quota windows, scheduler behavior, savings, reset timing, or usage meaning. \
If the context provides scheduler metrics, use its first-message time and 5-hour reset time in the example. \
Do not invent example values when the context already provides them; if a value is missing, clearly label the example as hypothetical.";
const CHART_READING_RULE: &str = "\
When the context is a chart, graph, heatmap, time series, or includes chartType/howToRead metrics, first explain how to read the chart in plain language: axes, colors, stacking, bars, or empty cells as applicable. \
Do not infer every-day activity from activeDays and totalDays alone; if inactiveDays is provided, mention it and explain that blank calendar cells mean no recorded activity.";

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct AssistantGenerateResponse {
    pub markdown: String,
    pub provider: String,
    pub model: String,
    pub generated_at: String,
}

#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AssistantChatMessage {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn assistant_generate(
    provider: String,
    action: String,
    context: serde_json::Value,
    locale: Option<String>,
) -> Result<AssistantGenerateResponse, String> {
    validate_assistant_request(&provider, &action, &context)?;
    let prompt = render_jesse_prompt(&action, &context, locale.as_deref())?;
    let provider_for_call = provider.clone();
    let completion = tokio::time::timeout(
        Duration::from_secs(ASSISTANT_TIMEOUT_SECONDS),
        tokio::task::spawn_blocking(move || match provider_for_call.as_str() {
            "codex" => agent_message::generate_codex_assistant(&prompt),
            "claude" => agent_message::generate_claude_assistant(&prompt),
            _ => Err("unsupported provider".into()),
        }),
    )
    .await
    .map_err(|_| format!("assistant request timed out after {ASSISTANT_TIMEOUT_SECONDS} seconds"))?
    .map_err(|e| format!("assistant worker failed: {e}"))??;

    Ok(AssistantGenerateResponse {
        markdown: completion.markdown,
        provider,
        model: completion.model,
        generated_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn assistant_chat(
    provider: String,
    context: serde_json::Value,
    messages: Vec<AssistantChatMessage>,
    locale: Option<String>,
) -> Result<AssistantGenerateResponse, String> {
    validate_chat_request(&provider, &context, &messages)?;
    let prompt = render_jesse_chat_prompt(&context, &messages, locale.as_deref())?;
    let provider_for_call = provider.clone();
    let completion = tokio::time::timeout(
        Duration::from_secs(ASSISTANT_TIMEOUT_SECONDS),
        tokio::task::spawn_blocking(move || match provider_for_call.as_str() {
            "codex" => agent_message::generate_codex_assistant(&prompt),
            "claude" => agent_message::generate_claude_assistant(&prompt),
            _ => Err("unsupported provider".into()),
        }),
    )
    .await
    .map_err(|_| format!("assistant request timed out after {ASSISTANT_TIMEOUT_SECONDS} seconds"))?
    .map_err(|e| format!("assistant worker failed: {e}"))??;

    Ok(AssistantGenerateResponse {
        markdown: completion.markdown,
        provider,
        model: completion.model,
        generated_at: Utc::now().to_rfc3339(),
    })
}

fn validate_assistant_request(
    provider: &str,
    action: &str,
    context: &serde_json::Value,
) -> Result<(), String> {
    if !matches!(provider, "codex" | "claude") {
        return Err(format!("unsupported provider '{provider}'"));
    }
    if !matches!(action, "summary" | "explain" | "plan") {
        return Err(format!("unsupported action '{action}'"));
    }
    let _ = normalized_context(context)?;
    let serialized =
        serde_json::to_string(context).map_err(|e| format!("context encode error: {e}"))?;
    if serialized.len() > MAX_CONTEXT_BYTES {
        return Err(format!(
            "context is too large; limit is {MAX_CONTEXT_BYTES} bytes"
        ));
    }
    Ok(())
}

fn validate_chat_request(
    provider: &str,
    context: &serde_json::Value,
    messages: &[AssistantChatMessage],
) -> Result<(), String> {
    if !matches!(provider, "codex" | "claude") {
        return Err(format!("unsupported provider '{provider}'"));
    }
    let _ = normalized_context(context)?;
    if messages.is_empty() {
        return Err("chat messages must not be empty".into());
    }
    for message in messages {
        if !matches!(message.role.as_str(), "user" | "assistant") {
            return Err(format!("unsupported chat role '{}'", message.role));
        }
        if message.content.trim().is_empty() {
            return Err("chat message content must not be empty".into());
        }
        if message.content.chars().count() > MAX_CHAT_MESSAGE_CHARS {
            return Err(format!(
                "chat message exceeds limit of {MAX_CHAT_MESSAGE_CHARS} characters"
            ));
        }
    }
    let serialized =
        serde_json::to_string(context).map_err(|e| format!("context encode error: {e}"))?;
    if serialized.len() > MAX_CONTEXT_BYTES {
        return Err(format!(
            "context is too large; limit is {MAX_CONTEXT_BYTES} bytes"
        ));
    }
    Ok(())
}

fn chat_transcript_entry(message: &AssistantChatMessage) -> String {
    format!(
        "{}: {}",
        message.role,
        message
            .content
            .trim()
            .chars()
            .take(MAX_CHAT_MESSAGE_CHARS)
            .collect::<String>()
    )
}

fn render_chat_transcript(messages: &[AssistantChatMessage]) -> String {
    let mut kept_reversed = Vec::new();
    let mut kept_chars = 0usize;
    let mut cleared = 0usize;

    for entry in messages.iter().rev().map(chat_transcript_entry) {
        let entry_chars = entry.chars().count();
        let separator_chars = if kept_reversed.is_empty() { 0 } else { 2 };
        if !kept_reversed.is_empty()
            && kept_chars + separator_chars + entry_chars > MAX_CHAT_TRANSCRIPT_CHARS
        {
            cleared += 1;
            continue;
        }
        kept_chars += separator_chars + entry_chars;
        kept_reversed.push(entry);
    }

    kept_reversed.reverse();
    if cleared > 0 {
        kept_reversed.insert(
            0,
            format!(
                "system: Earlier chat messages were automatically cleared because the thread got long. Cleared messages: {cleared}."
            ),
        );
    }
    kept_reversed.join("\n\n")
}

fn primitive_value(value: &serde_json::Value) -> Option<serde_json::Value> {
    match value {
        serde_json::Value::Null
        | serde_json::Value::Bool(_)
        | serde_json::Value::Number(_)
        | serde_json::Value::String(_) => Some(value.clone()),
        _ => None,
    }
}

fn required_string(context: &serde_json::Value, key: &str) -> Result<String, String> {
    let value = context
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("context field '{key}' must be a non-empty string"))?;
    Ok(value.to_string())
}

fn normalized_metrics(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let metrics = context
        .get("metrics")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "metrics context must include a metrics object".to_string())?;
    let mut out = serde_json::Map::new();
    for (key, value) in metrics {
        if let Some(value) = primitive_value(value) {
            out.insert(key.clone(), value);
        }
    }
    if out.is_empty() {
        return Err("metrics context must include at least one primitive metric".into());
    }
    Ok(serde_json::Value::Object(out))
}

fn normalized_rows(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let rows = context
        .get("rows")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "model-breakdown context must include rows".to_string())?;
    if rows.is_empty() {
        return Err("model-breakdown context must include at least one row".into());
    }
    let mut out = Vec::new();
    for row in rows.iter().take(8) {
        let Some(row_obj) = row.as_object() else {
            return Err("model-breakdown rows must be objects".into());
        };
        let label = row_obj
            .get("label")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "model-breakdown row label must be a non-empty string".to_string())?;
        let mut normalized = serde_json::Map::new();
        normalized.insert("label".into(), serde_json::Value::String(label.to_string()));
        if let Some(note) = row_obj
            .get("note")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            normalized.insert("note".into(), serde_json::Value::String(note.to_string()));
        }
        if let Some(metrics) = row_obj.get("metrics") {
            let row_context = serde_json::json!({ "metrics": metrics });
            normalized.insert("metrics".into(), normalized_metrics(&row_context)?);
        }
        out.push(serde_json::Value::Object(normalized));
    }
    Ok(serde_json::Value::Array(out))
}

fn normalized_context(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let context_obj = context
        .as_object()
        .ok_or_else(|| "context must be an object".to_string())?;
    if context_obj.is_empty() {
        return Err("context must not be empty".into());
    }
    let kind = context
        .get("kind")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "context field 'kind' must be a string".to_string())?;
    let mut out = serde_json::Map::new();
    out.insert("kind".into(), serde_json::Value::String(kind.to_string()));
    out.insert(
        "title".into(),
        serde_json::Value::String(required_string(context, "title")?),
    );
    out.insert(
        "source".into(),
        serde_json::Value::String(required_string(context, "source")?),
    );
    out.insert(
        "capturedAt".into(),
        serde_json::Value::String(required_string(context, "capturedAt")?),
    );
    out.insert(
        "summary".into(),
        serde_json::Value::String(required_string(context, "summary")?),
    );
    match kind {
        "token-overview" | "top-session" | "quota-snapshot" => {
            out.insert("metrics".into(), normalized_metrics(context)?);
        }
        "model-breakdown" => {
            out.insert("rows".into(), normalized_rows(context)?);
            if context.get("metrics").is_some() {
                out.insert("metrics".into(), normalized_metrics(context)?);
            }
        }
        _ => return Err(format!("unsupported context kind '{kind}'")),
    }
    Ok(serde_json::Value::Object(out))
}

fn action_instruction(action: &str) -> &'static str {
    match action {
        "summary" => "Return a concise but helpful answer for a user who dragged this item because they do not understand it. Start with the main takeaway, then explain what this specific metric means in plain language and why it may matter. Do not produce an action plan.",
        "explain" => "Explain the numbers plainly for a user reading the Tokens page.",
        "plan" => "Produce a markdown /plan with concrete next checks and expected outcomes.",
        _ => "Respond with concise markdown.",
    }
}

fn response_language(locale: Option<&str>) -> &'static str {
    match locale {
        Some("zh-TW") | Some("zh-Hant") | Some("zh") => "Traditional Chinese",
        _ => "English",
    }
}

fn render_jesse_prompt(
    action: &str,
    context: &serde_json::Value,
    locale: Option<&str>,
) -> Result<String, String> {
    let context = normalized_context(context)?;
    let context_pretty =
        serde_json::to_string_pretty(&context).map_err(|e| format!("context encode error: {e}"))?;
    let language = response_language(locale);
    Ok(format!(
        "You are Jesse, also known as pinkman, Felina's chunky pink assistant mascot.\n\
         {JESSE_STYLE_GUIDE}\n\
         Stay practical: interpret the provided /tokens context, call out uncertainty, and avoid inventing data.\n\
         {TOKEN_WINDOW_FACTS}\n\
         If the context includes a dateRange metric or Time range text, explicitly mention that time range in the answer.\n\
         {RESPONSE_OPENING_RULE}\n\
         {RESPONSE_EXAMPLE_RULE}\n\
         {CHART_READING_RULE}\n\
         Response language: {language}. Use this language for headings, bullets, explanations, and summaries.\n\
         Response format: concise markdown only. Do not include raw JSON unless it is necessary to explain a field.\n\
         Action: {action}\n\
         Instruction: {}\n\n\
         Context JSON:\n{context_pretty}",
        action_instruction(action),
    ))
}

fn render_jesse_chat_prompt(
    context: &serde_json::Value,
    messages: &[AssistantChatMessage],
    locale: Option<&str>,
) -> Result<String, String> {
    let context = normalized_context(context)?;
    let context_pretty =
        serde_json::to_string_pretty(&context).map_err(|e| format!("context encode error: {e}"))?;
    let language = response_language(locale);
    let transcript = render_chat_transcript(messages);

    Ok(format!(
        "You are Jesse, also known as pinkman, Felina's chunky pink assistant mascot.\n\
         {JESSE_STYLE_GUIDE}\n\
         You are chatting inside the /tokens page. Answer only from the provided token context and the visible chat thread.\n\
         The user is asking because this token data is unclear, so be concrete, explain terms plainly, and call out uncertainty.\n\
         {TOKEN_WINDOW_FACTS}\n\
         If the context includes a dateRange metric or Time range text, explicitly mention that time range in the answer.\n\
         {RESPONSE_OPENING_RULE}\n\
         {RESPONSE_EXAMPLE_RULE}\n\
         {CHART_READING_RULE}\n\
         Response language: {language}. Use this language for headings, bullets, explanations, and summaries.\n\
         Response format: concise markdown. Do not include raw JSON unless it is necessary to explain a field.\n\n\
         Context JSON:\n{context_pretty}\n\n\
         Chat thread:\n{transcript}",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> serde_json::Value {
        serde_json::json!({
            "kind": "quota-snapshot",
            "title": "Codex quota usage",
            "source": "tokens.quota",
            "capturedAt": "2026-06-20T12:00:00.000Z",
            "summary": "Codex quota usage is near its current window limit.",
            "metrics": {
                "usedPercent": 91,
                "remaining": "9%"
            }
        })
    }

    #[test]
    fn validation_rejects_unsupported_action_before_provider_call() {
        let err = validate_assistant_request("codex", "delete", &context()).unwrap_err();
        assert!(err.contains("unsupported action"));
    }

    #[test]
    fn validation_rejects_unsupported_provider_before_provider_call() {
        let err = validate_assistant_request("gemini", "summary", &context()).unwrap_err();
        assert!(err.contains("unsupported provider"));
    }

    #[test]
    fn validation_rejects_unknown_context_kind() {
        let mut context = context();
        context["kind"] = serde_json::Value::String("unknown".into());
        let err = validate_assistant_request("codex", "summary", &context).unwrap_err();
        assert!(err.contains("unsupported context kind"));
    }

    #[test]
    fn validation_rejects_metrics_context_without_metrics_object() {
        let mut context = context();
        context["metrics"] = serde_json::Value::Null;
        let err = validate_assistant_request("codex", "summary", &context).unwrap_err();
        assert!(err.contains("metrics"));
    }

    #[test]
    fn validation_rejects_empty_metrics_and_blank_summary() {
        let mut ctx = context();
        ctx["metrics"] = serde_json::json!({});
        let err = validate_assistant_request("codex", "summary", &ctx).unwrap_err();
        assert!(err.contains("metrics"));

        ctx = context();
        ctx["summary"] = serde_json::Value::String("   ".into());
        let err = validate_assistant_request("codex", "summary", &ctx).unwrap_err();
        assert!(err.contains("summary"));
    }

    #[test]
    fn validation_rejects_empty_rows() {
        let context = serde_json::json!({
            "kind": "model-breakdown",
            "title": "Models",
            "source": "tokens.modelBreakdown",
            "capturedAt": "2026-06-20T12:00:00.000Z",
            "summary": "Model rows",
            "rows": []
        });
        let err = validate_assistant_request("codex", "summary", &context).unwrap_err();
        assert!(err.contains("row"));
    }

    #[test]
    fn validation_rejects_oversized_context() {
        let mut context = context();
        context["summary"] = serde_json::Value::String("x".repeat(MAX_CONTEXT_BYTES));
        let err = validate_assistant_request("codex", "summary", &context).unwrap_err();
        assert!(err.contains("context is too large"));
    }

    #[test]
    fn validation_rejects_empty_context() {
        let err =
            validate_assistant_request("codex", "summary", &serde_json::json!({})).unwrap_err();
        assert!(err.contains("context"));
    }

    #[test]
    fn prompt_for_plan_contains_persona_action_and_safe_context() {
        let prompt = render_jesse_prompt("plan", &context(), Some("en")).expect("prompt");
        assert!(prompt.contains("Jesse"));
        assert!(prompt.contains("pinkman"));
        assert!(prompt.contains("/plan"));
        assert!(prompt.contains("Response language: English"));
        assert!(prompt.contains("Codex quota usage"));
        assert!(prompt.contains("tokens.quota"));
        assert!(!prompt.contains("access_token"));
        assert!(!prompt.contains("account_id"));
    }

    #[test]
    fn prompt_uses_user_locale_for_response_language() {
        let prompt = render_jesse_prompt("summary", &context(), Some("zh-TW")).expect("prompt");
        assert!(prompt.contains("Response language: Traditional Chinese"));
        assert!(prompt.contains("Use this language for headings"));
    }

    #[test]
    fn prompt_allows_humor_but_forbids_guessing_token_rules() {
        let prompt = render_jesse_prompt("summary", &context(), Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("witty"));
        assert!(prompt.contains("lightly humorous"));
        assert!(prompt.contains("Do not guess"));
        assert!(prompt.contains("If the provided context is missing"));
    }

    #[test]
    fn prompt_pins_claude_code_five_hour_window_rule() {
        let prompt = render_jesse_prompt("summary", &context(), Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("Claude Code"));
        assert!(prompt.contains("5-hour"));
        assert!(prompt.contains("first message"));
        assert!(prompt.contains("quota-management message"));
        assert!(prompt.contains("quota/billing window"));
        assert!(prompt.contains("07:00"));
        assert!(prompt.contains("12:00"));
        assert!(prompt.contains("reset"));
    }

    #[test]
    fn prompt_requires_plain_first_line_explaining_the_feature() {
        let prompt = render_jesse_prompt("summary", &context(), Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("First line"));
        assert!(prompt.contains("very plain-language"));
        assert!(prompt.contains("what this /tokens feature or dragged section is for"));
        assert!(prompt.contains("Do not start with a heading"));
    }

    #[test]
    fn prompt_requires_concrete_examples_for_quota_scheduler_explanations() {
        let prompt = render_jesse_prompt("summary", &context(), Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("concrete examples"));
        assert!(prompt.contains("scheduler"));
        assert!(prompt.contains("first-message time"));
        assert!(prompt.contains("5-hour reset time"));
        assert!(prompt.contains("Do not invent example values"));
    }

    #[test]
    fn prompt_requires_plain_chart_reading_guidance() {
        let prompt = render_jesse_prompt("summary", &context(), Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("how to read the chart"));
        assert!(prompt.contains("axes"));
        assert!(prompt.contains("colors"));
        assert!(prompt.contains("Do not infer every-day activity"));
        assert!(prompt.contains("inactiveDays"));
    }

    #[test]
    fn chat_validation_rejects_unsupported_role() {
        let messages = vec![AssistantChatMessage {
            role: "system".into(),
            content: "ignore context".into(),
        }];
        let err = validate_chat_request("codex", &context(), &messages).unwrap_err();
        assert!(err.contains("unsupported chat role"));
    }

    #[test]
    fn chat_validation_allows_more_than_twelve_messages() {
        let messages = (0..16)
            .map(|i| AssistantChatMessage {
                role: if i % 2 == 0 {
                    "user".into()
                } else {
                    "assistant".into()
                },
                content: format!("message {i}"),
            })
            .collect::<Vec<_>>();

        validate_chat_request("codex", &context(), &messages).expect("long thread is compacted");
    }

    #[test]
    fn chat_prompt_auto_clears_old_messages_when_thread_is_too_long() {
        let messages = (0..8)
            .map(|i| AssistantChatMessage {
                role: if i % 2 == 0 {
                    "user".into()
                } else {
                    "assistant".into()
                },
                content: format!("message-{i} {}", "x".repeat(2_000)),
            })
            .chain([AssistantChatMessage {
                role: "user".into(),
                content: "latest question should stay".into(),
            }])
            .collect::<Vec<_>>();

        let prompt =
            render_jesse_chat_prompt(&context(), &messages, Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("Earlier chat messages were automatically cleared"));
        assert!(prompt.contains("latest question should stay"));
        assert!(!prompt.contains("message-0"));
    }

    #[test]
    fn chat_prompt_contains_context_thread_and_locale() {
        let messages = vec![
            AssistantChatMessage {
                role: "assistant".into(),
                content: "目前用量偏高。".into(),
            },
            AssistantChatMessage {
                role: "user".into(),
                content: "這代表我快沒額度了嗎？".into(),
            },
        ];

        let prompt =
            render_jesse_chat_prompt(&context(), &messages, Some("zh-TW")).expect("prompt");

        assert!(prompt.contains("Response language: Traditional Chinese"));
        assert!(prompt.contains("Context JSON"));
        assert!(prompt.contains("assistant: 目前用量偏高。"));
        assert!(prompt.contains("user: 這代表我快沒額度了嗎？"));
        assert!(prompt.contains("Codex quota usage"));
        assert!(prompt.contains("lightly humorous"));
        assert!(prompt.contains("Claude Code"));
        assert!(prompt.contains("5-hour"));
        assert!(prompt.contains("First line"));
        assert!(prompt.contains("what this /tokens feature or dragged section is for"));
        assert!(prompt.contains("concrete examples"));
        assert!(prompt.contains("first-message time"));
    }

    #[test]
    fn prompt_omits_extra_context_fields_and_nested_metric_objects() {
        let context = serde_json::json!({
            "kind": "top-session",
            "title": "Session",
            "source": "tokens.topSessions",
            "capturedAt": "2026-06-20T12:00:00.000Z",
            "summary": "Session summary",
            "metrics": {
                "tokens": 10,
                "nested": { "ignore": true }
            },
            "access_token": "must-not-render"
        });

        let prompt = render_jesse_prompt("summary", &context, Some("en")).expect("prompt");
        assert!(prompt.contains("\"tokens\": 10"));
        assert!(!prompt.contains("nested"));
        assert!(!prompt.contains("must-not-render"));
    }

    #[test]
    fn model_breakdown_context_preserves_primitive_chart_metrics() {
        let context = serde_json::json!({
            "kind": "model-breakdown",
            "title": "Model chart",
            "source": "tokens.modelBreakdownChart",
            "capturedAt": "2026-06-20T12:00:00.000Z",
            "summary": "How to read: longer bars cost more.",
            "metrics": {
                "chartType": "model cost ranking bar chart",
                "howToRead": "Longer bars mean higher estimated cost.",
                "nested": { "ignore": true }
            },
            "rows": [{
                "label": "claude-sonnet-4",
                "metrics": { "costUsd": 1.25 }
            }]
        });

        let prompt = render_jesse_prompt("summary", &context, Some("en")).expect("prompt");
        assert!(prompt.contains("model cost ranking bar chart"));
        assert!(prompt.contains("Longer bars mean higher estimated cost"));
        assert!(!prompt.contains("ignore"));
    }
}
