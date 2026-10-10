type PgErrorLike = { code?: unknown; constraint?: unknown; constraint_name?: unknown; cause?: unknown };

function asPgError(error: unknown): PgErrorLike | null {
  return typeof error === "object" && error !== null ? (error as PgErrorLike) : null;
}

/**
 * True when Postgres rejected a write on the given unique constraint.
 * Drizzle wraps driver errors, so the original error may sit in `cause`.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let current = asPgError(error); current; current = asPgError(current.cause)) {
    if (current.code === "23505") {
      const name = current.constraint_name ?? current.constraint;
      return name === constraint || (error instanceof Error && error.message.includes(constraint));
    }
  }
  return false;
}
