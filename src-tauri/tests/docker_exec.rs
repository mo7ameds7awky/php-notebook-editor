//! Real-Docker integration tests for the PHP sandbox. All `#[ignore]`d so the
//! default `cargo test` stays green without Docker; run with
//! `cargo test -- --ignored` on a machine with the daemon and image present.

use php_notebook_editor_lib::models::{PhpRunStatus, TerminationReason};
use php_notebook_editor_lib::services::docker::{run_php, PhpRunLimits};
use tokio::sync::oneshot;

fn limits(timeout_ms: u64) -> PhpRunLimits {
    PhpRunLimits {
        timeout_ms,
        ..PhpRunLimits::default()
    }
}

fn no_cancel() -> oneshot::Receiver<()> {
    let (tx, rx) = oneshot::channel();
    // Keep the sender alive for the whole test so the receiver never errors early.
    std::mem::forget(tx);
    rx
}

fn leftover_containers() -> String {
    let output = std::process::Command::new("docker")
        .args(["ps", "-a", "--format", "{{.Names}}"])
        .output()
        .expect("docker ps must run");
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|name| name.starts_with("pnb-run-"))
        .collect::<Vec<_>>()
        .join(",")
}

#[tokio::test]
#[ignore]
async fn echo_prints_to_stdout_and_succeeds() {
    let result = run_php(
        "it-echo",
        r#"<?php echo "hello from sandbox";"#,
        limits(30_000),
        no_cancel(),
    )
    .await
    .expect("run must complete");

    assert_eq!(result.status, PhpRunStatus::Succeeded);
    assert_eq!(result.stdout, "hello from sandbox");
    assert_eq!(result.exit_code, Some(0));
    assert!(!result.truncated);
    assert!(result.duration_ms > 0);
}

#[tokio::test]
#[ignore]
async fn uncaught_exception_fails_with_stderr() {
    let result = run_php(
        "it-throw",
        r#"<?php throw new Exception("boom");"#,
        limits(30_000),
        no_cancel(),
    )
    .await
    .expect("run must complete");

    assert_eq!(result.status, PhpRunStatus::Failed);
    assert!(result.stderr.contains("boom"));
    assert_ne!(result.exit_code, Some(0));
}

#[tokio::test]
#[ignore]
async fn infinite_loop_terminates_at_timeout_without_leftovers() {
    let result = run_php(
        "it-loop",
        "<?php while(true) {}",
        limits(2_000),
        no_cancel(),
    )
    .await
    .expect("run must complete");

    assert_eq!(result.status, PhpRunStatus::Terminated);
    assert_eq!(result.termination_reason, Some(TerminationReason::Timeout));
    assert!(result.duration_ms >= 2_000);

    // The kill + --rm path must leave no container debris behind.
    tokio::time::sleep(std::time::Duration::from_millis(1_500)).await;
    assert_eq!(leftover_containers(), "");
}

#[tokio::test]
#[ignore]
async fn network_is_unreachable_inside_the_sandbox() {
    let result = run_php(
        "it-net",
        r#"<?php var_dump(@file_get_contents("https://example.com")); fwrite(STDERR, error_get_last()["message"] ?? "no error");"#,
        limits(30_000),
        no_cancel(),
    )
    .await
    .expect("run must complete");

    assert_eq!(result.stdout.trim(), "bool(false)");
    assert!(
        result.stderr.contains("getaddrinfo")
            || result.stderr.contains("Connection")
            || result.stderr.contains("failed to open stream"),
        "stderr should show a network failure, got: {}",
        result.stderr
    );
}

#[tokio::test]
#[ignore]
async fn memory_bomb_is_terminated_by_the_container_limit() {
    let result = run_php(
        "it-mem",
        r#"<?php $a = str_repeat("x", 1024*1024*1024);"#,
        limits(30_000),
        no_cancel(),
    )
    .await
    .expect("run must complete");

    assert_eq!(result.status, PhpRunStatus::Terminated);
    assert_eq!(result.termination_reason, Some(TerminationReason::Memory));
}

#[tokio::test]
#[ignore]
async fn php_export_fixtures_parse_in_the_sandbox() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../specs/002-usability-polish/contracts/fixtures/php-export.json"))
            .expect("fixture file must parse");

    for fixture in fixtures.as_array().expect("fixture root must be an array") {
        let name = fixture["name"].as_str().expect("fixture name");
        let php = fixture["php"].as_str().expect("fixture php");
        let code = format!("<?php $x = {php}; echo \"ok:{name}\";");

        let result = run_php(
            &format!("it-phpexport-{name}"),
            &code,
            limits(30_000),
            no_cancel(),
        )
        .await
        .expect("run must complete");

        assert_eq!(
            result.status,
            PhpRunStatus::Succeeded,
            "fixture {name} must parse; stderr: {}",
            result.stderr
        );
        assert_eq!(result.stdout, format!("ok:{name}"));
    }
}

#[tokio::test]
#[ignore]
async fn cancellation_kills_the_run_and_reports_cancelled() {
    let (tx, rx) = oneshot::channel();
    let handle = tokio::spawn(run_php(
        "it-cancel",
        "<?php while(true) {}",
        limits(30_000),
        rx,
    ));
    tokio::time::sleep(std::time::Duration::from_millis(1_200)).await;
    tx.send(()).expect("cancel signal must deliver");

    let result = handle.await.expect("task").expect("run must complete");
    assert_eq!(result.status, PhpRunStatus::Cancelled);
    assert!(result.exit_code.is_none());
}
