//! Anthropic Claude fan-out renderer.
//!
//! Maps canonical snake_case frontmatter to Anthropic's kebab-case field
//! names and writes a single `<target>/<skill-name>/SKILL.md`. Recognised
//! field set per `agent-skills-schema` spec (verified 2026-05-21).

use super::{prepare_skill_subdir, resolve_pair, FanOutRenderer};
use crate::commands::agent_paths::AgentPathPair;
use crate::commands::canonical_skills::{AgentId, CanonicalSkill, SkillScope};
use std::fs;
use std::path::{Path, PathBuf};

pub struct AnthropicRenderer;

impl FanOutRenderer for AnthropicRenderer {
    fn agent_id(&self) -> AgentId {
        AgentId::Anthropic
    }

    fn resolve_target_dir(
        &self,
        scope: SkillScope,
        project_path: Option<&str>,
        path_pair: &AgentPathPair,
    ) -> Result<PathBuf, String> {
        resolve_pair(scope, project_path, path_pair)
    }

    fn render(&self, skill: &CanonicalSkill, target_dir: &Path) -> Result<(), String> {
        let skill_dir = prepare_skill_subdir(target_dir, &skill.name)?;

        // Build frontmatter map: required fields first, then renamed extras.
        let mut map = serde_yaml::Mapping::new();
        map.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(skill.name.clone()),
        );
        map.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String(skill.description.clone()),
        );
        // Emit only fields from agent_fields.anthropic — not flat extras.
        // Each key is already in canonical (kebab-case) form.
        if let Some(serde_yaml::Value::Mapping(anth)) = skill.agent_fields.get("anthropic") {
            for (k, v) in anth {
                let serde_yaml::Value::String(key) = k else { continue; };
                if key == "name" || key == "description" || key == "agents" {
                    continue;
                }
                map.insert(serde_yaml::Value::String(key.clone()), v.clone());
            }
        }

        write_skill_md(&skill_dir, &serde_yaml::Value::Mapping(map), &skill.body)
    }
}

/// Shared SKILL.md writer: serialise frontmatter, fence with `---`, append
/// body with a trailing newline. Used by every renderer that emits a single
/// SKILL.md file.
pub(crate) fn write_skill_md(
    skill_dir: &Path,
    frontmatter: &serde_yaml::Value,
    body: &str,
) -> Result<(), String> {
    let fm_yaml = serde_yaml::to_string(frontmatter)
        .map_err(|e| format!("frontmatter serialize failed: {e}"))?;
    let fm = fm_yaml.trim_end_matches('\n');
    let body_normalized = if body.ends_with('\n') || body.is_empty() {
        body.to_string()
    } else {
        format!("{body}\n")
    };
    let out = format!("---\n{fm}\n---\n{body_normalized}");
    fs::write(skill_dir.join("SKILL.md"), out)
        .map_err(|e| format!("failed to write SKILL.md: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_skill() -> CanonicalSkill {
        let mut anth_fields = serde_yaml::Mapping::new();
        anth_fields.insert(
            serde_yaml::Value::String("allowed-tools".into()),
            serde_yaml::Value::Sequence(vec![
                serde_yaml::Value::String("Read".into()),
                serde_yaml::Value::String("Edit".into()),
            ]),
        );
        anth_fields.insert(
            serde_yaml::Value::String("effort".into()),
            serde_yaml::Value::String("high".into()),
        );
        let mut agent_fields = std::collections::BTreeMap::new();
        agent_fields.insert(
            "anthropic".to_string(),
            serde_yaml::Value::Mapping(anth_fields),
        );

        CanonicalSkill {
            canonical_id: "demo".into(),
            name: "demo".into(),
            description: "Demo skill".into(),
            agents: vec![AgentId::Anthropic, AgentId::Codex, AgentId::Gemini],
            frontmatter_extras: serde_yaml::Value::Mapping(serde_yaml::Mapping::new()),
            body: "# Demo\n\nHello.\n".into(),
            dirty: false,
            last_synced: None,
            targets: Vec::new(),
            last_sync: std::collections::BTreeMap::new(),
            agent_fields,
        }
    }

    #[test]
    fn renders_kebab_case_frontmatter() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-fanout-anthropic-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let r = AnthropicRenderer;
        r.render(&sample_skill(), &tmp).expect("render");

        let out = fs::read_to_string(tmp.join("demo").join("SKILL.md")).unwrap();
        assert!(out.contains("allowed-tools:"), "got:\n{out}");
        assert!(!out.contains("allowed_tools"), "snake_case leaked:\n{out}");
        assert!(out.contains("effort: high"));
        assert!(out.contains("# Demo"));
        // `agents` sync-control field is dropped on the Anthropic side.
        assert!(!out.contains("\nagents:"), "got:\n{out}");
    }
}
