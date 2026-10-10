import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthTabs, LoginForm } from "@/features/auth";

export const metadata: Metadata = { title: "Connexion · Ciné Daube" };

export default function LoginPage() {
  return (
    <>
      <h1 className="sr-only">Connexion</h1>
      {/* Reads ?next= and ?error= from the URL, so it renders at request time. */}
      <Suspense fallback={<div className="h-[360px]" aria-hidden="true" />}>
        <AuthTabs active="/login" />
        <LoginForm />
      </Suspense>
    </>
  );
}
