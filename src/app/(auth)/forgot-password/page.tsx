import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth";

export const metadata: Metadata = { title: "Mot de passe oublié · Ciné Daube" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight">Mot de passe oublié</h1>
        <p className="text-sm leading-relaxed text-muted">
          Entre ton email, on t&apos;envoie un lien pour en choisir un nouveau.
        </p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="self-center p-3 text-sm font-semibold text-accent hover:text-accent-strong">
        Retour à la connexion
      </Link>
    </>
  );
}
