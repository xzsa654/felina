// Retained-for-reference modules: kept on disk for future re-enablement
// (e.g. agent-skills-schema-reference change). Not registered in invoke_handler.
#[allow(dead_code)]
pub(crate) mod budget;
#[allow(dead_code)]
mod instructions;
#[allow(dead_code)]
mod rules;
#[allow(dead_code)]
mod stats;

pub mod maintenance;
pub mod memory;
pub mod projects;
pub mod skills;
pub mod tokens;

// multi-agent-skills-foundation: canonical storage + fan-out + import.
pub mod agent_paths;
pub mod canonical_skills;
pub mod fan_out;
pub mod known_projects;
pub mod skill_fields;
pub mod skill_import;
pub mod skill_library;
pub mod market_install;
pub mod market_server;
pub mod snapshot;
