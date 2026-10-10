export const AFTER_SIGN_IN_PATH = "/rooms";
export const SIGN_IN_PATH = "/login";

/**
 * Only allows same-site relative paths, so a crafted `?next=` cannot send
 * the user to another site after signing in.
 */
export function safeNextPath(value: unknown, fallback = AFTER_SIGN_IN_PATH): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
