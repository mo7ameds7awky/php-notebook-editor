//! Recent-notebooks store: a small JSON list in the app data directory.

use crate::config::RECENTS_MAX_ENTRIES;
use crate::models::{CommandError, ErrorCode, RecentEntry};
use std::fs;
use std::path::Path;

pub fn list(store_path: &Path) -> Vec<RecentEntry> {
    let Ok(raw) = fs::read_to_string(store_path) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write(store_path: &Path, entries: &[RecentEntry]) -> Result<(), CommandError> {
    if let Some(parent) = store_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            CommandError::new(ErrorCode::Io, format!("cannot create app data dir: {e}"))
        })?;
    }
    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| CommandError::new(ErrorCode::Internal, format!("cannot serialize recents: {e}")))?;
    fs::write(store_path, format!("{json}\n"))
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot write recents: {e}")))
}

pub fn touch(
    store_path: &Path,
    notebook_path: &str,
    title: &str,
    now_iso: &str,
) -> Result<Vec<RecentEntry>, CommandError> {
    let mut entries = list(store_path);
    entries.retain(|e| e.path != notebook_path);
    entries.insert(
        0,
        RecentEntry {
            path: notebook_path.to_string(),
            title: title.to_string(),
            last_opened_at: now_iso.to_string(),
        },
    );
    entries.sort_by(|a, b| b.last_opened_at.cmp(&a.last_opened_at));
    entries.truncate(RECENTS_MAX_ENTRIES);
    write(store_path, &entries)?;
    Ok(entries)
}

pub fn remove(store_path: &Path, notebook_path: &str) -> Result<Vec<RecentEntry>, CommandError> {
    let mut entries = list(store_path);
    entries.retain(|e| e.path != notebook_path);
    write(store_path, &entries)?;
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("recents.json");
        (dir, path)
    }

    #[test]
    fn empty_store_lists_empty() {
        let (_dir, path) = store();
        assert!(list(&path).is_empty());
    }

    #[test]
    fn corrupt_store_self_heals_to_empty() {
        let (_dir, path) = store();
        fs::write(&path, "###").unwrap();
        assert!(list(&path).is_empty());
        touch(&path, "/a.pnb.json", "A", "2026-08-03T10:00:00Z").unwrap();
        assert_eq!(list(&path).len(), 1);
    }

    #[test]
    fn touch_dedupes_by_path_and_sorts_desc() {
        let (_dir, path) = store();
        touch(&path, "/a.pnb.json", "A", "2026-08-03T10:00:00Z").unwrap();
        touch(&path, "/b.pnb.json", "B", "2026-08-03T11:00:00Z").unwrap();
        let entries = touch(&path, "/a.pnb.json", "A2", "2026-08-03T12:00:00Z").unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].path, "/a.pnb.json");
        assert_eq!(entries[0].title, "A2");
        assert_eq!(entries[1].path, "/b.pnb.json");
    }

    #[test]
    fn caps_at_max_entries() {
        let (_dir, path) = store();
        for i in 0..30 {
            touch(
                &path,
                &format!("/n{i}.pnb.json"),
                "N",
                &format!("2026-08-03T10:{:02}:00Z", i % 60),
            )
            .unwrap();
        }
        assert_eq!(list(&path).len(), RECENTS_MAX_ENTRIES);
    }

    #[test]
    fn remove_deletes_entry() {
        let (_dir, path) = store();
        touch(&path, "/a.pnb.json", "A", "2026-08-03T10:00:00Z").unwrap();
        touch(&path, "/b.pnb.json", "B", "2026-08-03T11:00:00Z").unwrap();
        let entries = remove(&path, "/a.pnb.json").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "/b.pnb.json");
    }
}
