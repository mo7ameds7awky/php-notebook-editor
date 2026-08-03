//! IPC contract types shared with the TypeScript frontend; wire format is camelCase JSON.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Notebook {
    pub schema_version: u32,
    pub title: String,
    pub cells: Vec<Cell>,
    pub env_vars: Vec<EnvVar>,
    /// Unknown top-level fields, preserved on round-trip.
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Cell {
    Markdown {
        id: String,
        source: String,
    },
    Php {
        id: String,
        source: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        last_run: Option<PhpRunResult>,
    },
    Http {
        id: String,
        request: HttpRequestSpec,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        last_run: Option<HttpRunResult>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameValue {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestSpec {
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<NameValue>,
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVar {
    pub name: String,
    pub value: String,
    pub secret: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PhpRunStatus {
    Succeeded,
    Failed,
    Terminated,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminationReason {
    Timeout,
    Memory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhpRunResult {
    pub status: PhpRunStatus,
    pub stdout: String,
    pub stderr: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub termination_reason: Option<TerminationReason>,
    pub truncated: bool,
    pub duration_ms: u64,
    pub ran_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HttpRunStatus {
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HttpErrorKind {
    Network,
    Timeout,
    InvalidRequest,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRunError {
    pub kind: HttpErrorKind,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponseSummary {
    pub status_code: u16,
    pub headers: Vec<NameValue>,
    pub body: String,
    pub body_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRunResult {
    pub status: HttpRunStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response: Option<HttpResponseSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<HttpRunError>,
    pub duration_ms: u64,
    pub ran_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RuntimeHealthStatus {
    Ok,
    DockerNotInstalled,
    DaemonNotRunning,
    ImageMissing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeHealth {
    pub status: RuntimeHealthStatus,
    pub detail: String,
    pub remedy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub path: String,
    pub title: String,
    pub last_opened_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    FileNotFound,
    Io,
    InvalidNotebook,
    VersionUnsupported,
    ConflictOnDisk,
    RuntimeUnavailable,
    PullFailed,
    InvalidInput,
    Internal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
}

impl CommandError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const NOTEBOOK_FIXTURE: &str =
        include_str!("../../specs/001-notebook-mvp/contracts/fixtures/notebook-v1.json");
    const PHP_RUN_FIXTURE: &str =
        include_str!("../../specs/001-notebook-mvp/contracts/fixtures/php-run-result.json");
    const HTTP_RUN_FIXTURE: &str =
        include_str!("../../specs/001-notebook-mvp/contracts/fixtures/http-run-result.json");
    const HEALTH_FIXTURE: &str =
        include_str!("../../specs/001-notebook-mvp/contracts/fixtures/runtime-health.json");
    const RECENTS_FIXTURE: &str =
        include_str!("../../specs/001-notebook-mvp/contracts/fixtures/recents.json");

    fn assert_lossless_roundtrip<T>(raw: &str)
    where
        T: Serialize + for<'de> Deserialize<'de>,
    {
        let original: Value = serde_json::from_str(raw).expect("fixture is valid JSON");
        let typed: T = serde_json::from_str(raw).expect("fixture deserializes into model");
        let back = serde_json::to_value(&typed).expect("model serializes");
        assert_eq!(original, back, "serialize(deserialize(fixture)) must be lossless");
    }

    #[test]
    fn notebook_fixture_roundtrips_losslessly() {
        assert_lossless_roundtrip::<Notebook>(NOTEBOOK_FIXTURE);
    }

    #[test]
    fn notebook_fixture_preserves_unknown_top_level_field() {
        let notebook: Notebook = serde_json::from_str(NOTEBOOK_FIXTURE).unwrap();
        assert!(
            notebook.extra.contains_key("xCustomTool"),
            "unknown top-level field lands in the flatten map"
        );
        let back = serde_json::to_value(&notebook).unwrap();
        assert!(
            back.get("xCustomTool").is_some(),
            "unknown top-level field survives serialization"
        );
    }

    #[test]
    fn notebook_fixture_contains_all_cell_types() {
        let notebook: Notebook = serde_json::from_str(NOTEBOOK_FIXTURE).unwrap();
        let has = |pred: fn(&Cell) -> bool| notebook.cells.iter().any(pred);
        assert!(has(|c| matches!(c, Cell::Markdown { .. })));
        assert!(has(|c| matches!(c, Cell::Php { .. })));
        assert!(has(|c| matches!(c, Cell::Http { .. })));
    }

    #[test]
    fn php_run_result_fixture_roundtrips() {
        assert_lossless_roundtrip::<PhpRunResult>(PHP_RUN_FIXTURE);
        let result: PhpRunResult = serde_json::from_str(PHP_RUN_FIXTURE).unwrap();
        assert_eq!(result.status, PhpRunStatus::Terminated);
        assert_eq!(result.termination_reason, Some(TerminationReason::Timeout));
        assert_eq!(result.exit_code, None);
    }

    #[test]
    fn http_run_result_fixture_variants_roundtrip() {
        assert_lossless_roundtrip::<Vec<HttpRunResult>>(HTTP_RUN_FIXTURE);
        let variants: Vec<HttpRunResult> = serde_json::from_str(HTTP_RUN_FIXTURE).unwrap();
        assert_eq!(variants.len(), 2);
        assert_eq!(variants[0].status, HttpRunStatus::Succeeded);
        assert_eq!(
            variants[0].response.as_ref().map(|r| r.status_code),
            Some(500),
            "HTTP 500 is still a succeeded run (transport worked)"
        );
        assert_eq!(variants[1].status, HttpRunStatus::Failed);
        assert_eq!(
            variants[1].error.as_ref().map(|e| e.kind),
            Some(HttpErrorKind::Network)
        );
    }

    #[test]
    fn runtime_health_fixture_covers_all_states() {
        assert_lossless_roundtrip::<Vec<RuntimeHealth>>(HEALTH_FIXTURE);
        let states: Vec<RuntimeHealth> = serde_json::from_str(HEALTH_FIXTURE).unwrap();
        let statuses: Vec<RuntimeHealthStatus> = states.iter().map(|s| s.status).collect();
        assert_eq!(states.len(), 4);
        for expected in [
            RuntimeHealthStatus::Ok,
            RuntimeHealthStatus::DockerNotInstalled,
            RuntimeHealthStatus::DaemonNotRunning,
            RuntimeHealthStatus::ImageMissing,
        ] {
            assert!(statuses.contains(&expected), "missing state {expected:?}");
        }
    }

    #[test]
    fn recents_fixture_roundtrips() {
        assert_lossless_roundtrip::<Vec<RecentEntry>>(RECENTS_FIXTURE);
    }

    #[test]
    fn command_error_serializes_camel_case_codes() {
        let err = CommandError::new(ErrorCode::FileNotFound, "no file at path");
        let value = serde_json::to_value(&err).unwrap();
        assert_eq!(value["code"], "fileNotFound");
        assert_eq!(value["message"], "no file at path");
    }
}
