use crate::paths;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectSource {
    Cwd,
    Detected,
    Saved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownProject {
    pub path: String,
    pub sources: Vec<ProjectSource>,
}

pub fn normalize_path(p: &str) -> String {
    let mut s = p.replace('\\', "/");
    while s.ends_with('/') {
        s.pop();
    }
    if cfg!(windows) {
        s = s.to_lowercase();
    }
    s
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct KnownProjectsStore {
    #[serde(default)]
    projects: Vec<String>,
}

fn store_path() -> std::path::PathBuf {
    paths::felina_home().join("known-projects.json")
}

fn read_store() -> KnownProjectsStore {
    let path = store_path();
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return KnownProjectsStore::default(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_store(store: &KnownProjectsStore) -> Result<(), String> {
    let path = store_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create felina home: {e}"))?;
    }
    let json = serde_json::to_string_pretty(store)
        .map_err(|e| format!("failed to serialize store: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("failed to write store: {e}"))
}

#[tauri::command]
pub fn known_projects_list(
    current_project: Option<String>,
) -> Result<Vec<KnownProject>, String> {
    let mut map: std::collections::HashMap<String, Vec<ProjectSource>> =
        std::collections::HashMap::new();

    if let Some(ref cp) = current_project {
        let key = normalize_path(cp);
        if !key.is_empty() {
            map.entry(key).or_default().push(ProjectSource::Cwd);
        }
    }

    let projects_dir = paths::projects_dir();
    if projects_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            for entry in entries.flatten() {
                let hash = entry.file_name().to_string_lossy().to_string();
                if let Some(resolved) = paths::project_hash_to_path(&hash) {
                    let key = normalize_path(&resolved);
                    if !key.is_empty() {
                        let sources = map.entry(key).or_default();
                        if !sources.contains(&ProjectSource::Detected) {
                            sources.push(ProjectSource::Detected);
                        }
                    }
                }
            }
        }
    }

    let store = read_store();
    for p in &store.projects {
        let key = normalize_path(p);
        if !key.is_empty() {
            let sources = map.entry(key).or_default();
            if !sources.contains(&ProjectSource::Saved) {
                sources.push(ProjectSource::Saved);
            }
        }
    }

    let mut out: Vec<KnownProject> = map
        .into_iter()
        .map(|(path, sources)| KnownProject { path, sources })
        .collect();
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

#[tauri::command]
pub fn known_projects_add(path: String) -> Result<(), String> {
    let key = normalize_path(&path);
    if key.is_empty() {
        return Err("path must not be empty".into());
    }
    let mut store = read_store();
    let already = store.projects.iter().any(|p| normalize_path(p) == key);
    if already {
        return Ok(());
    }
    store.projects.push(path);
    write_store(&store)
}

#[tauri::command]
pub fn known_projects_remove(path: String) -> Result<(), String> {
    let key = normalize_path(&path);
    let mut store = read_store();
    store.projects.retain(|p| normalize_path(p) != key);
    write_store(&store)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    fn tempdir() -> std::path::PathBuf {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("felina-kp-test-{pid}-{nanos}-{n}"));
        fs::create_dir_all(&dir).expect("mkdir tempdir");
        dir
    }

    #[test]
    fn normalize_path_dedupes_variants() {
        let a = normalize_path("C:/proj/foo/");
        let b = normalize_path("c:/proj/foo");
        let c = normalize_path("C:/proj/foo");
        assert_eq!(a, b);
        assert_eq!(b, c);
    }

    #[test]
    fn normalize_strips_trailing_slashes() {
        assert_eq!(normalize_path("/a/b/c/"), "/a/b/c");
        assert_eq!(normalize_path("D:/x/y//"), if cfg!(windows) { "d:/x/y" } else { "D:/x/y" });
    }

    #[test]
    fn normalize_converts_backslashes() {
        let p = normalize_path(r"C:\Users\foo\project");
        assert!(!p.contains('\\'));
        assert!(p.contains("/"));
    }

    #[test]
    fn three_sources_merge_and_deduplicate() {
        let tmp = tempdir();
        let store_file = tmp.join("known-projects.json");
        fs::write(&store_file, r#"{"projects":["C:/proj/baz"]}"#).unwrap();

        let result = list_with_store(
            Some("C:/proj/foo".into()),
            &[("C:/proj/foo".into(), ProjectSource::Detected),
              ("C:/proj/bar".into(), ProjectSource::Detected)],
            &store_file,
        );

        assert_eq!(result.len(), 3);
        let foo = result.iter().find(|p| p.path.contains("foo")).unwrap();
        assert!(foo.sources.contains(&ProjectSource::Cwd));
        assert!(foo.sources.contains(&ProjectSource::Detected));
        let bar = result.iter().find(|p| p.path.contains("bar")).unwrap();
        assert!(bar.sources.contains(&ProjectSource::Detected));
        let baz = result.iter().find(|p| p.path.contains("baz")).unwrap();
        assert!(baz.sources.contains(&ProjectSource::Saved));
    }

    #[test]
    fn unresolved_hash_excluded() {
        let tmp = tempdir();
        let store_file = tmp.join("known-projects.json");
        fs::write(&store_file, r#"{"projects":[]}"#).unwrap();

        let result = list_with_store(
            Some("C:/proj/good".into()),
            &[("C:/proj/good".into(), ProjectSource::Detected)],
            &store_file,
        );
        assert_eq!(result.len(), 1);
        assert!(result[0].path.contains("good"));
    }

    #[test]
    fn malformed_store_yields_cwd_and_detected_only() {
        let tmp = tempdir();
        let store_file = tmp.join("known-projects.json");
        fs::write(&store_file, "not json at all").unwrap();

        let result = list_with_store(
            Some("C:/proj/cwd".into()),
            &[("C:/proj/det".into(), ProjectSource::Detected)],
            &store_file,
        );
        assert_eq!(result.len(), 2);
        let sources: Vec<&str> = result.iter().map(|p| p.path.as_str()).collect();
        let expected_cwd = normalize_path("C:/proj/cwd");
        let expected_det = normalize_path("C:/proj/det");
        assert!(sources.contains(&expected_cwd.as_str()));
        assert!(sources.contains(&expected_det.as_str()));
    }

    #[test]
    fn missing_store_yields_cwd_and_detected_only() {
        let tmp = tempdir();
        let store_file = tmp.join("nonexistent.json");

        let result = list_with_store(
            Some("C:/proj/x".into()),
            &[],
            &store_file,
        );
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn add_idempotent_with_variants() {
        let tmp = tempdir();
        let store_file = tmp.join("known-projects.json");
        fs::write(&store_file, r#"{"projects":["C:/proj/foo"]}"#).unwrap();

        add_with_store("C:/proj/foo/", &store_file).unwrap();
        add_with_store("c:/proj/foo", &store_file).unwrap();

        let store = read_store_at(&store_file);
        assert_eq!(store.projects.len(), 1);
    }

    #[test]
    fn remove_deletes_only_target() {
        let tmp = tempdir();
        let store_file = tmp.join("known-projects.json");
        fs::write(&store_file, r#"{"projects":["C:/proj/foo","C:/proj/bar"]}"#).unwrap();

        remove_with_store("C:/proj/foo", &store_file).unwrap();

        let store = read_store_at(&store_file);
        assert_eq!(store.projects.len(), 1);
        assert_eq!(normalize_path(&store.projects[0]), normalize_path("C:/proj/bar"));
    }

    fn read_store_at(path: &std::path::Path) -> KnownProjectsStore {
        let raw = fs::read_to_string(path).unwrap_or_default();
        serde_json::from_str(&raw).unwrap_or_default()
    }

    fn write_store_at(store: &KnownProjectsStore, path: &std::path::Path) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        let json = serde_json::to_string_pretty(store).unwrap();
        fs::write(path, json).unwrap();
    }

    fn list_with_store(
        current_project: Option<String>,
        detected: &[(String, ProjectSource)],
        store_file: &std::path::Path,
    ) -> Vec<KnownProject> {
        let mut map: std::collections::HashMap<String, Vec<ProjectSource>> =
            std::collections::HashMap::new();

        if let Some(ref cp) = current_project {
            let key = normalize_path(cp);
            if !key.is_empty() {
                map.entry(key).or_default().push(ProjectSource::Cwd);
            }
        }

        for (path, source) in detected {
            let key = normalize_path(path);
            if !key.is_empty() {
                let sources = map.entry(key).or_default();
                if !sources.contains(source) {
                    sources.push(*source);
                }
            }
        }

        let store: KnownProjectsStore = fs::read_to_string(store_file)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
        for p in &store.projects {
            let key = normalize_path(p);
            if !key.is_empty() {
                let sources = map.entry(key).or_default();
                if !sources.contains(&ProjectSource::Saved) {
                    sources.push(ProjectSource::Saved);
                }
            }
        }

        let mut out: Vec<KnownProject> = map
            .into_iter()
            .map(|(path, sources)| KnownProject { path, sources })
            .collect();
        out.sort_by(|a, b| a.path.cmp(&b.path));
        out
    }

    fn add_with_store(path: &str, store_file: &std::path::Path) -> Result<(), String> {
        let key = normalize_path(path);
        if key.is_empty() {
            return Err("path must not be empty".into());
        }
        let mut store = read_store_at(store_file);
        let already = store.projects.iter().any(|p| normalize_path(p) == key);
        if already {
            return Ok(());
        }
        store.projects.push(path.to_string());
        write_store_at(&store, store_file);
        Ok(())
    }

    fn remove_with_store(path: &str, store_file: &std::path::Path) -> Result<(), String> {
        let key = normalize_path(path);
        let mut store = read_store_at(store_file);
        store.projects.retain(|p| normalize_path(p) != key);
        write_store_at(&store, store_file);
        Ok(())
    }
}
