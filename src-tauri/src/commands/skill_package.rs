//! Shared canonical Skill package import helper.
//!
//! Owns validation + write for canonical Skill packages. Archive format
//! decoding stays with callers (Hub install decodes tar.gz; Skills page
//! import decodes zip); both feed already-iterated entries here.
//!
//! The helper rejects symlink, hardlink, absolute path, and `..` traversal
//! entries before any filesystem write. It filters out publisher-local
//! `.felina-sync-meta.json` entries at any depth.

use std::io::Read;
use std::path::{Component, Path, PathBuf};

const SYNC_META_FILENAME: &str = ".felina-sync-meta.json";

pub enum EntryKind {
    File,
    Dir,
    Symlink,
    Hardlink,
}

pub struct PackageEntry<R: Read> {
    pub relative_path: PathBuf,
    pub kind: EntryKind,
    pub content: Option<R>,
}

pub fn import_entries<I, R>(entries: I, dest_root: &Path) -> Result<String, String>
where
    I: IntoIterator<Item = PackageEntry<R>>,
    R: Read,
{
    std::fs::create_dir_all(dest_root).map_err(|e| format!("failed to create dest root: {e}"))?;
    let canonical_root = dest_root
        .canonicalize()
        .map_err(|e| format!("failed to canonicalize dest root: {e}"))?;

    let mut top_level: Option<String> = None;

    for entry in entries {
        match entry.kind {
            EntryKind::Symlink => {
                return Err(format!(
                    "symlink entries are not allowed: {}",
                    entry.relative_path.display()
                ));
            }
            EntryKind::Hardlink => {
                return Err(format!(
                    "hardlink entries are not allowed: {}",
                    entry.relative_path.display()
                ));
            }
            _ => {}
        }

        let path = entry.relative_path;

        if path.is_absolute() {
            return Err(format!("absolute paths not allowed: {}", path.display()));
        }

        let mut first_normal: Option<String> = None;
        for component in path.components() {
            match component {
                Component::ParentDir => {
                    return Err(format!("path traversal not allowed: {}", path.display()));
                }
                Component::RootDir | Component::Prefix(_) => {
                    return Err(format!("absolute paths not allowed: {}", path.display()));
                }
                Component::Normal(seg) => {
                    if first_normal.is_none() {
                        first_normal = Some(seg.to_string_lossy().into_owned());
                    }
                }
                Component::CurDir => {}
            }
        }

        if path
            .file_name()
            .is_some_and(|name| name == SYNC_META_FILENAME)
        {
            continue;
        }

        if top_level.is_none() {
            top_level = first_normal;
        }

        let dest = dest_root.join(&path);

        match entry.kind {
            EntryKind::Dir => {
                std::fs::create_dir_all(&dest)
                    .map_err(|e| format!("failed to create dir {}: {e}", dest.display()))?;
            }
            EntryKind::File => {
                if let Some(parent) = dest.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("failed to create parent: {e}"))?;
                    if let Ok(canonical_parent) = parent.canonicalize() {
                        if !canonical_parent.starts_with(&canonical_root) {
                            return Err(format!(
                                "path resolves outside dest root: {}",
                                path.display()
                            ));
                        }
                    }
                }
                let mut reader = entry.content.ok_or_else(|| {
                    format!("file entry missing content reader: {}", path.display())
                })?;
                let mut buf = Vec::new();
                reader
                    .read_to_end(&mut buf)
                    .map_err(|e| format!("failed to read entry content: {e}"))?;
                std::fs::write(&dest, &buf)
                    .map_err(|e| format!("failed to write {}: {e}", dest.display()))?;
            }
            EntryKind::Symlink | EntryKind::Hardlink => unreachable!(),
        }
    }

    top_level.ok_or_else(|| "no top-level package directory found in entries".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use tempfile::TempDir;

    fn file(path: &str, content: &[u8]) -> PackageEntry<Cursor<Vec<u8>>> {
        PackageEntry {
            relative_path: PathBuf::from(path),
            kind: EntryKind::File,
            content: Some(Cursor::new(content.to_vec())),
        }
    }

    fn dir(path: &str) -> PackageEntry<Cursor<Vec<u8>>> {
        PackageEntry {
            relative_path: PathBuf::from(path),
            kind: EntryKind::Dir,
            content: None,
        }
    }

    fn kind_only(path: &str, kind: EntryKind) -> PackageEntry<Cursor<Vec<u8>>> {
        PackageEntry {
            relative_path: PathBuf::from(path),
            kind,
            content: None,
        }
    }

    #[test]
    fn valid_package_writes_skill_md_and_returns_top_level() {
        let tmp = TempDir::new().unwrap();
        let entries = vec![
            dir("code-review"),
            file("code-review/SKILL.md", b"# title\n"),
        ];
        let name = import_entries(entries, tmp.path()).unwrap();
        assert_eq!(name, "code-review");
        let written =
            std::fs::read_to_string(tmp.path().join("code-review").join("SKILL.md")).unwrap();
        assert_eq!(written, "# title\n");
    }

    #[test]
    fn sync_meta_at_root_is_filtered_out() {
        let tmp = TempDir::new().unwrap();
        let entries = vec![
            dir("code-review"),
            file("code-review/SKILL.md", b"x"),
            file(
                "code-review/.felina-sync-meta.json",
                b"{\"directoryHash\":\"X\"}",
            ),
        ];
        import_entries(entries, tmp.path()).unwrap();
        assert!(!tmp
            .path()
            .join("code-review")
            .join(".felina-sync-meta.json")
            .exists());
    }

    #[test]
    fn sync_meta_at_nested_depth_is_filtered_out() {
        let tmp = TempDir::new().unwrap();
        let entries = vec![
            dir("pkg"),
            dir("pkg/nested"),
            file("pkg/SKILL.md", b"x"),
            file("pkg/nested/.felina-sync-meta.json", b"junk"),
        ];
        import_entries(entries, tmp.path()).unwrap();
        assert!(!tmp
            .path()
            .join("pkg")
            .join("nested")
            .join(".felina-sync-meta.json")
            .exists());
    }

    #[test]
    fn symlink_entry_returns_error_before_any_write() {
        let tmp = TempDir::new().unwrap();
        let entries = vec![
            file("pkg/SKILL.md", b"x"),
            kind_only("pkg/link", EntryKind::Symlink),
        ];
        let err = import_entries(entries, tmp.path()).unwrap_err();
        assert!(err.contains("symlink"), "unexpected error: {err}");
    }

    #[test]
    fn hardlink_entry_returns_error() {
        let tmp = TempDir::new().unwrap();
        let entries = vec![kind_only("pkg/link", EntryKind::Hardlink)];
        let err = import_entries(entries, tmp.path()).unwrap_err();
        assert!(err.contains("hardlink"), "unexpected error: {err}");
    }

    #[test]
    fn absolute_path_returns_error() {
        let tmp = TempDir::new().unwrap();
        #[cfg(unix)]
        let abs = "/etc/passwd";
        #[cfg(windows)]
        let abs = "C:\\Windows\\evil";
        let entries = vec![file(abs, b"x")];
        let err = import_entries(entries, tmp.path()).unwrap_err();
        assert!(err.contains("absolute"), "unexpected error: {err}");
    }

    #[test]
    fn parent_dir_traversal_returns_error() {
        let tmp = TempDir::new().unwrap();
        let entries = vec![file("pkg/../escape.txt", b"x")];
        let err = import_entries(entries, tmp.path()).unwrap_err();
        assert!(err.contains("traversal"), "unexpected error: {err}");
    }

    #[test]
    fn empty_iterator_returns_error() {
        let tmp = TempDir::new().unwrap();
        let entries: Vec<PackageEntry<Cursor<Vec<u8>>>> = vec![];
        let err = import_entries(entries, tmp.path()).unwrap_err();
        assert!(err.contains("top-level"), "unexpected error: {err}");
    }
}
