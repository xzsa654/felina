//! OpenAI Codex CLI fan-out renderer.
//!
//! Writes two files into `<target>/<skill-name>/`:
//!   - `SKILL.md` — frontmatter contains only `name` + `description`, then
//!     body. Per Codex docs (verified 2026-05-21), no other frontmatter
//!     fields are recognised on SKILL.md itself.
//!   - `agents/openai.yaml` — UI metadata (display_name, short_description,
//!     default_prompt) sourced from canonical extras. Sibling-file split
//!     model from the live `openai/skills` skill-creator example.

use super::{prepare_skill_subdir, resolve_pair, FanOutRenderer};
use crate::commands::agent_paths::AgentPathPair;
use crate::commands::canonical_skills::{AgentId, CanonicalSkill, SkillScope};
use std::fs;
use std::path::{Path, PathBuf};

pub struct CodexRenderer;

impl FanOutRenderer for CodexRenderer {
    fn agent_id(&self) -> AgentId {
        AgentId::Codex
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

        // SKILL.md: name + description only.
        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(skill.name.clone()),
        );
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String(skill.description.clone()),
        );
        super::anthropic::write_skill_md(&skill_dir, &serde_yaml::Value::Mapping(fm), &skill.body)?;

        // agents/openai.yaml: sourced from agent_fields.codex. Dotted keys
        // (e.g. "interface.display_name") are expanded into nested YAML.
        let codex_fields = match skill.agent_fields.get("codex") {
            Some(serde_yaml::Value::Mapping(m)) if !m.is_empty() => m,
            _ => return Ok(()),
        };

        let mut root = serde_yaml::Mapping::new();
        for (k, v) in codex_fields {
            let serde_yaml::Value::String(ref key) = k else { continue; };
            if let Some((section, field)) = key.split_once('.') {
                let section_val = root
                    .entry(serde_yaml::Value::String(section.into()))
                    .or_insert_with(|| serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
                if let serde_yaml::Value::Mapping(ref mut m) = section_val {
                    m.insert(serde_yaml::Value::String(field.into()), v.clone());
                }
            } else {
                root.insert(k.clone(), v.clone());
            }
        }

        if root.is_empty() {
            return Ok(());
        }
        let agents_dir = skill_dir.join("agents");
        fs::create_dir_all(&agents_dir)
            .map_err(|e| format!("failed to create Codex agents/ dir: {e}"))?;
        let yaml = serde_yaml::to_string(&serde_yaml::Value::Mapping(root))
            .map_err(|e| format!("openai.yaml serialize failed: {e}"))?;
        fs::write(agents_dir.join("openai.yaml"), yaml)
            .map_err(|e| format!("failed to write openai.yaml: {e}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_skill_with_ui_meta() -> CanonicalSkill {
        let mut codex_fields = serde_yaml::Mapping::new();
        codex_fields.insert(
            serde_yaml::Value::String("interface.display_name".into()),
            serde_yaml::Value::String("Demo Skill".into()),
        );
        codex_fields.insert(
            serde_yaml::Value::String("interface.short_description".into()),
            serde_yaml::Value::String("A demo".into()),
        );
        let mut agent_fields = std::collections::BTreeMap::new();
        agent_fields.insert("codex".into(), serde_yaml::Value::Mapping(codex_fields));
        // Anthropic-only field in anthropic namespace — Codex must ignore it.
        let mut anth_fields = serde_yaml::Mapping::new();
        anth_fields.insert(
            serde_yaml::Value::String("effort".into()),
            serde_yaml::Value::String("high".into()),
        );
        agent_fields.insert("anthropic".into(), serde_yaml::Value::Mapping(anth_fields));

        CanonicalSkill {
            canonical_id: "demo".into(),
            name: "demo".into(),
            description: "Demo skill".into(),
            agents: vec![AgentId::Codex],
            frontmatter_extras: serde_yaml::Value::Mapping(serde_yaml::Mapping::new()),
            body: "body".into(),
            dirty: false,
            last_synced: None,
            targets: Vec::new(),
            last_sync: std::collections::BTreeMap::new(),
            agent_fields,
        }
    }

    fn unique_tmp(label: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "felina-fanout-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn skill_md_contains_only_name_and_description() {
        let tmp = unique_tmp("codex-md");
        CodexRenderer
            .render(&sample_skill_with_ui_meta(), &tmp)
            .unwrap();
        let md = fs::read_to_string(tmp.join("demo").join("SKILL.md")).unwrap();
        assert!(md.contains("name: demo"));
        assert!(md.contains("description: Demo skill"));
        // Anthropic-only effort field must NOT leak into Codex SKILL.md.
        assert!(!md.contains("effort:"), "got:\n{md}");
        // display_name belongs in openai.yaml, not SKILL.md.
        assert!(!md.contains("display_name:"), "got:\n{md}");
    }

    #[test]
    fn openai_yaml_emitted_when_ui_meta_present() {
        let tmp = unique_tmp("codex-yaml");
        CodexRenderer
            .render(&sample_skill_with_ui_meta(), &tmp)
            .unwrap();
        let yaml = fs::read_to_string(tmp.join("demo").join("agents").join("openai.yaml")).unwrap();
        assert!(yaml.contains("interface:"));
        assert!(yaml.contains("display_name: Demo Skill"));
        assert!(yaml.contains("short_description: A demo"));
        // default_prompt wasn't set; must NOT appear.
        assert!(!yaml.contains("default_prompt"), "got:\n{yaml}");
    }

    #[test]
    fn openai_yaml_skipped_when_no_ui_meta() {
        let tmp = unique_tmp("codex-noyaml");
        let skill = CanonicalSkill {
            canonical_id: "bare".into(),
            name: "bare".into(),
            description: "bare".into(),
            agents: vec![AgentId::Codex],
            frontmatter_extras: serde_yaml::Value::Mapping(serde_yaml::Mapping::new()),
            body: "x".into(),
            dirty: false,
            last_synced: None,
            targets: Vec::new(),
            last_sync: std::collections::BTreeMap::new(),
            agent_fields: std::collections::BTreeMap::new(),
        };
        CodexRenderer.render(&skill, &tmp).unwrap();
        assert!(!tmp.join("bare").join("agents").exists());
    }
}
