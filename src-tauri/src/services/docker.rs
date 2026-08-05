//! Docker sandbox service: health probes, image pull, and supervised PHP runs.
//! User PHP never executes in this process — only inside `docker run` children
//! with no mounts, no network, and hard memory/pid/time limits.

use crate::config;
use crate::models::{
    CommandError, ErrorCode, PhpRunResult, PhpRunStatus, RuntimeHealth, RuntimeHealthStatus,
    TerminationReason,
};
use chrono::{SecondsFormat, Utc};
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::sync::oneshot;

/// Exit code a container reports after a SIGKILL, which — outside our own
/// timeout/cancel kill paths — means the kernel OOM-killed it at the memory cap.
const OOM_EXIT_CODE: i32 = 137;

pub struct PhpRunLimits {
    pub timeout_ms: u64,
    pub memory_limit_mb: u32,
}

impl Default for PhpRunLimits {
    fn default() -> Self {
        Self {
            timeout_ms: config::DEFAULT_PHP_TIMEOUT_MS,
            memory_limit_mb: config::DEFAULT_PHP_MEMORY_LIMIT_MB,
        }
    }
}

pub fn container_name(run_id: &str) -> String {
    format!("pnb-run-{run_id}")
}

/// The exact sandbox flag set: no mounts, no network, capped memory/cpu/pids,
/// all capabilities dropped, deterministic name for the kill path. PHP's own
/// memory_limit is disabled so the container cap is the single authority.
pub fn build_run_args(run_id: &str, limits: &PhpRunLimits, image: &str) -> Vec<String> {
    vec![
        "run".into(),
        "--rm".into(),
        "-i".into(),
        "--network=none".into(),
        format!("--memory={}m", limits.memory_limit_mb),
        "--cpus=1".into(),
        "--pids-limit=64".into(),
        "--cap-drop=ALL".into(),
        "--security-opt=no-new-privileges".into(),
        "--name".into(),
        container_name(run_id),
        image.into(),
        "php".into(),
        "-d".into(),
        "memory_limit=-1".into(),
    ]
}

fn health(status: RuntimeHealthStatus, image: &str) -> RuntimeHealth {
    let (detail, remedy) = match status {
        RuntimeHealthStatus::Ok => (
            "Docker daemon reachable; PHP image present.".to_string(),
            String::new(),
        ),
        RuntimeHealthStatus::DockerNotInstalled => (
            "The docker CLI was not found on PATH.".to_string(),
            "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and restart the app.".to_string(),
        ),
        RuntimeHealthStatus::DaemonNotRunning => (
            "The docker CLI exists but the daemon did not respond.".to_string(),
            "Start Docker Desktop and wait until it reports Running, then try again.".to_string(),
        ),
        RuntimeHealthStatus::ImageMissing => (
            format!("The PHP runtime image ({image}) is not present locally."),
            "Pull the PHP image (one-time download, several hundred MB).".to_string(),
        ),
    };
    RuntimeHealth {
        status,
        detail,
        remedy,
    }
}

/// Probe chain: docker binary on PATH → daemon responding → configured image
/// present. Each failure state carries a specific remedy.
pub async fn check_health() -> RuntimeHealth {
    let image = config::php_image();

    let version = Command::new("docker")
        .args(["version", "--format", "{{.Server.Version}}"])
        .stdin(Stdio::null())
        .output()
        .await;
    let version = match version {
        Err(_) => return health(RuntimeHealthStatus::DockerNotInstalled, &image),
        Ok(output) => output,
    };
    if !version.status.success() {
        return health(RuntimeHealthStatus::DaemonNotRunning, &image);
    }

    let inspect = Command::new("docker")
        .args(["image", "inspect", &image])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await;
    match inspect {
        Ok(status) if status.success() => health(RuntimeHealthStatus::Ok, &image),
        _ => health(RuntimeHealthStatus::ImageMissing, &image),
    }
}

/// Pulls the configured image, then re-probes. Registry/network problems map to
/// `pullFailed`; a daemon that went away maps to `runtimeUnavailable`.
pub async fn pull_image() -> Result<RuntimeHealth, CommandError> {
    let image = config::php_image();

    let pull = Command::new("docker")
        .args(["pull", &image])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .output()
        .await
        .map_err(|_| {
            CommandError::new(
                ErrorCode::RuntimeUnavailable,
                health(RuntimeHealthStatus::DockerNotInstalled, &image).remedy,
            )
        })?;

    if pull.status.success() {
        return Ok(check_health().await);
    }

    let recheck = check_health().await;
    if recheck.status == RuntimeHealthStatus::DaemonNotRunning
        || recheck.status == RuntimeHealthStatus::DockerNotInstalled
    {
        return Err(CommandError::new(
            ErrorCode::RuntimeUnavailable,
            format!("{} {}", recheck.detail, recheck.remedy),
        ));
    }

    // Registry/network failure: docker's own stderr describes it and contains
    // no user data, so the tail line is safe to surface.
    let stderr = String::from_utf8_lossy(&pull.stderr);
    let reason = stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("unknown pull error")
        .trim()
        .to_string();
    Err(CommandError::new(
        ErrorCode::PullFailed,
        format!("Pulling {image} failed: {reason}"),
    ))
}

/// Maps a container exit into a run status. Only called for exits we did not
/// initiate, so a SIGKILL exit code means the kernel enforced the memory cap.
fn classify_exit(code: Option<i32>) -> (PhpRunStatus, Option<TerminationReason>) {
    match code {
        Some(0) => (PhpRunStatus::Succeeded, None),
        Some(OOM_EXIT_CODE) => (PhpRunStatus::Terminated, Some(TerminationReason::Memory)),
        _ => (PhpRunStatus::Failed, None),
    }
}

/// Reads a stream to the end, keeping at most `cap` bytes and draining the rest
/// so the child never blocks on a full pipe.
async fn read_capped<R: AsyncRead + Unpin>(mut reader: R, cap: usize) -> (String, bool) {
    let mut kept: Vec<u8> = Vec::new();
    let mut truncated = false;
    let mut chunk = [0u8; 8192];
    loop {
        match reader.read(&mut chunk).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                if kept.len() < cap {
                    let take = n.min(cap - kept.len());
                    kept.extend_from_slice(&chunk[..take]);
                    if take < n {
                        truncated = true;
                    }
                } else {
                    truncated = true;
                }
            }
        }
    }
    (String::from_utf8_lossy(&kept).into_owned(), truncated)
}

async fn kill_container(run_id: &str) {
    let _ = Command::new("docker")
        .args(["kill", &container_name(run_id)])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await;
}

enum Outcome {
    Exited(Option<i32>),
    TimedOut,
    Cancelled,
}

/// Runs one PHP snippet in a fresh sandbox container: code over stdin, streams
/// capped at the display limit, wall-clock timeout and user cancellation both
/// enforced with `docker kill`. Neither the code nor any output is ever logged.
pub async fn run_php(
    run_id: &str,
    code: &str,
    limits: PhpRunLimits,
    mut cancel: oneshot::Receiver<()>,
) -> Result<PhpRunResult, CommandError> {
    let image = config::php_image();
    let args = build_run_args(run_id, &limits, &image);
    let started = Instant::now();
    let ran_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);

    let mut child = Command::new("docker")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            CommandError::new(
                ErrorCode::Internal,
                format!("failed to start the docker process: {}", e.kind()),
            )
        })?;

    // Deliver the snippet and close stdin so php starts executing. A write
    // failure means the container died instantly; the exit status will say so.
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(code.as_bytes()).await;
        drop(stdin);
    }

    let stdout_task = child
        .stdout
        .take()
        .map(|out| tokio::spawn(read_capped(out, config::PHP_STREAM_CAP_BYTES)));
    let stderr_task = child
        .stderr
        .take()
        .map(|err| tokio::spawn(read_capped(err, config::PHP_STREAM_CAP_BYTES)));

    let timeout = tokio::time::sleep(Duration::from_millis(limits.timeout_ms));
    tokio::pin!(timeout);
    let mut cancel_gone = false;

    let outcome = loop {
        tokio::select! {
            status = child.wait() => {
                match status {
                    Ok(status) => break Outcome::Exited(status.code()),
                    Err(e) => {
                        return Err(CommandError::new(
                            ErrorCode::Internal,
                            format!("failed to supervise the docker process: {}", e.kind()),
                        ));
                    }
                }
            }
            _ = &mut timeout => break Outcome::TimedOut,
            signal = &mut cancel, if !cancel_gone => {
                match signal {
                    Ok(()) => break Outcome::Cancelled,
                    Err(_) => cancel_gone = true,
                }
            }
        }
    };

    if matches!(outcome, Outcome::TimedOut | Outcome::Cancelled) {
        kill_container(run_id).await;
        let _ = child.wait().await;
    }

    let (stdout, stdout_truncated) = match stdout_task {
        Some(task) => task.await.unwrap_or_default(),
        None => (String::new(), false),
    };
    let (stderr, stderr_truncated) = match stderr_task {
        Some(task) => task.await.unwrap_or_default(),
        None => (String::new(), false),
    };

    let (status, exit_code, termination_reason) = match outcome {
        Outcome::Exited(code) => {
            let (status, reason) = classify_exit(code);
            (status, code, reason)
        }
        Outcome::TimedOut => (
            PhpRunStatus::Terminated,
            None,
            Some(TerminationReason::Timeout),
        ),
        Outcome::Cancelled => (PhpRunStatus::Cancelled, None, None),
    };

    Ok(PhpRunResult {
        status,
        stdout,
        stderr,
        exit_code,
        termination_reason,
        truncated: stdout_truncated || stderr_truncated,
        duration_ms: started.elapsed().as_millis() as u64,
        ran_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_args_carry_the_exact_sandbox_flag_set() {
        let limits = PhpRunLimits {
            timeout_ms: 30_000,
            memory_limit_mb: 256,
        };
        let args = build_run_args("abc-123", &limits, "php:8.4-cli");
        assert_eq!(
            args,
            vec![
                "run",
                "--rm",
                "-i",
                "--network=none",
                "--memory=256m",
                "--cpus=1",
                "--pids-limit=64",
                "--cap-drop=ALL",
                "--security-opt=no-new-privileges",
                "--name",
                "pnb-run-abc-123",
                "php:8.4-cli",
                "php",
                "-d",
                "memory_limit=-1",
            ]
        );
    }

    #[test]
    fn run_args_respect_a_custom_memory_limit() {
        let limits = PhpRunLimits {
            timeout_ms: 1,
            memory_limit_mb: 64,
        };
        let args = build_run_args("x", &limits, "img");
        assert!(args.contains(&"--memory=64m".to_string()));
        assert!(!args.iter().any(|a| a.contains("mount") || a.contains("volume") || a == "-v"));
    }

    #[test]
    fn every_unhealthy_state_names_a_remedy() {
        for status in [
            RuntimeHealthStatus::DockerNotInstalled,
            RuntimeHealthStatus::DaemonNotRunning,
            RuntimeHealthStatus::ImageMissing,
        ] {
            let result = health(status, "php:8.4-cli");
            assert_eq!(result.status, status);
            assert!(!result.detail.is_empty());
            assert!(!result.remedy.is_empty());
        }
        let ok = health(RuntimeHealthStatus::Ok, "php:8.4-cli");
        assert!(ok.remedy.is_empty());
    }

    #[test]
    fn image_missing_detail_names_the_configured_image() {
        let result = health(RuntimeHealthStatus::ImageMissing, "custom/php:9");
        assert!(result.detail.contains("custom/php:9"));
    }

    #[test]
    fn exit_codes_classify_into_run_statuses() {
        assert_eq!(classify_exit(Some(0)), (PhpRunStatus::Succeeded, None));
        assert_eq!(
            classify_exit(Some(137)),
            (PhpRunStatus::Terminated, Some(TerminationReason::Memory))
        );
        assert_eq!(classify_exit(Some(255)), (PhpRunStatus::Failed, None));
        assert_eq!(classify_exit(Some(1)), (PhpRunStatus::Failed, None));
        assert_eq!(classify_exit(None), (PhpRunStatus::Failed, None));
    }

    #[tokio::test]
    async fn read_capped_truncates_and_flags() {
        let data = vec![b'x'; 100];
        let (kept, truncated) = read_capped(&data[..], 10).await;
        assert_eq!(kept.len(), 10);
        assert!(truncated);

        let (all, untruncated) = read_capped(&data[..], 1000).await;
        assert_eq!(all.len(), 100);
        assert!(!untruncated);
    }
}
