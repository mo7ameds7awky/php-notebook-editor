//! HTTP runner behavior against a local mock server — no external network.

use php_notebook_editor_lib::models::{
    HttpErrorKind, HttpMethod, HttpRequestSpec, HttpRunStatus, NameValue,
};
use php_notebook_editor_lib::services::http_runner;
use std::time::Duration;
use tokio::sync::oneshot;
use wiremock::matchers::{body_string, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn spec(url: String) -> HttpRequestSpec {
    HttpRequestSpec {
        method: HttpMethod::GET,
        url,
        headers: vec![],
        body: String::new(),
        timeout_ms: Some(5_000),
    }
}

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

#[tokio::test]
async fn get_success_reports_status_headers_body_duration() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/get"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_raw("{\"ok\":true}".as_bytes(), "application/json"),
        )
        .mount(&server)
        .await;

    let (_tx, rx) = oneshot::channel();
    let result = http_runner::run(&client(), spec(format!("{}/get", server.uri())), rx)
        .await
        .unwrap();

    assert_eq!(result.status, HttpRunStatus::Succeeded);
    let response = result.response.expect("response present");
    assert_eq!(response.status_code, 200);
    assert_eq!(response.body, "{\"ok\":true}");
    assert!(!response.body_truncated);
    assert!(response
        .headers
        .iter()
        .any(|h| h.name == "content-type" && h.value == "application/json"));
}

#[tokio::test]
async fn post_sends_body_and_headers() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/post"))
        .and(header("content-type", "application/json"))
        .and(body_string("{\"name\":\"pnb\"}"))
        .respond_with(ResponseTemplate::new(201).set_body_string("created"))
        .mount(&server)
        .await;

    let (_tx, rx) = oneshot::channel();
    let mut request = spec(format!("{}/post", server.uri()));
    request.method = HttpMethod::POST;
    request.headers = vec![NameValue {
        name: "Content-Type".to_string(),
        value: "application/json".to_string(),
    }];
    request.body = "{\"name\":\"pnb\"}".to_string();

    let result = http_runner::run(&client(), request, rx).await.unwrap();
    assert_eq!(result.status, HttpRunStatus::Succeeded);
    assert_eq!(result.response.unwrap().status_code, 201);
}

#[tokio::test]
async fn http_500_is_succeeded_transport_with_status() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/boom"))
        .respond_with(ResponseTemplate::new(500).set_body_string("internal error"))
        .mount(&server)
        .await;

    let (_tx, rx) = oneshot::channel();
    let result = http_runner::run(&client(), spec(format!("{}/boom", server.uri())), rx)
        .await
        .unwrap();

    assert_eq!(result.status, HttpRunStatus::Succeeded, "HTTP 500 is not a transport failure");
    assert!(result.error.is_none());
    assert_eq!(result.response.unwrap().status_code, 500);
}

#[tokio::test]
async fn connection_refused_is_network_failure() {
    let (_tx, rx) = oneshot::channel();
    let result = http_runner::run(&client(), spec("http://127.0.0.1:1/".to_string()), rx)
        .await
        .unwrap();

    assert_eq!(result.status, HttpRunStatus::Failed);
    assert!(result.response.is_none());
    assert_eq!(result.error.unwrap().kind, HttpErrorKind::Network);
}

#[tokio::test]
async fn slow_endpoint_with_short_timeout_reports_timeout() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/slow"))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(5)))
        .mount(&server)
        .await;

    let (_tx, rx) = oneshot::channel();
    let mut request = spec(format!("{}/slow", server.uri()));
    request.timeout_ms = Some(1_000);

    let result = http_runner::run(&client(), request, rx).await.unwrap();
    assert_eq!(result.status, HttpRunStatus::Failed);
    assert_eq!(result.error.unwrap().kind, HttpErrorKind::Timeout);
    assert!(result.duration_ms >= 900);
}

#[tokio::test]
async fn cancellation_reports_cancelled() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/hang"))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(30)))
        .mount(&server)
        .await;

    let (tx, rx) = oneshot::channel();
    let run = tokio::spawn({
        let url = format!("{}/hang", server.uri());
        async move { http_runner::run(&client(), spec(url), rx).await }
    });
    tokio::time::sleep(Duration::from_millis(200)).await;
    tx.send(()).unwrap();

    let result = run.await.unwrap().unwrap();
    assert_eq!(result.status, HttpRunStatus::Cancelled);
    assert_eq!(result.error.unwrap().kind, HttpErrorKind::Cancelled);
}

#[tokio::test]
async fn oversized_body_is_capped_and_flagged() {
    let server = MockServer::start().await;
    let big = "x".repeat(3 * 1024 * 1024);
    Mock::given(method("GET"))
        .and(path("/big"))
        .respond_with(ResponseTemplate::new(200).set_body_raw(big.into_bytes(), "text/plain"))
        .mount(&server)
        .await;

    let (_tx, rx) = oneshot::channel();
    let result = http_runner::run(&client(), spec(format!("{}/big", server.uri())), rx)
        .await
        .unwrap();

    let response = result.response.expect("response present");
    assert!(response.body_truncated, "3 MB body must be truncated");
    assert_eq!(response.body.len(), 2 * 1024 * 1024);
}

#[tokio::test]
async fn binary_body_is_summarized_not_dumped() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/bin"))
        .respond_with(
            ResponseTemplate::new(200).set_body_raw(vec![0u8; 4096], "application/octet-stream"),
        )
        .mount(&server)
        .await;

    let (_tx, rx) = oneshot::channel();
    let result = http_runner::run(&client(), spec(format!("{}/bin", server.uri())), rx)
        .await
        .unwrap();

    let response = result.response.unwrap();
    assert!(response.body.contains("binary body"));
    assert!(response.body.contains("4096 bytes"));
    assert!(response.body.contains("application/octet-stream"));
}
