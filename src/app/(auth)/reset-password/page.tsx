import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth";

export const metadata: Metadata = { title: "Nouveau mot de passe · Ciné Daube" };

// Reached through the email link: /auth/callback opens a session first,
// and the proxy sends signed-out visitors to the login page.
export default function ResetPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight">Nouveau mot de passe</h1>
        <p className="text-sm leading-relaxed text-muted">Choisis-en un que tu retiendras cette fois.</p>
      </div>
      <ResetPasswordForm />
    </>
  );
}
