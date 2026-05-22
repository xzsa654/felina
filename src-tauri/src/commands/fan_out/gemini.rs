//! Google Gemini (gemini-cli → Antigravity CLI) fan-out renderer.
//!
//! Per `agent-skills-schema` spec, Gemini's `SKILL.md` frontmatter only
//! recognises `name` + `description`. Every other canonical field is
//! deliberately dropped at render time — there's no Gemini equivalent and
//! Phase 2 may add normalize warnings to surface this to the user.

use super::{prepare_skill_subdir, resolve_pair, FanOutRenderer};
use crate::commands::agent_paths::AgentPathPair;
use crate::commands::canonical_skills::{AgentId, CanonicalSkill, SkillScope};
use std::path::{Path, PathBuf};

pub struct GeminiRenderer;

impl FanOutRenderer for GeminiRenderer {
    fn agent_id(&self) -> AgentId {
        AgentId::Gemini
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

        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(skill.name.clone()),
        );
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String(skill.description.clone()),
        );
        super::anthropic::write_skill_md(&skill_dir, &serde_yaml::Value::Mapping(fm), &skill.body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn renders_minimal_frontmatter() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-fanout-gemini-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();

        let mut extras = serde_yaml::Mapping::new();
        // Every Anthropic-only / Codex-only field must be dropped.
        extras.insert(
            serde_yaml::Value::String("effort".into()),
            serde_yaml::Value::String("high".into()),
        );
        extras.insert(
            serde_yaml::Value::String("allowed_tools".into()),
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::String("Read".into())]),
        );
        extras.insert(
            serde_yaml::Value::String("display_name".into()),
            serde_yaml::Value::String("Demo".into()),
        );

        let skill = CanonicalSkill {
            name: "demo".into(),
            description: "Demo".into(),
            agents: vec![AgentId::Gemini],
            frontmatter_extras: serde_yaml::Value::Mapping(extras),
            body: "body\n".into(),
            dirty: false,
            last_synced: None,
        };
        GeminiRenderer.render(&skill, &tmp).unwrap();

        let md = fs::read_to_string(tmp.join("demo").join("SKILL.md")).unwrap();
        assert!(md.contains("name: demo"));
        assert!(md.contains("description: Demo"));
        // Nothing else from extras should appear in the output.
        for forbidden in ["effort:", "allowed_tools", "allowed-tools", "display_name"] {
            assert!(!md.contains(forbidden), "leaked {forbidden:?}:\n{md}");
        }
    }
}
