//! Notebook file I/O: validated loads and atomic, conflict-checked saves.

use crate::models::{CommandError, ErrorCode, Notebook};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

const SUPPORTED_SCHEMA_VERSION: u64 = 1;

fn mtime_ms(path: &Path) -> Result<i64, CommandError> {
    let metadata = fs::metadata(path)
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot stat notebook file: {e}")))?;
    let modified = metadata
        .modified()
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot read file time: {e}")))?;
    let ms = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("file time before epoch: {e}")))?
        .as_millis() as i64;
    Ok(ms)
}

pub fn load(path: &Path) -> Result<(Notebook, i64), CommandError> {
    let raw = fs::read_to_string(path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            CommandError::new(
                ErrorCode::FileNotFound,
                format!("no notebook file at {}", path.display()),
            )
        } else {
            CommandError::new(ErrorCode::Io, format!("cannot read notebook file: {e}"))
        }
    })?;

    let value: Value = serde_json::from_str(&raw).map_err(|e| {
        CommandError::new(
            ErrorCode::InvalidNotebook,
            format!("file is not valid JSON: {e}"),
        )
    })?;

    let version = value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            CommandError::new(
                ErrorCode::InvalidNotebook,
                "missing or non-integer schemaVersion field",
            )
        })?;
    if version > SUPPORTED_SCHEMA_VERSION {
        return Err(CommandError::new(
            ErrorCode::VersionUnsupported,
            format!(
                "notebook uses schema version {version}; this app supports up to {SUPPORTED_SCHEMA_VERSION}"
            ),
        ));
    }
    if version != SUPPORTED_SCHEMA_VERSION {
        return Err(CommandError::new(
            ErrorCode::InvalidNotebook,
            format!("unsupported schema version {version}"),
        ));
    }

    let notebook: Notebook = serde_json::from_value(value).map_err(|e| {
        CommandError::new(
            ErrorCode::InvalidNotebook,
            format!("notebook shape is invalid: {e}"),
        )
    })?;

    let mtime = mtime_ms(path)?;
    Ok((notebook, mtime))
}

pub fn save(
    path: &Path,
    notebook: &Notebook,
    expected_mtime_ms: Option<i64>,
) -> Result<i64, CommandError> {
    if notebook.schema_version != SUPPORTED_SCHEMA_VERSION as u32 {
        return Err(CommandError::new(
            ErrorCode::InvalidInput,
            format!("cannot write schema version {}", notebook.schema_version),
        ));
    }

    if let Some(expected) = expected_mtime_ms {
        if !path.exists() {
            return Err(CommandError::new(
                ErrorCode::FileNotFound,
                "the original notebook file was moved, renamed, or deleted",
            ));
        }
        let current = mtime_ms(path)?;
        if current != expected {
            return Err(CommandError::new(
                ErrorCode::ConflictOnDisk,
                "the notebook file changed on disk since it was opened",
            ));
        }
    }

    let json = serde_json::to_string_pretty(notebook).map_err(|e| {
        CommandError::new(ErrorCode::Internal, format!("cannot serialize notebook: {e}"))
    })?;

    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).ok_or_else(|| {
        CommandError::new(ErrorCode::InvalidInput, "notebook path has no parent directory")
    })?;
    fs::create_dir_all(parent)
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot create directory: {e}")))?;

    let temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot create temp file: {e}")))?;
    fs::write(temp.path(), format!("{json}\n"))
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot write notebook: {e}")))?;
    temp.persist(path)
        .map_err(|e| CommandError::new(ErrorCode::Io, format!("cannot finalize save: {e}")))?;

    mtime_ms(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ErrorCode;

    const FIXTURE: &str =
        include_str!("../../../specs/001-notebook-mvp/contracts/fixtures/notebook-v1.json");

    fn temp_dir() -> tempfile::TempDir {
        tempfile::tempdir().expect("tempdir")
    }

    fn write_fixture(dir: &tempfile::TempDir) -> std::path::PathBuf {
        let path = dir.path().join("nb.pnb.json");
        fs::write(&path, FIXTURE).unwrap();
        path
    }

    #[test]
    fn load_valid_fixture() {
        let dir = temp_dir();
        let path = write_fixture(&dir);
        let (notebook, mtime) = load(&path).unwrap();
        assert_eq!(notebook.title, "Welcome Notebook");
        assert_eq!(notebook.cells.len(), 3);
        assert!(notebook.extra.contains_key("xCustomTool"));
        assert!(mtime > 0);
    }

    #[test]
    fn load_missing_file_is_file_not_found() {
        let dir = temp_dir();
        let err = load(&dir.path().join("nope.pnb.json")).unwrap_err();
        assert_eq!(err.code, ErrorCode::FileNotFound);
    }

    #[test]
    fn load_corrupt_json_is_invalid_and_file_untouched() {
        let dir = temp_dir();
        let path = dir.path().join("bad.pnb.json");
        fs::write(&path, "{not json").unwrap();
        let err = load(&path).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidNotebook);
        assert_eq!(fs::read_to_string(&path).unwrap(), "{not json");
    }

    #[test]
    fn load_newer_version_is_version_unsupported_and_file_untouched() {
        let dir = temp_dir();
        let path = dir.path().join("future.pnb.json");
        let raw = FIXTURE.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2");
        fs::write(&path, &raw).unwrap();
        let err = load(&path).unwrap_err();
        assert_eq!(err.code, ErrorCode::VersionUnsupported);
        assert_eq!(fs::read_to_string(&path).unwrap(), raw);
    }

    #[test]
    fn save_roundtrip_preserves_unknown_fields_and_leaves_no_debris() {
        let dir = temp_dir();
        let path = write_fixture(&dir);
        let (notebook, mtime) = load(&path).unwrap();

        let new_mtime = save(&path, &notebook, Some(mtime)).unwrap();
        assert!(new_mtime >= mtime);

        let (reloaded, _) = load(&path).unwrap();
        assert!(reloaded.extra.contains_key("xCustomTool"));
        assert_eq!(reloaded.cells.len(), notebook.cells.len());

        let entries: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
        assert_eq!(entries.len(), 1, "no temp files left behind");
    }

    #[test]
    fn save_is_pretty_printed_and_diffable() {
        let dir = temp_dir();
        let path = write_fixture(&dir);
        let (notebook, mtime) = load(&path).unwrap();
        save(&path, &notebook, Some(mtime)).unwrap();
        let raw = fs::read_to_string(&path).unwrap();
        assert!(raw.contains("\n  \"schemaVersion\": 1"));
        assert!(raw.ends_with('\n'));
    }

    #[test]
    fn save_with_stale_mtime_is_conflict() {
        let dir = temp_dir();
        let path = write_fixture(&dir);
        let (notebook, mtime) = load(&path).unwrap();
        let err = save(&path, &notebook, Some(mtime + 5000)).unwrap_err();
        assert_eq!(err.code, ErrorCode::ConflictOnDisk);
    }

    #[test]
    fn save_onto_deleted_path_with_expectation_is_file_not_found() {
        let dir = temp_dir();
        let path = write_fixture(&dir);
        let (notebook, mtime) = load(&path).unwrap();
        fs::remove_file(&path).unwrap();
        let err = save(&path, &notebook, Some(mtime)).unwrap_err();
        assert_eq!(err.code, ErrorCode::FileNotFound);
        assert!(!path.exists(), "save must not silently recreate the file");
    }

    #[test]
    fn save_without_expectation_creates_fresh_file() {
        let dir = temp_dir();
        let source = write_fixture(&dir);
        let (notebook, _) = load(&source).unwrap();
        let fresh = dir.path().join("copy.pnb.json");
        let mtime = save(&fresh, &notebook, None).unwrap();
        assert!(fresh.exists());
        assert!(mtime > 0);
    }
}
