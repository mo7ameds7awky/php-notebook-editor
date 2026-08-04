//! Executes HTTP request cells: cancellable, wall-clock-timed, body-capped.
//! Logs nothing — request/response payloads never reach any log output.

use crate::config::{DEFAULT_HTTP_TIMEOUT_MS, HTTP_BODY_DISPLAY_CAP_BYTES};
use crate::models::{
    CommandError, ErrorCode, HttpErrorKind, HttpMethod, HttpRequestSpec, HttpResponseSummary,
    HttpRunError, HttpRunResult, HttpRunStatus, NameValue,
};
use chrono::{SecondsFormat, Utc};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::time::{Duration, Instant};
use tokio::sync::oneshot;

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn method_of(method: HttpMethod) -> reqwest::Method {
    match method {
        HttpMethod::GET => reqwest::Method::GET,
        HttpMethod::POST => reqwest::Method::POST,
        HttpMethod::PUT => reqwest::Method::PUT,
        HttpMethod::PATCH => reqwest::Method::PATCH,
        HttpMethod::DELETE => reqwest::Method::DELETE,
    }
}

fn build_headers(headers: &[NameValue]) -> Result<HeaderMap, CommandError> {
    let mut map = HeaderMap::new();
    for header in headers {
        if header.name.trim().is_empty() {
            continue;
        }
        let name = HeaderName::from_bytes(header.name.trim().as_bytes()).map_err(|_| {
            CommandError::new(
                ErrorCode::InvalidInput,
                format!("\"{}\" is not a valid header name", header.name),
            )
        })?;
        let value = HeaderValue::from_str(&header.value).map_err(|_| {
            CommandError::new(
                ErrorCode::InvalidInput,
                format!("the value of header \"{}\" contains invalid characters", header.name),
            )
        })?;
        map.append(name, value);
    }
    Ok(map)
}

fn failure(kind: HttpErrorKind, message: String, started: Instant) -> HttpRunResult {
    HttpRunResult {
        status: if kind == HttpErrorKind::Cancelled {
            HttpRunStatus::Cancelled
        } else {
            HttpRunStatus::Failed
        },
        response: None,
        error: Some(HttpRunError { kind, message }),
        duration_ms: started.elapsed().as_millis() as u64,
        ran_at: now_iso(),
    }
}

fn transport_kind(error: &reqwest::Error) -> HttpErrorKind {
    if error.is_timeout() {
        HttpErrorKind::Timeout
    } else {
        HttpErrorKind::Network
    }
}

fn is_texty(content_type: &str) -> bool {
    let ct = content_type.to_ascii_lowercase();
    ct.starts_with("text/")
        || ct.contains("json")
        || ct.contains("xml")
        || ct.contains("javascript")
        || ct.contains("x-www-form-urlencoded")
}

async fn perform(
    client: &reqwest::Client,
    method: reqwest::Method,
    url: reqwest::Url,
    headers: HeaderMap,
    body: String,
    started: Instant,
) -> HttpRunResult {
    let mut builder = client.request(method, url).headers(headers);
    if !body.is_empty() {
        builder = builder.body(body);
    }

    let response = match builder.send().await {
        Ok(response) => response,
        Err(e) => return failure(transport_kind(&e), e.to_string(), started),
    };

    let status_code = response.status().as_u16();
    let response_headers: Vec<NameValue> = response
        .headers()
        .iter()
        .map(|(name, value)| NameValue {
            name: name.to_string(),
            value: String::from_utf8_lossy(value.as_bytes()).into_owned(),
        })
        .collect();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .map(|v| String::from_utf8_lossy(v.as_bytes()).into_owned())
        .unwrap_or_default();

    let mut bytes: Vec<u8> = Vec::new();
    let mut body_truncated = false;
    let mut response = response;
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                let remaining = HTTP_BODY_DISPLAY_CAP_BYTES.saturating_sub(bytes.len());
                if chunk.len() >= remaining {
                    bytes.extend_from_slice(&chunk[..remaining]);
                    body_truncated = true;
                    break;
                }
                bytes.extend_from_slice(&chunk);
            }
            Ok(None) => break,
            Err(e) => {
                return failure(
                    transport_kind(&e),
                    format!("connection interrupted while reading the response body: {e}"),
                    started,
                );
            }
        }
    }

    let body_text = if content_type.is_empty() || is_texty(&content_type) {
        String::from_utf8_lossy(&bytes).into_owned()
    } else {
        let size = if body_truncated {
            format!("≥ {} bytes", bytes.len())
        } else {
            format!("{} bytes", bytes.len())
        };
        format!("(binary body: {size}, content-type: {content_type})")
    };

    HttpRunResult {
        status: HttpRunStatus::Succeeded,
        response: Some(HttpResponseSummary {
            status_code,
            headers: response_headers,
            body: body_text,
            body_truncated,
        }),
        error: None,
        duration_ms: started.elapsed().as_millis() as u64,
        ran_at: now_iso(),
    }
}

pub async fn run(
    client: &reqwest::Client,
    request: HttpRequestSpec,
    cancel: oneshot::Receiver<()>,
) -> Result<HttpRunResult, CommandError> {
    let url = reqwest::Url::parse(request.url.trim()).map_err(|e| {
        CommandError::new(ErrorCode::InvalidInput, format!("the URL is not valid: {e}"))
    })?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(CommandError::new(
            ErrorCode::InvalidInput,
            format!("unsupported URL scheme \"{}\" — use http or https", url.scheme()),
        ));
    }
    let headers = build_headers(&request.headers)?;
    let method = method_of(request.method);
    let timeout = Duration::from_millis(request.timeout_ms.map(u64::from).unwrap_or(DEFAULT_HTTP_TIMEOUT_MS));

    let started = Instant::now();
    let work = perform(client, method, url, headers, request.body, started);
    // A dropped-without-send registry entry must not read as a cancellation.
    let cancelled = async {
        match cancel.await {
            Ok(()) => (),
            Err(_) => std::future::pending().await,
        }
    };

    let result = tokio::select! {
        biased;
        _ = cancelled => failure(
            HttpErrorKind::Cancelled,
            "the run was cancelled".to_string(),
            started,
        ),
        outcome = tokio::time::timeout(timeout, work) => match outcome {
            Ok(result) => result,
            Err(_) => failure(
                HttpErrorKind::Timeout,
                format!("the request exceeded its {} ms timeout", timeout.as_millis()),
                started,
            ),
        },
    };
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(url: &str) -> HttpRequestSpec {
        HttpRequestSpec {
            method: HttpMethod::GET,
            url: url.to_string(),
            headers: vec![],
            body: String::new(),
            timeout_ms: Some(1000),
        }
    }

    #[tokio::test]
    async fn invalid_url_is_invalid_input() {
        let client = reqwest::Client::new();
        let (_tx, rx) = oneshot::channel();
        let err = run(&client, spec("not a url"), rx).await.unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
    }

    #[tokio::test]
    async fn non_http_scheme_is_invalid_input() {
        let client = reqwest::Client::new();
        let (_tx, rx) = oneshot::channel();
        let err = run(&client, spec("ftp://example.test/file"), rx).await.unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
    }

    #[tokio::test]
    async fn invalid_header_name_is_invalid_input() {
        let client = reqwest::Client::new();
        let (_tx, rx) = oneshot::channel();
        let mut request = spec("http://localhost:1/");
        request.headers = vec![NameValue {
            name: "bad header".to_string(),
            value: "x".to_string(),
        }];
        let err = run(&client, request, rx).await.unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
    }

    #[test]
    fn texty_content_types_detected() {
        assert!(is_texty("text/plain"));
        assert!(is_texty("application/json; charset=utf-8"));
        assert!(is_texty("application/xml"));
        assert!(!is_texty("image/png"));
        assert!(!is_texty("application/octet-stream"));
    }
}
