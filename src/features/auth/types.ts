export type AuthFieldErrors = Partial<Record<string, string>>;

/** State returned by auth server actions to their `useActionState` form. */
export type AuthFormState = {
  error?: string;
  fieldErrors?: AuthFieldErrors;
  success?: string;
  /** Echoed back so the form can keep what the user typed. */
  values?: { email?: string; pseudo?: string };
};

export type CurrentUser = {
  id: string;
  email: string;
  pseudo: string;
};
