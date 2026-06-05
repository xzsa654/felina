use crate::paths;
use flate2::read::GzDecoder;
use percent_encoding::{percent_encode, AsciiSet, CONTROLS};
use std::io::Read;
use tar::Archive;

const PATH_SEGMENT_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'/')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');

fn encoded_skill_name(name: &str) -> String {
    percent_encode(name.as_bytes(), PATH_SEGMENT_ENCODE_SET).to_string()
}

#[tauri::command]
pub async fn install_market_skill(name: String) -> Result<String, String> {
    super::skill_name::validate_skill_name(&name)?;

    let base = super::market_server::get_market_server_url()?;
    let url = format!(
        "{}/api/skills/{}/download",
        base.trim_end_matches('/'),
        encoded_skill_name(&name)
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("server returned {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("failed to read response: {e}"))?;

    let skills_dir = paths::felina_global_skills_dir();
    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("failed to create skills dir: {e}"))?;

    let canonical_skills_dir = skills_dir
        .canonicalize()
        .map_err(|e| format!("failed to canonicalize skills dir: {e}"))?;

    let decoder = GzDecoder::new(&bytes[..]);
    let mut archive = Archive::new(decoder);

    let mut skill_name = String::new();
    for entry in archive.entries().map_err(|e| format!("tar error: {e}"))? {
        let mut entry = entry.map_err(|e| format!("tar entry error: {e}"))?;
        let header_type = entry.header().entry_type();

        // Skip symlinks entirely — safest for a package installer
        if header_type.is_symlink() || header_type.is_hard_link() {
            continue;
        }

        let path = entry
            .path()
            .map_err(|e| format!("tar path error: {e}"))?
            .to_path_buf();

        // Reject absolute paths
        if path.is_absolute() {
            return Err("absolute paths not allowed in archive".into());
        }

        // Reject path traversal via ..
        for component in path.components() {
            if let std::path::Component::ParentDir = component {
                return Err("path traversal detected in archive".into());
            }
        }

        let dest = skills_dir.join(&path);

        if header_type.is_dir() {
            std::fs::create_dir_all(&dest)
                .map_err(|e| format!("failed to create dir: {e}"))?;
            continue;
        }

        if header_type.is_file() {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("failed to create dir: {e}"))?;
            }

            // Post-creation canonicalize check: ensure dest stays inside skills_dir
            if let Ok(canonical_dest) = dest.canonicalize() {
                if !canonical_dest.starts_with(&canonical_skills_dir) {
                    return Err(format!(
                        "path resolves outside skills directory: {}",
                        path.display()
                    ));
                }
            }

            let mut contents = Vec::new();
            entry
                .read_to_end(&mut contents)
                .map_err(|e| format!("failed to read entry: {e}"))?;
            std::fs::write(&dest, &contents)
                .map_err(|e| format!("failed to write {}: {e}", dest.display()))?;

            if skill_name.is_empty() {
                if let Some(first) = path.components().next() {
                    skill_name = first.as_os_str().to_string_lossy().into_owned();
                }
            }
        }
    }

    Ok(skill_name)
}

#[tauri::command]
pub fn get_skill_directory_hash(name: String) -> Option<String> {
    let skill_dir = paths::felina_global_skills_dir().join(&name);
    super::fan_out::directory_hash(&skill_dir)
}
