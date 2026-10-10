import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthTabs, SignupForm } from "@/features/auth";

export const metadata: Metadata = { title: "Inscription · Ciné Daube" };

export default function SignupPage() {
  return (
    <>
      <h1 className="sr-only">Inscription</h1>
      {/* Reads ?next= from the URL, so it renders at request time. */}
      <Suspense fallback={<div className="h-[420px]" aria-hidden="true" />}>
        <AuthTabs active="/signup" />
        <SignupForm />
      </Suspense>
    </>
  );
}
