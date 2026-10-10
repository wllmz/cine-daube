import type { Metadata } from "next";
import { AuthTabs, SignupForm } from "@/features/auth";

export const metadata: Metadata = { title: "Inscription · Ciné Daube" };

export default function SignupPage() {
  return (
    <>
      <h1 className="sr-only">Inscription</h1>
      <AuthTabs active="/signup" />
      <SignupForm />
    </>
  );
}
