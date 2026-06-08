use crate::paths;
use flate2::read::GzDecoder;
use percent_encoding::{percent_encode, AsciiSet, CONTROLS};
use std::io::{Cursor, Read};
use tar::{Archive, EntryType};

use super::skill_package::{import_entries, EntryKind, PackageEntry};

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

fn decode_tar_gz(bytes: &[u8]) -> Result<Vec<PackageEntry<Cursor<Vec<u8>>>>, String> {
    let decoder = GzDecoder::new(bytes);
    let mut archive = Archive::new(decoder);
    let mut out = Vec::new();
    for entry in archive.entries().map_err(|e| format!("tar error: {e}"))? {
        let mut entry = entry.map_err(|e| format!("tar entry error: {e}"))?;
        let header_type = entry.header().entry_type();
        let path = entry
            .path()
            .map_err(|e| format!("tar path error: {e}"))?
            .to_path_buf();

        let kind = match header_type {
            EntryType::Directory => EntryKind::Dir,
            EntryType::Regular | EntryType::Continuous => EntryKind::File,
            EntryType::Symlink => EntryKind::Symlink,
            EntryType::Link => EntryKind::Hardlink,
            // Other tar entry types (block/char devices, fifo, GNU long names)
            // are not expected in a Skill package; reject them as unsafe.
            other => return Err(format!("unsupported tar entry type: {other:?}")),
        };

        let content = if matches!(kind, EntryKind::File) {
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("failed to read entry: {e}"))?;
            Some(Cursor::new(buf))
        } else {
            None
        };

        out.push(PackageEntry {
            relative_path: path,
            kind,
            content,
        });
    }
    Ok(out)
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

    let entries = decode_tar_gz(&bytes)?;
    let skills_dir = paths::felina_global_skills_dir();
    import_entries(entries, &skills_dir)
}

#[tauri::command]
pub fn uninstall_skill(name: String) -> Result<(), String> {
    super::skill_name::validate_skill_name(&name)?;
    let skill_dir = paths::felina_global_skills_dir().join(&name);
    if !skill_dir.is_dir() {
        return Err(format!("skill not found: {}", skill_dir.display()));
    }
    std::fs::remove_dir_all(&skill_dir)
        .map_err(|e| format!("failed to remove skill directory: {e}"))
}

#[tauri::command]
pub fn get_skill_directory_hash(name: String) -> Option<String> {
    let skill_dir = paths::felina_global_skills_dir().join(&name);
    super::fan_out::directory_hash(&skill_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use tar::Builder;
    use tempfile::TempDir;

    fn make_package(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            for (path, content) in entries {
                let mut header = tar::Header::new_gnu();
                header.set_path(path).unwrap();
                header.set_size(content.len() as u64);
                header.set_mode(0o644);
                header.set_entry_type(EntryType::Regular);
                header.set_cksum();
                builder.append(&header, *content).unwrap();
            }
            builder.finish().unwrap();
        }
        encoder.finish().unwrap()
    }

    #[test]
    fn decode_tar_gz_round_trip_yields_expected_entries() {
        let bytes = make_package(&[
            ("pkg/SKILL.md", b"# pkg\n"),
            ("pkg/scripts/run.sh", b"#!/bin/sh\n"),
        ]);
        let entries = decode_tar_gz(&bytes).unwrap();
        assert_eq!(entries.len(), 2);
        let paths: Vec<_> = entries
            .iter()
            .map(|e| e.relative_path.to_string_lossy().into_owned())
            .collect();
        assert!(paths.iter().any(|p| p.ends_with("SKILL.md")));
        assert!(paths.iter().any(|p| p.ends_with("run.sh")));
    }

    #[test]
    fn install_does_not_write_directory_hash_into_sync_meta() {
        // Regression guard for design decision "Installed state is derived,
        // never cached". The shared helper writes the package contents and
        // filters out `.felina-sync-meta.json`; install must not subsequently
        // write `directoryHash` into a fresh sync-meta file.
        let tmp = TempDir::new().unwrap();
        let bytes = make_package(&[
            ("pkg/SKILL.md", b"# pkg\n"),
            (
                "pkg/.felina-sync-meta.json",
                b"{\"directoryHash\":\"PUBLISHER\"}",
            ),
        ]);
        let entries = decode_tar_gz(&bytes).unwrap();
        let top = import_entries(entries, tmp.path()).unwrap();
        assert_eq!(top, "pkg");

        let meta_path = tmp.path().join("pkg").join(".felina-sync-meta.json");
        assert!(
            !meta_path.exists(),
            "publisher sync-meta must be filtered out"
        );

        // The install caller side also must not synthesise a directoryHash
        // field. We assert by checking no meta file was created.
        let entries_after: Vec<_> = std::fs::read_dir(tmp.path().join("pkg"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert!(
            !entries_after.iter().any(|n| n == ".felina-sync-meta.json"),
            "install must not create .felina-sync-meta.json"
        );
    }
}
