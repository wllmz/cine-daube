import { useEffect, useRef } from "react";
import type { AuthFieldErrors } from "../types";

/** Moves focus to the first invalid field after a failed submit. */
export function useFocusFirstInvalid(fieldErrors: AuthFieldErrors | undefined) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!fieldErrors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  return formRef;
}
