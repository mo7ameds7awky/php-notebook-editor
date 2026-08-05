pub mod commands;
pub mod config;
pub mod models;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(services::run_registry::RunRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::notebook::load_notebook,
            commands::notebook::save_notebook,
            commands::notebook::list_recents,
            commands::notebook::remove_recent,
            commands::run::run_http,
            commands::run::cancel_run,
            commands::runtime::check_php_runtime,
            commands::runtime::pull_php_image,
            commands::runtime::run_php
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
