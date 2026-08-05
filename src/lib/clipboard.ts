/** Explicit-action clipboard writes via the Tauri clipboard-manager plugin
 *  (write-only capability). Failures come back as typed results that never
 *  carry the copied content, and nothing here logs. */

import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export type CopyResult = { ok: true } | { ok: false; reason: string };

/** Copies text on behalf of an explicit user action; never auto-invoked. */
export async function copyText(text: string): Promise<CopyResult> {
  try {
    await writeText(text);
    return { ok: true };
  } catch {
    // The error object is discarded on purpose: no path may echo the copied
    // content back through error messages or logs.
    return { ok: false, reason: "The clipboard is not available right now." };
  }
}
