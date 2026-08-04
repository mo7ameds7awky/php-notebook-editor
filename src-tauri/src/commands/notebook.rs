//! Notebook lifecycle commands: load, save, recents.

use crate::models::{
    CommandError, ErrorCode, ListRecentsResult, LoadNotebookResult, Notebook, SaveNotebookResult,
};
use crate::services::{notebook_io, recents};
use chrono::{SecondsFormat, Utc};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn recents_store_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    let dir = app.path().app_data_dir().map_err(|e| {
        CommandError::new(ErrorCode::Io, format!("cannot resolve app data dir: {e}"))
    })?;
    Ok(dir.join("recents.json"))
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[tauri::command]
pub async fn load_notebook(
    app: AppHandle,
    path: String,
) -> Result<LoadNotebookResult, CommandError> {
    let file = PathBuf::from(&path);
    let (notebook, file_mtime_ms) = notebook_io::load(&file)?;
    let store = recents_store_path(&app)?;
    recents::touch(&store, &path, &notebook.title, &now_iso())?;
    Ok(LoadNotebookResult {
        notebook,
        file_mtime_ms,
    })
}

#[tauri::command]
pub async fn save_notebook(
    app: AppHandle,
    path: String,
    notebook: Notebook,
    expected_mtime_ms: Option<i64>,
) -> Result<SaveNotebookResult, CommandError> {
    let file = PathBuf::from(&path);
    let file_mtime_ms = notebook_io::save(&file, &notebook, expected_mtime_ms)?;
    let store = recents_store_path(&app)?;
    recents::touch(&store, &path, &notebook.title, &now_iso())?;
    Ok(SaveNotebookResult { file_mtime_ms })
}

#[tauri::command]
pub async fn list_recents(app: AppHandle) -> Result<ListRecentsResult, CommandError> {
    let store = recents_store_path(&app)?;
    Ok(ListRecentsResult {
        entries: recents::list(&store),
    })
}

#[tauri::command]
pub async fn remove_recent(app: AppHandle, path: String) -> Result<ListRecentsResult, CommandError> {
    let store = recents_store_path(&app)?;
    Ok(ListRecentsResult {
        entries: recents::remove(&store, &path)?,
    })
}
