//! Agent-scoped skill field catalog.
//!
//! Provides a static catalog of known skill frontmatter fields for each
//! supported agent target (Claude Code, Codex, Gemini CLI) plus the portable
//! Agent Skills standard fields. The frontend reads this catalog via
//! `list_skill_field_catalog` and renders type-aware controls grouped by agent.
//! Fan-out renderers use the same catalog as their output allowlist.

use serde::Serialize;

/// Where a field is emitted during fan-out.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OutputLocation {
    SkillFrontmatter,
    CodexOpenaiYaml,
}

/// The value type expected for a field.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ValueKind {
    String,
    Boolean,
    Enum,
    StringList,
    Object,
    ObjectArray,
}

/// Which agent namespace owns this field.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FieldAgent {
    Anthropic,
    Codex,
    Gemini,
    Standard,
}

impl FieldAgent {
    pub fn from_agent_key(key: &str) -> Self {
        match key {
            "anthropic" => FieldAgent::Anthropic,
            "codex" => FieldAgent::Codex,
            "gemini" => FieldAgent::Gemini,
            _ => FieldAgent::Standard,
        }
    }
}

/// One entry in the field catalog.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFieldDefinition {
    pub agent: FieldAgent,
    /// Canonical storage path, e.g. `anthropic.allowed-tools`.
    pub canonical_path: String,
    pub output_location: OutputLocation,
    /// Key as written to the output file, e.g. `allowed-tools` or
    /// `interface.display_name`.
    pub output_key: String,
    pub value_kind: ValueKind,
    /// Enum values when `value_kind == Enum`.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub enum_values: Vec<String>,
    pub source_url: String,
    pub verified_date: String,
    /// i18n key for the field label.
    pub label_key: String,
    /// i18n key for field help text.
    pub help_key: String,
}

fn anthropic_field(
    canonical_key: &str,
    output_key: &str,
    value_kind: ValueKind,
    enum_values: &[&str],
) -> SkillFieldDefinition {
    SkillFieldDefinition {
        agent: FieldAgent::Anthropic,
        canonical_path: format!("anthropic.{canonical_key}"),
        output_location: OutputLocation::SkillFrontmatter,
        output_key: output_key.to_string(),
        value_kind,
        enum_values: enum_values.iter().map(|s| s.to_string()).collect(),
        source_url: "https://docs.claude.com/en/docs/claude-code/skills".to_string(),
        verified_date: "2026-05-26".to_string(),
        label_key: format!("skills.fields.anthropic.{}", canonical_key.replace('-', "_")),
        help_key: format!(
            "skills.fields.anthropic.{}_help",
            canonical_key.replace('-', "_")
        ),
    }
}

fn codex_yaml_field(
    canonical_key: &str,
    output_key: &str,
    value_kind: ValueKind,
) -> SkillFieldDefinition {
    SkillFieldDefinition {
        agent: FieldAgent::Codex,
        canonical_path: format!("codex.{canonical_key}"),
        output_location: OutputLocation::CodexOpenaiYaml,
        output_key: output_key.to_string(),
        value_kind,
        enum_values: Vec::new(),
        source_url: "https://developers.openai.com/codex/skills".to_string(),
        verified_date: "2026-05-26".to_string(),
        label_key: format!("skills.fields.codex.{}", canonical_key.replace('.', "_").replace('-', "_")),
        help_key: format!(
            "skills.fields.codex.{}_help",
            canonical_key.replace('.', "_").replace('-', "_")
        ),
    }
}

fn standard_field(
    canonical_key: &str,
    value_kind: ValueKind,
) -> SkillFieldDefinition {
    SkillFieldDefinition {
        agent: FieldAgent::Standard,
        canonical_path: format!("standard.{canonical_key}"),
        output_location: OutputLocation::SkillFrontmatter,
        output_key: canonical_key.to_string(),
        value_kind,
        enum_values: Vec::new(),
        source_url: "https://agentskills.io/specification".to_string(),
        verified_date: "2026-05-26".to_string(),
        label_key: format!("skills.fields.standard.{}", canonical_key.replace('-', "_")),
        help_key: format!(
            "skills.fields.standard.{}_help",
            canonical_key.replace('-', "_")
        ),
    }
}

/// Build the full static catalog. Called once per `list_skill_field_catalog`
/// invocation; the data is small enough that caching isn't needed.
pub fn build_catalog() -> Vec<SkillFieldDefinition> {
    vec![
        // ── Claude Code (anthropic) ──────────────────────────────
        anthropic_field("allowed-tools", "allowed-tools", ValueKind::StringList, &[]),
        anthropic_field(
            "effort",
            "effort",
            ValueKind::Enum,
            &["low", "medium", "high", "xhigh", "max"],
        ),
        anthropic_field("model", "model", ValueKind::String, &[]),
        anthropic_field("when_to_use", "when_to_use", ValueKind::String, &[]),
        anthropic_field("argument-hint", "argument-hint", ValueKind::String, &[]),
        anthropic_field("arguments", "arguments", ValueKind::StringList, &[]),
        anthropic_field(
            "disable-model-invocation",
            "disable-model-invocation",
            ValueKind::Boolean,
            &[],
        ),
        anthropic_field("user-invocable", "user-invocable", ValueKind::Boolean, &[]),
        anthropic_field(
            "context",
            "context",
            ValueKind::Enum,
            &["fork"],
        ),
        anthropic_field("agent", "agent", ValueKind::String, &[]),
        anthropic_field("hooks", "hooks", ValueKind::Object, &[]),
        anthropic_field("paths", "paths", ValueKind::StringList, &[]),
        anthropic_field(
            "shell",
            "shell",
            ValueKind::Enum,
            &["bash", "powershell"],
        ),
        // ── Codex (agents/openai.yaml) ───────────────────────────
        codex_yaml_field(
            "interface.display_name",
            "interface.display_name",
            ValueKind::String,
        ),
        codex_yaml_field(
            "interface.short_description",
            "interface.short_description",
            ValueKind::String,
        ),
        codex_yaml_field(
            "interface.icon_small",
            "interface.icon_small",
            ValueKind::String,
        ),
        codex_yaml_field(
            "interface.icon_large",
            "interface.icon_large",
            ValueKind::String,
        ),
        codex_yaml_field(
            "interface.brand_color",
            "interface.brand_color",
            ValueKind::String,
        ),
        codex_yaml_field(
            "interface.default_prompt",
            "interface.default_prompt",
            ValueKind::String,
        ),
        codex_yaml_field(
            "policy.allow_implicit_invocation",
            "policy.allow_implicit_invocation",
            ValueKind::Boolean,
        ),
        codex_yaml_field(
            "dependencies.tools",
            "dependencies.tools",
            ValueKind::ObjectArray,
        ),
        // ── Standard (Agent Skills spec) ─────────────────────────
        standard_field("license", ValueKind::String),
        standard_field("compatibility", ValueKind::String),
        standard_field("metadata", ValueKind::Object),
        standard_field("allowed-tools", ValueKind::String),
    ]
}

/// Validate agent_fields against the catalog. Returns a list of errors.
pub fn validate_agent_fields(
    agent_fields: &std::collections::BTreeMap<String, serde_yaml::Value>,
) -> Vec<String> {
    let catalog = build_catalog();
    let mut errors = Vec::new();
    for (agent, fields) in agent_fields {
        let serde_yaml::Value::Mapping(ref m) = fields else {
            continue;
        };
        for (k, v) in m {
            let serde_yaml::Value::String(ref key) = k else {
                continue;
            };
            let canonical_path = format!("{agent}.{key}");
            if let Some(def) = catalog.iter().find(|f| f.canonical_path == canonical_path) {
                if def.value_kind == ValueKind::Enum && !def.enum_values.is_empty() {
                    if let Some(s) = v.as_str() {
                        if !def.enum_values.iter().any(|ev| ev == s) {
                            errors.push(format!(
                                "{}: invalid value \"{s}\", expected one of: {}",
                                canonical_path,
                                def.enum_values.join(", ")
                            ));
                        }
                    }
                }
            }
        }
    }
    errors
}

#[tauri::command]
pub fn list_skill_field_catalog() -> Vec<SkillFieldDefinition> {
    build_catalog()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_contains_representative_entries() {
        let catalog = build_catalog();

        // Claude Code entries
        let allowed_tools = catalog
            .iter()
            .find(|f| f.canonical_path == "anthropic.allowed-tools")
            .expect("anthropic.allowed-tools");
        assert_eq!(allowed_tools.output_location, OutputLocation::SkillFrontmatter);
        assert_eq!(allowed_tools.output_key, "allowed-tools");
        assert_eq!(allowed_tools.value_kind, ValueKind::StringList);

        let effort = catalog
            .iter()
            .find(|f| f.canonical_path == "anthropic.effort")
            .expect("anthropic.effort");
        assert_eq!(effort.value_kind, ValueKind::Enum);
        assert_eq!(
            effort.enum_values,
            vec!["low", "medium", "high", "xhigh", "max"]
        );

        // Codex entries
        let display_name = catalog
            .iter()
            .find(|f| f.canonical_path == "codex.interface.display_name")
            .expect("codex.interface.display_name");
        assert_eq!(display_name.output_location, OutputLocation::CodexOpenaiYaml);
        assert_eq!(display_name.output_key, "interface.display_name");

        let policy = catalog
            .iter()
            .find(|f| f.canonical_path == "codex.policy.allow_implicit_invocation")
            .expect("codex.policy.allow_implicit_invocation");
        assert_eq!(policy.value_kind, ValueKind::Boolean);

        // Gemini — no optional fields yet, so nothing to find
        let gemini_count = catalog.iter().filter(|f| f.agent == FieldAgent::Gemini).count();
        assert_eq!(gemini_count, 0, "Gemini has no optional fields yet");

        // Standard entries
        let license = catalog
            .iter()
            .find(|f| f.canonical_path == "standard.license")
            .expect("standard.license");
        assert_eq!(license.output_location, OutputLocation::SkillFrontmatter);
        assert_eq!(license.value_kind, ValueKind::String);
    }

    #[test]
    fn validate_rejects_invalid_enum_value() {
        let mut af = std::collections::BTreeMap::new();
        let mut anth = serde_yaml::Mapping::new();
        anth.insert(
            serde_yaml::Value::String("effort".into()),
            serde_yaml::Value::String("turbo".into()),
        );
        af.insert("anthropic".into(), serde_yaml::Value::Mapping(anth));

        let errors = validate_agent_fields(&af);
        assert_eq!(errors.len(), 1);
        assert!(errors[0].contains("turbo"), "got: {}", errors[0]);
        assert!(errors[0].contains("effort"), "got: {}", errors[0]);
    }

    #[test]
    fn validate_accepts_valid_enum_value() {
        let mut af = std::collections::BTreeMap::new();
        let mut anth = serde_yaml::Mapping::new();
        anth.insert(
            serde_yaml::Value::String("effort".into()),
            serde_yaml::Value::String("high".into()),
        );
        af.insert("anthropic".into(), serde_yaml::Value::Mapping(anth));

        let errors = validate_agent_fields(&af);
        assert!(errors.is_empty(), "got: {:?}", errors);
    }

    #[test]
    fn all_entries_have_nonempty_required_fields() {
        for field in build_catalog() {
            assert!(!field.canonical_path.is_empty(), "empty canonical_path");
            assert!(!field.output_key.is_empty(), "empty output_key");
            assert!(!field.source_url.is_empty(), "empty source_url for {}", field.canonical_path);
            assert!(!field.verified_date.is_empty(), "empty verified_date for {}", field.canonical_path);
            assert!(!field.label_key.is_empty(), "empty label_key for {}", field.canonical_path);
            assert!(!field.help_key.is_empty(), "empty help_key for {}", field.canonical_path);
        }
    }
}
