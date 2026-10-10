// No 0/O, 1/I/L: codes are read aloud and typed on phones.
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
// 31^8 ≈ 852 billion codes: guessing one is impractical without rate limiting.
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_PREFIX = "DAUBE-";
export const INVITE_VALIDITY_DAYS = 7;

/** Cryptographically random code, e.g. "7K2QXM9P". */
export function generateInviteCode(randomValues: (array: Uint32Array) => Uint32Array = (a) =>
  crypto.getRandomValues(a),
): string {
  const values = randomValues(new Uint32Array(INVITE_CODE_LENGTH));
  // Modulo bias over a uint32 is about 31/2^32: negligible.
  return Array.from(values, (value) => INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length]).join(
    "",
  );
}

/**
 * Accepts what people actually type or paste: "daube-7k2qxm", " 7K2 QXM ",
 * or a full invite link. Returns the bare code, or null if it can't be one.
 */
export function normalizeInviteCode(input: string): string | null {
  const lastSegment = input.trim().split("/").pop() ?? "";
  const compact = lastSegment.toUpperCase().replace(/[\s-]/g, "");
  const brand = INVITE_CODE_PREFIX.replace("-", "");
  // Only strip the brand when it is a prefix: a bare code may itself start with "DAUBE".
  const code =
    compact.length === brand.length + INVITE_CODE_LENGTH && compact.startsWith(brand)
      ? compact.slice(brand.length)
      : compact;
  const pattern = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);
  return pattern.test(code) ? code : null;
}

export function formatInviteCode(code: string): string {
  return `${INVITE_CODE_PREFIX}${code}`;
}

export function inviteExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}
