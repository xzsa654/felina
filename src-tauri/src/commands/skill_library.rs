use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use walkdir::WalkDir;

use super::canonical_skills::canonical_skills_dir;

const EXCLUDED_FILES: &[&str] = &[".felina-sync-meta.json"];
const EXCLUDED_DIRS: &[&str] = &[".git"];

fn should_exclude(entry_name: &str, is_dir: bool) -> bool {
    if is_dir {
        EXCLUDED_DIRS.contains(&entry_name)
    } else {
        EXCLUDED_FILES.contains(&entry_name)
    }
}

#[tauri::command]
pub fn skill_library_export(output_path: String) -> Result<(), String> {
    let skills_dir = canonical_skills_dir();
    if !skills_dir.exists() {
        return Err("Skill library directory does not exist".into());
    }

    let skill_dirs: Vec<_> = list_skill_dirs(&skills_dir);
    if skill_dirs.is_empty() {
        return Err("Skill library is empty — nothing to export".into());
    }

    let out = Path::new(&output_path);
    let file = fs::File::create(out).map_err(|e| format!("failed to create output file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for skill_dir in &skill_dirs {
        let skill_name = skill_dir.file_name().unwrap_or_default().to_string_lossy();
        add_dir_to_zip(&mut zip, skill_dir, &skill_name, &options)?;
    }

    zip.finish()
        .map_err(|e| format!("failed to finalize ZIP: {e}"))?;
    Ok(())
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    dir: &Path,
    prefix: &str,
    options: &zip::write::SimpleFileOptions,
) -> Result<(), String> {
    for entry in WalkDir::new(dir).min_depth(1) {
        let entry = entry.map_err(|e| format!("walk error: {e}"))?;
        let name = entry.file_name().to_string_lossy();

        if should_exclude(&name, entry.file_type().is_dir()) {
            continue;
        }

        // Check if any ancestor is excluded
        let rel = entry.path().strip_prefix(dir).unwrap_or(entry.path());
        if rel.components().any(|c| {
            let s = c.as_os_str().to_string_lossy();
            EXCLUDED_DIRS.contains(&s.as_ref())
        }) {
            continue;
        }

        let zip_path = format!("{}/{}", prefix, rel.to_string_lossy().replace('\\', "/"));

        if entry.file_type().is_dir() {
            zip.add_directory(&zip_path, *options)
                .map_err(|e| format!("failed to add directory to ZIP: {e}"))?;
        } else {
            zip.start_file(&zip_path, *options)
                .map_err(|e| format!("failed to start file in ZIP: {e}"))?;
            let mut buf = Vec::new();
            fs::File::open(entry.path())
                .and_then(|mut f| f.read_to_end(&mut buf))
                .map_err(|e| format!("failed to read {}: {e}", entry.path().display()))?;
            zip.write_all(&buf)
                .map_err(|e| format!("failed to write to ZIP: {e}"))?;
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct ResetResult {
    pub deleted: usize,
}

#[tauri::command]
pub fn skill_library_reset() -> Result<ResetResult, String> {
    let skills_dir = canonical_skills_dir();
    if !skills_dir.exists() {
        fs::create_dir_all(&skills_dir)
            .map_err(|e| format!("failed to create skills directory: {e}"))?;
        return Ok(ResetResult { deleted: 0 });
    }

    let mut deleted = 0usize;
    for entry in
        fs::read_dir(&skills_dir).map_err(|e| format!("failed to read skills directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("read_dir entry error: {e}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if name != ".git" {
                deleted += 1;
            }
            fs::remove_dir_all(&path)
                .map_err(|e| format!("failed to remove {}: {e}", path.display()))?;
        } else {
            fs::remove_file(&path)
                .map_err(|e| format!("failed to remove {}: {e}", path.display()))?;
        }
    }

    Ok(ResetResult { deleted })
}

fn list_skill_dirs(skills_dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(skills_dir) else {
        return Vec::new();
    };
    let mut dirs: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().is_dir()
                && e.file_name().to_string_lossy() != ".git"
                && e.path().join("SKILL.md").exists()
        })
        .map(|e| e.path())
        .collect();
    dirs.sort();
    dirs
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_skills_dir(tmp: &TempDir) -> PathBuf {
        let skills = tmp.path().join("skills");
        fs::create_dir_all(&skills).unwrap();
        skills
    }

    fn create_skill(skills_dir: &Path, name: &str, with_subdir: bool) {
        let skill = skills_dir.join(name);
        fs::create_dir_all(&skill).unwrap();
        fs::write(
            skill.join("SKILL.md"),
            format!("---\nname: {name}\n---\n# {name}"),
        )
        .unwrap();
        fs::write(
            skill.join(".felina-sync-meta.json"),
            r#"{"version":2,"targets":[],"dirty":false}"#,
        )
        .unwrap();
        if with_subdir {
            let sub = skill.join("schema");
            fs::create_dir_all(&sub).unwrap();
            fs::write(sub.join("ref.md"), "# Reference").unwrap();
        }
    }

    // --- Export tests ---

    #[test]
    fn export_includes_subdirs_and_excludes_meta() {
        let tmp = TempDir::new().unwrap();
        let skills = setup_skills_dir(&tmp);
        create_skill(&skills, "my-skill", true);

        // Also create .git dir to verify it's excluded
        fs::create_dir_all(skills.join(".git")).unwrap();
        fs::write(skills.join(".git").join("HEAD"), "ref").unwrap();

        let out = tmp.path().join("export.zip");

        // Use the helper directly, bypassing canonical_skills_dir()
        let file = fs::File::create(&out).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for skill_dir in list_skill_dirs(&skills) {
            let skill_name = skill_dir.file_name().unwrap().to_string_lossy();
            add_dir_to_zip(&mut zip, &skill_dir, &skill_name, &options).unwrap();
        }
        zip.finish().unwrap();

        // Verify ZIP contents
        let file = fs::File::open(&out).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.name_for_index(i).unwrap().to_string())
            .collect();

        assert!(names.contains(&"my-skill/SKILL.md".to_string()));
        assert!(names.contains(&"my-skill/schema/ref.md".to_string()));
        assert!(
            !names.iter().any(|n| n.contains(".felina-sync-meta.json")),
            "sync meta should be excluded"
        );
        assert!(
            !names.iter().any(|n| n.contains(".git")),
            ".git should be excluded"
        );
    }

    #[test]
    fn export_empty_library_returns_empty_list() {
        let tmp = TempDir::new().unwrap();
        let skills = setup_skills_dir(&tmp);
        let dirs = list_skill_dirs(&skills);
        assert!(dirs.is_empty());
    }

    // --- Reset tests ---

    #[test]
    fn reset_deletes_all_skills_and_git() {
        let tmp = TempDir::new().unwrap();
        let skills = setup_skills_dir(&tmp);
        create_skill(&skills, "skill-a", false);
        create_skill(&skills, "skill-b", true);
        fs::create_dir_all(skills.join(".git")).unwrap();
        fs::write(skills.join(".git").join("HEAD"), "ref").unwrap();

        // Count skill dirs (excluding .git)
        let skill_count = fs::read_dir(&skills)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir() && e.file_name().to_string_lossy() != ".git")
            .count();
        assert_eq!(skill_count, 2);

        // Simulate reset
        let mut deleted = 0usize;
        for entry in fs::read_dir(&skills).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                if name != ".git" {
                    deleted += 1;
                }
                fs::remove_dir_all(&path).unwrap();
            }
        }

        assert_eq!(deleted, 2);
        assert!(skills.exists(), "skills directory itself should remain");
        assert!(!skills.join(".git").exists(), ".git should be deleted");
        assert!(!skills.join("skill-a").exists());
        assert!(!skills.join("skill-b").exists());
    }
}
