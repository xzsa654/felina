use super::{prepare_skill_subdir, resolve_pair, FanOutRenderer};
use crate::commands::agent_paths::AgentPathPair;
use crate::commands::canonical_skills::{CanonicalSkill, SkillScope};
use std::fs;
use std::path::{Path, PathBuf};

pub struct GenericRenderer;

impl FanOutRenderer for GenericRenderer {
    fn agent_id(&self) -> &'static str {
        "generic"
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

        let mut map = serde_yaml::Mapping::new();
        map.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(skill.name.clone()),
        );
        map.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String(skill.description.clone()),
        );

        let fm_yaml = serde_yaml::to_string(&serde_yaml::Value::Mapping(map))
            .map_err(|e| format!("frontmatter serialize failed: {e}"))?;
        let body = if skill.body.ends_with('\n') || skill.body.is_empty() {
            &skill.body
        } else {
            &format!("{}\n", skill.body)
        };
        let content = format!(
            "---\n{}\n---\n{body}",
            fm_yaml.trim_end_matches('\n')
        );
        fs::write(skill_dir.join("SKILL.md"), &content)
            .map_err(|e| format!("failed to write SKILL.md: {e}"))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::canonical_skills::CanonicalSkill;

    fn test_skill() -> CanonicalSkill {
        CanonicalSkill {
            canonical_id: "my-skill".into(),
            name: "My Skill".into(),
            description: "Does things".into(),
            agents: vec!["anthropic".into()],
            frontmatter_extras: serde_yaml::Value::Mapping(serde_yaml::Mapping::new()),
            agent_fields: std::collections::BTreeMap::new(),
            body: "# Instructions\n\nDo stuff\n".into(),
            dirty: false,
            last_synced: None,
            targets: vec![],
            last_sync: std::collections::BTreeMap::new(),
            siblings_dirty: false,
        }
    }

    #[test]
    fn test_generic_renderer_output() {
        let tmp = tempfile::TempDir::new().unwrap();
        let renderer = GenericRenderer;
        let skill = test_skill();
        renderer.render(&skill, tmp.path()).unwrap();

        let content = std::fs::read_to_string(tmp.path().join("My Skill/SKILL.md")).unwrap();
        assert!(content.contains("name: My Skill"), "should have name");
        assert!(content.contains("description: Does things"), "should have description");
        assert!(content.contains("# Instructions"), "should have body");
        assert!(!content.contains("agents:"), "should NOT have agents field");
        assert!(!content.contains("x_felina"), "should NOT have agent fields");
    }
}
