export const AFTER_SIGN_IN_PATH = "/rooms";
export const SIGN_IN_PATH = "/login";

const PARSE_BASE = "http://internal.invalid";

/**
 * Only allows same-site relative paths, so a crafted `?next=` cannot send
 * the user to another site after signing in. The value is normalised with
 * the WHATWG URL parser, which is what the browser will do: prefix checks
 * alone miss tricks like "/\t/evil.com" (tabs and newlines are stripped).
 */
export function safeNextPath(value: unknown, fallback = AFTER_SIGN_IN_PATH): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;

  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== PARSE_BASE) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
