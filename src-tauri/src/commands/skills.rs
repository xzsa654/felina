//! AGENT.md (subagent definition) subsystem.
//!
//! The original `list_skills` / `write_skill` / `delete_skill` were removed
//! in the `multi-agent-skills-foundation` change (decision 7 keeps the
//! subagent surface untouched while the skill subsystem moves to canonical
//! storage in `canonical_skills.rs`). Only the agent-side commands remain.

use crate::paths;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct AgentInfo {
    pub name: String,
    pub path: String,
    pub scope: String,
    pub content: String,
}

fn agents_dir_for_scope(scope: &str, project_path: Option<&str>) -> Result<PathBuf, String> {
    match scope {
        "global" => Ok(paths::global_agents_dir()),
        "project" => {
            let pp = project_path.ok_or("project_path required")?;
            Ok(PathBuf::from(pp).join(".claude").join("agents"))
        }
        _ => Err(format!("invalid scope: {scope}")),
    }
}

fn list_agent_definitions(dir: &PathBuf, scope: &str) -> Result<Vec<AgentInfo>, String> {
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("failed to read dir: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read entry: {e}"))?;
        if !entry.file_type().is_ok_and(|ft| ft.is_dir()) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let marker_path = entry.path().join("AGENT.md");
        let content = if marker_path.exists() {
            fs::read_to_string(&marker_path).unwrap_or_default()
        } else {
            String::new()
        };
        items.push(AgentInfo {
            name,
            path: entry.path().to_string_lossy().to_string(),
            scope: scope.to_string(),
            content,
        });
    }
    items.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(items)
}

#[tauri::command]
pub fn list_agents(scope: String, project_path: Option<String>) -> Result<Vec<AgentInfo>, String> {
    let dir = agents_dir_for_scope(&scope, project_path.as_deref())?;
    list_agent_definitions(&dir, &scope)
}

#[tauri::command]
pub fn write_agent(
    scope: String,
    project_path: Option<String>,
    name: String,
    content: String,
) -> Result<(), String> {
    let dir = agents_dir_for_scope(&scope, project_path.as_deref())?;
    let agent_dir = dir.join(&name);
    fs::create_dir_all(&agent_dir).map_err(|e| format!("failed to create agent dir: {e}"))?;
    fs::write(agent_dir.join("AGENT.md"), content)
        .map_err(|e| format!("failed to write agent: {e}"))
}

#[tauri::command]
pub fn delete_agent(
    scope: String,
    project_path: Option<String>,
    name: String,
) -> Result<(), String> {
    let dir = agents_dir_for_scope(&scope, project_path.as_deref())?;
    let agent_dir = dir.join(&name);
    if agent_dir.exists() {
        fs::remove_dir_all(&agent_dir).map_err(|e| format!("failed to delete agent: {e}"))?;
    }
    Ok(())
}
