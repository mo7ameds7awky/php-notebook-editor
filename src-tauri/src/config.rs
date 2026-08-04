//! Centralized runtime defaults for execution, limits, and app behavior.

pub const DEFAULT_PHP_IMAGE: &str = "php:8.4-cli";

/// The configured PHP execution image: `PNB_PHP_IMAGE` env override, else the default.
pub fn php_image() -> String {
    std::env::var("PNB_PHP_IMAGE").unwrap_or_else(|_| DEFAULT_PHP_IMAGE.to_string())
}

pub const DEFAULT_HTTP_TIMEOUT_MS: u64 = 30_000;
pub const HTTP_BODY_DISPLAY_CAP_BYTES: usize = 2 * 1024 * 1024;

pub const DEFAULT_PHP_TIMEOUT_MS: u64 = 30_000;
pub const DEFAULT_PHP_MEMORY_LIMIT_MB: u32 = 256;
pub const PHP_STREAM_CAP_BYTES: usize = 1024 * 1024;

pub const RECENTS_MAX_ENTRIES: usize = 20;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn php_image_defaults_without_override() {
        std::env::remove_var("PNB_PHP_IMAGE");
        assert_eq!(php_image(), DEFAULT_PHP_IMAGE);
    }
}
