type AuthErrorLike = { code?: string | undefined };

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  email_not_confirmed: "Confirme d'abord ton email (pense à regarder tes spams).",
  user_already_exists: "Un compte existe déjà avec cet email.",
  email_exists: "Un compte existe déjà avec cet email.",
  weak_password: "Mot de passe trop faible, choisis-en un plus costaud.",
  same_password: "Choisis un mot de passe différent de l'ancien.",
  email_address_invalid: "Cet email n'est pas valide.",
  signup_disabled: "Les inscriptions sont fermées pour le moment.",
  over_email_send_rate_limit: "Trop d'emails envoyés, réessaie dans quelques minutes.",
  over_request_rate_limit: "Trop de tentatives, réessaie dans quelques minutes.",
  session_not_found: "Ta session a expiré, recommence depuis le lien reçu par email.",
};

export const GENERIC_AUTH_ERROR = "Oups, quelque chose a planté. Réessaie.";

/** Turns a Supabase Auth error into a message we can show to the user. */
export function authErrorMessage(error: AuthErrorLike): string {
  return (error.code && MESSAGES[error.code]) || GENERIC_AUTH_ERROR;
}
