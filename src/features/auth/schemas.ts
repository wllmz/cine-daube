import { z } from "zod";

// Bounds mirror the database constraints (profiles_pseudo_length) and
// Supabase Auth limits (bcrypt ignores bytes beyond 72).
export const PSEUDO_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

// Normalise first, then validate: " Will@Mail.fr " is a valid email.
const email = z.string().trim().toLowerCase().pipe(z.email("Cet email n'est pas valide."));

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `${PASSWORD_MIN_LENGTH} caractères minimum.`)
  .max(PASSWORD_MAX_LENGTH, `${PASSWORD_MAX_LENGTH} caractères maximum.`);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Entre ton mot de passe."),
});

export const signUpSchema = z.object({
  pseudo: z
    .string()
    .trim()
    .min(1, "Choisis un pseudo.")
    .max(PSEUDO_MAX_LENGTH, `${PSEUDO_MAX_LENGTH} caractères maximum.`),
  email,
  password,
});

export const passwordResetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password,
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
