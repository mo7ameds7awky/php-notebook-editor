//! Run commands: HTTP execution and best-effort cancellation.

use crate::models::{CancelRunResult, CommandError, HttpRequestSpec, HttpRunResult};
use crate::services::{http_runner, run_registry::RunRegistry};
use std::sync::OnceLock;
use tauri::State;

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

#[tauri::command]
pub async fn run_http(
    registry: State<'_, RunRegistry>,
    run_id: String,
    request: HttpRequestSpec,
) -> Result<HttpRunResult, CommandError> {
    let cancel = registry.register(&run_id);
    let result = http_runner::run(http_client(), request, cancel).await;
    registry.complete(&run_id);
    result
}

#[tauri::command]
pub fn cancel_run(registry: State<'_, RunRegistry>, run_id: String) -> CancelRunResult {
    CancelRunResult {
        cancelled: registry.cancel(&run_id),
    }
}
