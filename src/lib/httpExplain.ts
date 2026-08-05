/** Static, deterministic HTTP explanations. Keyed on status code or transport
 *  error kind only — never derived from response bodies, never generated. */

import type { HttpErrorKind } from "../types/notebook";

const SPECIFIC: Record<number, string> = {
  400: "The server rejected the request as malformed — check the body shape and parameters.",
  401: "Authentication is missing or invalid — check the Authorization header or token.",
  403: "Authenticated, but not allowed — the credentials lack permission for this resource.",
  404: "Nothing exists at this URL — check the path, IDs, and the base URL variable.",
  405: "The endpoint exists but not for this HTTP method — check GET vs POST/PUT/DELETE.",
  409: "The request conflicts with current server state — often a duplicate or stale update.",
  422: "The server understood the request but rejected the content — typically validation errors.",
  429: "Too many requests — the server is rate-limiting this client; wait and retry.",
  500: "The server hit an internal error — the problem is on the server side.",
  502: "A gateway got an invalid response from the upstream server.",
  503: "The service is temporarily unavailable — often maintenance or overload.",
  504: "A gateway timed out waiting for the upstream server.",
};

/** One-line friendly explanation for error statuses; null when none is needed
 *  (2xx/3xx). Never a replacement for the raw status and body. */
export function explainHttpStatus(statusCode: number): string | null {
  const specific = SPECIFIC[statusCode];
  if (specific) return specific;
  if (statusCode >= 400 && statusCode <= 499) {
    return "A client-side problem — the server thinks the request itself is wrong.";
  }
  if (statusCode >= 500 && statusCode <= 599) {
    return "A server-side problem — the request reached the server, which then failed.";
  }
  return null;
}

const TRANSPORT: Record<HttpErrorKind, string> = {
  network:
    "The request never got a response — host unreachable, DNS failure, or connection refused.",
  timeout: "The request ran past its timeout before the server finished responding.",
  invalidRequest: "The request could not be sent — the URL or a header is not valid.",
  cancelled: "The run was cancelled before a response arrived.",
};

/** Explanation for a failure where no HTTP response arrived at all. */
export function explainTransportFailure(kind: HttpErrorKind): string {
  return TRANSPORT[kind];
}
