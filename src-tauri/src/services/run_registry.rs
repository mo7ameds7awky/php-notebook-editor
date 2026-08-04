//! Tracks in-flight runs and delivers best-effort cancellation signals.

use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::oneshot;

#[derive(Default)]
pub struct RunRegistry {
    inner: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl RunRegistry {
    /// Registers a run and returns the receiver that fires on cancellation.
    pub fn register(&self, run_id: &str) -> oneshot::Receiver<()> {
        let (tx, rx) = oneshot::channel();
        self.lock().insert(run_id.to_string(), tx);
        rx
    }

    /// Signals cancellation; false when the run is unknown or already finished.
    pub fn cancel(&self, run_id: &str) -> bool {
        match self.lock().remove(run_id) {
            Some(sender) => sender.send(()).is_ok(),
            None => false,
        }
    }

    /// Removes a finished run without signalling.
    pub fn complete(&self, run_id: &str) {
        self.lock().remove(run_id);
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, oneshot::Sender<()>>> {
        self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_unknown_run_is_false() {
        let registry = RunRegistry::default();
        assert!(!registry.cancel("nope"));
    }

    #[tokio::test]
    async fn cancel_fires_the_receiver() {
        let registry = RunRegistry::default();
        let rx = registry.register("run-1");
        assert!(registry.cancel("run-1"));
        assert!(rx.await.is_ok());
    }

    #[test]
    fn completed_run_cannot_be_cancelled() {
        let registry = RunRegistry::default();
        let _rx = registry.register("run-2");
        registry.complete("run-2");
        assert!(!registry.cancel("run-2"));
    }

    #[tokio::test]
    async fn dropped_sender_without_cancel_reports_error_not_signal() {
        let registry = RunRegistry::default();
        let rx = registry.register("run-3");
        registry.complete("run-3");
        assert!(rx.await.is_err());
    }
}
