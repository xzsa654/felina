use crate::paths;
use flate2::write::GzEncoder;
use flate2::Compression;
use percent_encoding::{percent_encode, AsciiSet, CONTROLS};
use std::path::{Path, PathBuf};
use tar::Builder;
use walkdir::WalkDir;

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

fn package_entry_path(name: &str, skill_dir: &Path, path: &Path) -> Result<PathBuf, String> {
    let relative = path
        .strip_prefix(skill_dir)
        .map_err(|e| format!("failed to prepare package path: {e}"))?;
    Ok(PathBuf::from(name).join(relative))
}

fn package_skill_dir(name: &str, skill_dir: &Path) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    {
        let mut builder = Builder::new(&mut encoder);
        builder
            .append_dir(PathBuf::from(name), skill_dir)
            .map_err(|e| format!("failed to package skill root: {e}"))?;

        let mut entries = WalkDir::new(skill_dir)
            .min_depth(1)
            .into_iter()
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("failed to walk skill directory: {e}"))?;
        entries.sort_by_key(|entry| entry.path().to_path_buf());

        for entry in entries {
            let path = entry.path();
            if path
                .file_name()
                .is_some_and(|file_name| file_name == ".felina-sync-meta.json")
            {
                continue;
            }

            let package_path = package_entry_path(name, skill_dir, path)?;
            if entry.file_type().is_dir() {
                builder
                    .append_dir(package_path, path)
                    .map_err(|e| format!("failed to package directory: {e}"))?;
            } else if entry.file_type().is_file() {
                builder
                    .append_path_with_name(path, package_path)
                    .map_err(|e| format!("failed to package file: {e}"))?;
            }
        }
        builder
            .finish()
            .map_err(|e| format!("failed to finish package: {e}"))?;
    }
    encoder
        .finish()
        .map_err(|e| format!("failed to compress package: {e}"))
}

#[tauri::command]
pub async fn publish_canonical_skill(name: String) -> Result<(), String> {
    let token = super::hub_auth::read_hub_token()?
        .ok_or_else(|| "請先登入 Hub 帳號".to_string())?;
    super::skill_name::validate_skill_name(&name)?;

    let skill_dir = paths::felina_global_skills_dir().join(&name);
    if !skill_dir.is_dir() {
        return Err(format!("skill directory not found: {}", skill_dir.display()));
    }
    if !skill_dir.join("SKILL.md").is_file() {
        return Err(format!("SKILL.md not found in {}", skill_dir.display()));
    }

    let content_hash = super::fan_out::directory_hash(&skill_dir)
        .ok_or_else(|| "failed to compute skill directory hash".to_string())?;
    let package = package_skill_dir(&name, &skill_dir)?;
    let base = super::market_server::get_market_server_url()?;
    let url = format!(
        "{}/api/skills/{}",
        base.trim_end_matches('/'),
        encoded_skill_name(&name)
    );

    let part = reqwest::multipart::Part::bytes(package)
        .file_name(format!("{name}.tar.gz"))
        .mime_str("application/gzip")
        .map_err(|e| format!("failed to prepare upload: {e}"))?;
    let form = reqwest::multipart::Form::new().part("package", part);
    let response = reqwest::Client::new()
        .put(url)
        .header("X-Content-Hash", content_hash)
        .header("Authorization", format!("Bearer {token}"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("publish failed: {e}"))?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if status.as_u16() == 401 {
        return Err("登入已過期，請重新登入".to_string());
    }
    Err(format!("server returned {status}: {body}"))
}

#[tauri::command]
pub async fn delete_market_skill(name: String) -> Result<(), String> {
    let token = super::hub_auth::read_hub_token()?
        .ok_or_else(|| "請先登入 Hub 帳號".to_string())?;
    super::skill_name::validate_skill_name(&name)?;
    let base = super::market_server::get_market_server_url()?;
    let url = format!(
        "{}/api/skills/{}",
        base.trim_end_matches('/'),
        encoded_skill_name(&name)
    );
    let response = reqwest::Client::new()
        .delete(url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("delete failed: {e}"))?;

    let status = response.status();
    if status.is_success() || status == reqwest::StatusCode::NOT_FOUND {
        Ok(())
    } else if status.as_u16() == 401 {
        Err("登入已過期，請重新登入".to_string())
    } else {
        let body = response.text().await.unwrap_or_default();
        Err(format!("server returned {status}: {body}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::market_server::set_market_server_url;
    use crate::paths::set_felina_home_override_for_test;
    use flate2::read::GzDecoder;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use tar::Archive;

    fn set_test_hub_token(root: &std::path::Path) {
        let settings_path = root.join(".felina").join("settings.json");
        std::fs::create_dir_all(settings_path.parent().unwrap()).unwrap();
        std::fs::write(
            &settings_path,
            r#"{"hubToken":"test-token","hubEmail":"test@test.com"}"#,
        )
        .unwrap();
    }

    fn create_skill(root: &std::path::Path, name: &str) -> std::path::PathBuf {
        let skill_dir = root.join(".felina").join("skills").join(name);
        std::fs::create_dir_all(skill_dir.join("nested")).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\nversion: 1.0.0\ndescription: Test skill\n---\n\n# Test\n",
        )
        .unwrap();
        std::fs::write(skill_dir.join(".felina-sync-meta.json"), "{}").unwrap();
        std::fs::write(skill_dir.join("nested").join(".felina-sync-meta.json"), "{}").unwrap();
        std::fs::write(skill_dir.join("nested").join("notes.txt"), "notes").unwrap();
        skill_dir
    }

    fn spawn_put_server(status: &'static str, body: &'static str) -> (String, std::thread::JoinHandle<Vec<u8>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buffer = [0_u8; 4096];
            loop {
                let n = stream.read(&mut buffer).unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..n]);
                if let Some(header_end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..header_end]);
                    let content_length = headers
                        .lines()
                        .find_map(|line| line.strip_prefix("Content-Length: "))
                        .and_then(|value| value.trim().parse::<usize>().ok())
                        .unwrap_or(0);
                    if request.len() >= header_end + 4 + content_length {
                        break;
                    }
                }
            }
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
            request
        });
        (url, handle)
    }

    #[tokio::test]
    async fn publish_uploads_package_without_sync_meta() {
        let tmp = tempfile::tempdir().unwrap();
        create_skill(tmp.path(), "code-review");
        set_felina_home_override_for_test(Some(tmp.path().join(".felina")));
        set_test_hub_token(tmp.path());
        let (url, handle) = spawn_put_server("200 OK", "{}");
        set_market_server_url(url).unwrap();

        publish_canonical_skill("code-review".into()).await.unwrap();
        let request = handle.join().unwrap();

        let request_text = String::from_utf8_lossy(&request);
        assert!(request_text.starts_with("PUT /api/skills/code-review HTTP/1.1"));
        assert!(request_text.contains("x-content-hash: "));
        assert!(request_text.contains("name=\"package\""));
        assert!(!request_text.contains(".felina-sync-meta.json"));

        set_felina_home_override_for_test(None);
    }

    #[tokio::test]
    async fn publish_rejects_missing_skill_before_http() {
        let tmp = tempfile::tempdir().unwrap();
        set_felina_home_override_for_test(Some(tmp.path().join(".felina")));
        set_test_hub_token(tmp.path());
        let (url, _handle) = spawn_put_server("200 OK", "{}");
        set_market_server_url(url).unwrap();

        let err = publish_canonical_skill("missing".into()).await.unwrap_err();
        assert!(err.contains("skill directory not found"));

        set_felina_home_override_for_test(None);
    }

    #[tokio::test]
    async fn publish_returns_status_and_body_on_server_error() {
        let tmp = tempfile::tempdir().unwrap();
        create_skill(tmp.path(), "code-review");
        set_felina_home_override_for_test(Some(tmp.path().join(".felina")));
        set_test_hub_token(tmp.path());
        let (url, handle) = spawn_put_server("500 Internal Server Error", "upload failed");
        set_market_server_url(url).unwrap();

        let err = publish_canonical_skill("code-review".into()).await.unwrap_err();
        assert!(err.contains("500"));
        assert!(err.contains("upload failed"));
        let _ = handle.join().unwrap();

        set_felina_home_override_for_test(None);
    }

    #[tokio::test]
    async fn delete_treats_404_as_success() {
        let tmp = tempfile::tempdir().unwrap();
        set_felina_home_override_for_test(Some(tmp.path().join(".felina")));
        set_test_hub_token(tmp.path());
        let (url, handle) = spawn_put_server("404 Not Found", "missing");
        set_market_server_url(url).unwrap();

        delete_market_skill("code-review".into()).await.unwrap();
        let request = handle.join().unwrap();
        let request_text = String::from_utf8_lossy(&request);
        assert!(request_text.starts_with("DELETE /api/skills/code-review HTTP/1.1"));

        set_felina_home_override_for_test(None);
    }

    #[tokio::test]
    async fn delete_returns_status_and_body_on_server_error() {
        let tmp = tempfile::tempdir().unwrap();
        set_felina_home_override_for_test(Some(tmp.path().join(".felina")));
        set_test_hub_token(tmp.path());
        let (url, handle) = spawn_put_server("500 Internal Server Error", "delete failed");
        set_market_server_url(url).unwrap();

        let err = delete_market_skill("code-review".into()).await.unwrap_err();
        assert!(err.contains("500"));
        assert!(err.contains("delete failed"));
        let _ = handle.join().unwrap();

        set_felina_home_override_for_test(None);
    }

    #[test]
    fn package_skill_dir_excludes_sync_meta_at_any_depth() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = create_skill(tmp.path(), "code-review");
        let package = package_skill_dir("code-review", &skill_dir).unwrap();
        let decoder = GzDecoder::new(&package[..]);
        let mut archive = Archive::new(decoder);
        let mut names = archive
            .entries()
            .unwrap()
            .map(|entry| entry.unwrap().path().unwrap().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        names.sort();

        assert!(names.contains(&"code-review/SKILL.md".into()));
        assert!(names.contains(&"code-review/nested/notes.txt".into()));
        assert!(!names.iter().any(|name| name.ends_with(".felina-sync-meta.json")));
    }
}
