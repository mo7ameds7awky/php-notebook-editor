pub mod commands;
pub mod config;
pub mod models;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(services::run_registry::RunRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::notebook::load_notebook,
            commands::notebook::save_notebook,
            commands::notebook::list_recents,
            commands::notebook::remove_recent,
            commands::run::run_http,
            commands::run::cancel_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
