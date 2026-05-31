use git2::{Repository, Signature};
use std::path::{Path, PathBuf};

use crate::commands::canonical_skills::canonical_skills_dir;

fn repo_path() -> PathBuf {
    canonical_skills_dir()
}

pub fn ensure_repo() -> Result<Repository, String> {
    let path = repo_path();
    if path.join(".git").exists() {
        Repository::open(&path).map_err(|e| format!("failed to open git repo: {e}"))
    } else {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("failed to create skills dir: {e}"))?;
        Repository::init(&path).map_err(|e| format!("failed to init git repo: {e}"))
    }
}

fn ensure_repo_at(path: &Path) -> Result<Repository, String> {
    if path.join(".git").exists() {
        Repository::open(path).map_err(|e| format!("failed to open git repo: {e}"))
    } else {
        std::fs::create_dir_all(path)
            .map_err(|e| format!("failed to create dir: {e}"))?;
        Repository::init(path).map_err(|e| format!("failed to init git repo: {e}"))
    }
}

pub fn commit_skill_changes(skill_name: &str) -> Result<String, String> {
    commit_skill_changes_in(&repo_path(), skill_name)
}

pub fn rename_skill(old_name: &str, new_name: &str) -> Result<String, String> {
    rename_skill_in(&repo_path(), old_name, new_name)
}

fn rename_skill_in(root: &Path, old_name: &str, new_name: &str) -> Result<String, String> {
    let repo = ensure_repo_at(root)?;
    let mut index = repo.index().map_err(|e| format!("index error: {e}"))?;

    let old_dir = root.join(old_name);
    let new_dir = root.join(new_name);
    if !old_dir.is_dir() {
        return Err(format!("skill directory not found: {}", old_dir.display()));
    }
    if new_dir.exists() {
        return Err(format!("target directory already exists: {}", new_dir.display()));
    }

    for entry in walkdir::WalkDir::new(&old_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let rel = entry
            .path()
            .strip_prefix(root)
            .map_err(|e| format!("strip prefix error: {e}"))?;
        index
            .remove_path(rel)
            .map_err(|e| format!("git remove error: {e}"))?;
    }

    std::fs::rename(&old_dir, &new_dir)
        .map_err(|e| format!("fs rename error: {e}"))?;

    for entry in walkdir::WalkDir::new(&new_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let rel = entry
            .path()
            .strip_prefix(root)
            .map_err(|e| format!("strip prefix error: {e}"))?;
        index
            .add_path(rel)
            .map_err(|e| format!("git add error: {e}"))?;
    }

    let oid = index
        .write_tree()
        .map_err(|e| format!("write tree error: {e}"))?;
    index.write().map_err(|e| format!("index write error: {e}"))?;

    let tree = repo
        .find_tree(oid)
        .map_err(|e| format!("find tree error: {e}"))?;

    let sig = Signature::now("Felina", "felina@local")
        .map_err(|e| format!("signature error: {e}"))?;

    let message = format!("rename: {old_name} → {new_name}");

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();

    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| format!("commit error: {e}"))?;

    Ok(format!("{commit_oid}"))
}

fn commit_skill_changes_in(root: &Path, skill_name: &str) -> Result<String, String> {
    let repo = ensure_repo_at(root)?;
    let mut index = repo.index().map_err(|e| format!("index error: {e}"))?;

    let skill_dir = root.join(skill_name);
    if !skill_dir.is_dir() {
        return Err(format!("skill directory not found: {}", skill_dir.display()));
    }

    for entry in walkdir::WalkDir::new(&skill_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let rel = entry
            .path()
            .strip_prefix(root)
            .map_err(|e| format!("strip prefix error: {e}"))?;
        index
            .add_path(rel)
            .map_err(|e| format!("git add error: {e}"))?;
    }

    let oid = index
        .write_tree()
        .map_err(|e| format!("write tree error: {e}"))?;
    index.write().map_err(|e| format!("index write error: {e}"))?;

    let tree = repo
        .find_tree(oid)
        .map_err(|e| format!("find tree error: {e}"))?;

    let sig = Signature::now("Felina", "felina@local")
        .map_err(|e| format!("signature error: {e}"))?;

    let message = format!("push: {skill_name}");

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();

    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| format!("commit error: {e}"))?;

    Ok(format!("{commit_oid}"))
}

pub fn get_snapshot_content(commit_hash: &str, relative_path: &str) -> Result<Option<String>, String> {
    get_snapshot_content_in(&repo_path(), commit_hash, relative_path)
}

fn get_snapshot_content_in(
    root: &Path,
    commit_hash: &str,
    relative_path: &str,
) -> Result<Option<String>, String> {
    let repo = match Repository::open(root) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    let oid = match git2::Oid::from_str(commit_hash) {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };

    let commit = match repo.find_commit(oid) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let tree = commit
        .tree()
        .map_err(|e| format!("tree error: {e}"))?;

    let entry = match tree.get_path(Path::new(relative_path)) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };

    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| format!("blob error: {e}"))?;

    match std::str::from_utf8(blob.content()) {
        Ok(s) => Ok(Some(s.to_string())),
        Err(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_temp_repo() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().to_path_buf();
        (tmp, root)
    }

    #[test]
    fn ensure_repo_is_idempotent() {
        let (_tmp, root) = setup_temp_repo();
        let r1 = ensure_repo_at(&root).unwrap();
        assert!(root.join(".git").exists());
        drop(r1);
        let r2 = ensure_repo_at(&root).unwrap();
        assert!(root.join(".git").exists());
        drop(r2);
    }

    #[test]
    fn commit_skill_changes_returns_40_char_hex() {
        let (_tmp, root) = setup_temp_repo();
        let skill_dir = root.join("test-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "---\nname: test\n---\n# Test\n").unwrap();

        let hash = commit_skill_changes_in(&root, "test-skill").unwrap();
        assert_eq!(hash.len(), 40);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));

        let repo = Repository::open(&root).unwrap();
        let oid = git2::Oid::from_str(&hash).unwrap();
        let commit = repo.find_commit(oid).unwrap();
        assert!(commit.message().unwrap().contains("test-skill"));
    }

    #[test]
    fn get_snapshot_content_reads_committed_file() {
        let (_tmp, root) = setup_temp_repo();
        let skill_dir = root.join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let content = "---\nname: my-skill\n---\n# Hello\n";
        fs::write(skill_dir.join("SKILL.md"), content).unwrap();

        let hash = commit_skill_changes_in(&root, "my-skill").unwrap();
        let result = get_snapshot_content_in(&root, &hash, "my-skill/SKILL.md").unwrap();
        assert_eq!(result, Some(content.to_string()));
    }

    #[test]
    fn get_snapshot_content_returns_none_for_invalid_hash() {
        let (_tmp, root) = setup_temp_repo();
        ensure_repo_at(&root).unwrap();
        let result = get_snapshot_content_in(&root, "not-a-valid-hash", "foo").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn get_snapshot_content_returns_none_for_missing_file() {
        let (_tmp, root) = setup_temp_repo();
        let skill_dir = root.join("s1");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "test").unwrap();

        let hash = commit_skill_changes_in(&root, "s1").unwrap();
        let result = get_snapshot_content_in(&root, &hash, "s1/NONEXISTENT.md").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn rename_skill_creates_commit_with_both_names() {
        let (_tmp, root) = setup_temp_repo();
        let skill_dir = root.join("old-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "---\nname: old-skill\n---\n# Old\n").unwrap();

        commit_skill_changes_in(&root, "old-skill").unwrap();

        let hash = rename_skill_in(&root, "old-skill", "new-skill").unwrap();
        assert_eq!(hash.len(), 40);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));

        assert!(!root.join("old-skill").exists());
        assert!(root.join("new-skill").join("SKILL.md").is_file());

        let repo = Repository::open(&root).unwrap();
        let oid = git2::Oid::from_str(&hash).unwrap();
        let commit = repo.find_commit(oid).unwrap();
        let msg = commit.message().unwrap();
        assert!(msg.contains("old-skill"), "commit message should contain old name");
        assert!(msg.contains("new-skill"), "commit message should contain new name");
    }
}
