//! PHP runtime commands: health probing, image pull, and sandboxed execution.

use crate::models::{CommandError, ErrorCode, PhpRunResult, RuntimeHealth, RuntimeHealthStatus};
use crate::services::{docker, run_registry::RunRegistry};
use tauri::State;

#[tauri::command]
pub async fn check_php_runtime() -> Result<RuntimeHealth, CommandError> {
    Ok(docker::check_health().await)
}

#[tauri::command]
pub async fn pull_php_image() -> Result<RuntimeHealth, CommandError> {
    docker::pull_image().await
}

#[tauri::command]
pub async fn run_php(
    registry: State<'_, RunRegistry>,
    run_id: String,
    code: String,
    timeout_ms: Option<u64>,
    memory_limit_mb: Option<u32>,
) -> Result<PhpRunResult, CommandError> {
    // Re-probe right before running so a runtime that went away since the last
    // check surfaces as a typed error with its remedy, not a spawn failure.
    let health = docker::check_health().await;
    if health.status != RuntimeHealthStatus::Ok {
        return Err(CommandError::new(
            ErrorCode::RuntimeUnavailable,
            format!("{} {}", health.detail, health.remedy),
        ));
    }

    let defaults = docker::PhpRunLimits::default();
    let limits = docker::PhpRunLimits {
        timeout_ms: timeout_ms.unwrap_or(defaults.timeout_ms),
        memory_limit_mb: memory_limit_mb.unwrap_or(defaults.memory_limit_mb),
    };

    let cancel = registry.register(&run_id);
    let result = docker::run_php(&run_id, &code, limits, cancel).await;
    registry.complete(&run_id);
    result
}
