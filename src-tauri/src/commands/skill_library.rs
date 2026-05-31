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
    let file =
        fs::File::create(out).map_err(|e| format!("failed to create output file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for skill_dir in &skill_dirs {
        let skill_name = skill_dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
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
        let name = entry
            .file_name()
            .to_string_lossy();

        if should_exclude(&name, entry.file_type().is_dir()) {
            continue;
        }

        // Check if any ancestor is excluded
        let rel = entry
            .path()
            .strip_prefix(dir)
            .unwrap_or(entry.path());
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
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
}

#[tauri::command]
pub fn skill_library_import(input_path: String) -> Result<ImportResult, String> {
    let skills_dir = canonical_skills_dir();
    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("failed to create skills directory: {e}"))?;

    let file = fs::File::open(&input_path)
        .map_err(|e| format!("failed to open ZIP file: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("failed to read ZIP archive: {e}"))?;

    // Discover which top-level directories contain SKILL.md
    let mut has_skill_md = std::collections::HashSet::new();
    let mut all_top_dirs = std::collections::HashSet::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| format!("ZIP read error: {e}"))?;
        let path = entry.name().to_string();
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() >= 2 && !parts[0].is_empty() {
            all_top_dirs.insert(parts[0].to_string());
            if parts[1] == "SKILL.md" && parts.len() == 2 {
                has_skill_md.insert(parts[0].to_string());
            }
        }
    }

    let skipped = all_top_dirs.len() - has_skill_md.len();

    // Extract valid skills
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("ZIP read error: {e}"))?;
        let path = entry.name().to_string();
        let parts: Vec<&str> = path.split('/').collect();
        if parts.is_empty() || parts[0].is_empty() {
            continue;
        }
        let top_dir = parts[0];
        if !has_skill_md.contains(top_dir) {
            continue;
        }

        let dest = skills_dir.join(&path);
        if entry.is_dir() {
            fs::create_dir_all(&dest)
                .map_err(|e| format!("failed to create directory: {e}"))?;
        } else {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("failed to create parent directory: {e}"))?;
            }
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("failed to read ZIP entry: {e}"))?;
            fs::write(&dest, &buf)
                .map_err(|e| format!("failed to write file: {e}"))?;
        }
    }

    Ok(ImportResult {
        imported: has_skill_md.len(),
        skipped,
    })
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
    for entry in fs::read_dir(&skills_dir)
        .map_err(|e| format!("failed to read skills directory: {e}"))?
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
    use std::io::Read;
    use tempfile::TempDir;

    fn setup_skills_dir(tmp: &TempDir) -> PathBuf {
        let skills = tmp.path().join("skills");
        fs::create_dir_all(&skills).unwrap();
        skills
    }

    fn create_skill(skills_dir: &Path, name: &str, with_subdir: bool) {
        let skill = skills_dir.join(name);
        fs::create_dir_all(&skill).unwrap();
        fs::write(skill.join("SKILL.md"), format!("---\nname: {name}\n---\n# {name}")).unwrap();
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

    fn create_zip_from_dir(skills_dir: &Path, output: &Path) {
        let file = fs::File::create(output).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default();
        for entry in fs::read_dir(skills_dir).unwrap() {
            let entry = entry.unwrap();
            if !entry.path().is_dir() || entry.file_name().to_string_lossy() == ".git" {
                continue;
            }
            let skill_name = entry.file_name().to_string_lossy().to_string();
            for file_entry in WalkDir::new(entry.path()).min_depth(1) {
                let file_entry = file_entry.unwrap();
                if file_entry.file_name().to_string_lossy() == ".felina-sync-meta.json" {
                    continue;
                }
                let rel = file_entry
                    .path()
                    .strip_prefix(entry.path())
                    .unwrap();
                let zip_path =
                    format!("{}/{}", skill_name, rel.to_string_lossy().replace('\\', "/"));
                if file_entry.file_type().is_dir() {
                    zip.add_directory(&zip_path, opts).unwrap();
                } else {
                    zip.start_file(&zip_path, opts).unwrap();
                    let mut buf = Vec::new();
                    fs::File::open(file_entry.path())
                        .unwrap()
                        .read_to_end(&mut buf)
                        .unwrap();
                    zip.write_all(&buf).unwrap();
                }
            }
        }
        zip.finish().unwrap();
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

    // --- Import tests ---

    #[test]
    fn import_extracts_skills_with_subdirs() {
        let tmp = TempDir::new().unwrap();
        let source = setup_skills_dir(&tmp);
        create_skill(&source, "imported-skill", true);

        let zip_path = tmp.path().join("import.zip");
        create_zip_from_dir(&source, &zip_path);

        // Import into a fresh directory
        let dest = tmp.path().join("dest-skills");
        fs::create_dir_all(&dest).unwrap();

        // Manually replicate import logic with custom dir
        let file = fs::File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut has_skill_md = std::collections::HashSet::new();
        let mut all_top_dirs = std::collections::HashSet::new();
        for i in 0..archive.len() {
            let entry = archive.by_index(i).unwrap();
            let path = entry.name().to_string();
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() >= 2 && !parts[0].is_empty() {
                all_top_dirs.insert(parts[0].to_string());
                if parts[1] == "SKILL.md" && parts.len() == 2 {
                    has_skill_md.insert(parts[0].to_string());
                }
            }
        }

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).unwrap();
            let path = entry.name().to_string();
            let parts: Vec<&str> = path.split('/').collect();
            if parts.is_empty() || parts[0].is_empty() || !has_skill_md.contains(parts[0]) {
                continue;
            }
            let file_dest = dest.join(&path);
            if entry.is_dir() {
                fs::create_dir_all(&file_dest).unwrap();
            } else {
                if let Some(parent) = file_dest.parent() {
                    fs::create_dir_all(parent).unwrap();
                }
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf).unwrap();
                fs::write(&file_dest, &buf).unwrap();
            }
        }

        assert!(dest.join("imported-skill/SKILL.md").exists());
        assert!(dest.join("imported-skill/schema/ref.md").exists());
        assert!(
            !dest.join("imported-skill/.felina-sync-meta.json").exists(),
            "sync meta should not be created on import"
        );
    }

    #[test]
    fn import_skips_dirs_without_skill_md() {
        let tmp = TempDir::new().unwrap();
        let zip_path = tmp.path().join("partial.zip");

        // Create ZIP with one valid skill and one invalid dir
        let file = fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default();

        // Valid skill
        zip.start_file("good-skill/SKILL.md", opts).unwrap();
        zip.write_all(b"---\nname: good\n---\n").unwrap();

        // Invalid dir (no SKILL.md)
        zip.start_file("bad-dir/README.md", opts).unwrap();
        zip.write_all(b"# Not a skill").unwrap();

        zip.finish().unwrap();

        // Scan the zip
        let file = fs::File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut has_skill_md = std::collections::HashSet::new();
        let mut all_top_dirs = std::collections::HashSet::new();
        for i in 0..archive.len() {
            let entry = archive.by_index_raw(i).unwrap();
            let path = entry.name().to_string();
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() >= 2 && !parts[0].is_empty() {
                all_top_dirs.insert(parts[0].to_string());
                if parts[1] == "SKILL.md" && parts.len() == 2 {
                    has_skill_md.insert(parts[0].to_string());
                }
            }
        }

        assert!(has_skill_md.contains("good-skill"));
        assert!(!has_skill_md.contains("bad-dir"));
        assert_eq!(all_top_dirs.len() - has_skill_md.len(), 1); // 1 skipped
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
