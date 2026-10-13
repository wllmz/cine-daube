type PgErrorLike = { code?: unknown; constraint?: unknown; constraint_name?: unknown; cause?: unknown };

function asPgError(error: unknown): PgErrorLike | null {
  return typeof error === "object" && error !== null ? (error as PgErrorLike) : null;
}

/**
 * True when Postgres rejected a write with the given error code on the given constraint.
 * Drizzle wraps driver errors, so the original error may sit in `cause`.
 */
function isViolation(error: unknown, code: string, constraint: string): boolean {
  for (let current = asPgError(error); current; current = asPgError(current.cause)) {
    if (current.code === code) {
      const name = current.constraint_name ?? current.constraint;
      return name === constraint || (error instanceof Error && error.message.includes(constraint));
    }
  }
  return false;
}

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return isViolation(error, "23505", constraint);
}

export function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return isViolation(error, "23503", constraint);
}

export function isCheckViolation(error: unknown, constraint: string): boolean {
  return isViolation(error, "23514", constraint);
}
