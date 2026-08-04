/** Centralized frontend defaults for timeouts, limits, and list sizes. */

export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
export const HTTP_TIMEOUT_MIN_MS = 1_000;
export const HTTP_TIMEOUT_MAX_MS = 300_000;

export const RECENTS_MAX_ENTRIES = 20;

/** Soft cap for rendering large outputs in one block before chunking/collapsing. */
export const OUTPUT_DISPLAY_SOFT_CAP_CHARS = 100_000;
