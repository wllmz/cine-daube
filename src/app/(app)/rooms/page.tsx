import type { Metadata } from "next";
import { Suspense } from "react";
import { Tomy } from "@/components/ui/tomy";
import { SignOutButton } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Mes rooms · Ciné Daube" };

async function Greeting() {
  const user = await getCurrentUser();
  return (
    <div>
      <p className="text-sm text-muted">Bonsoir,</p>
      <h1 className="text-[28px] font-extrabold tracking-tight">{user.pseudo}</h1>
    </div>
  );
}

function GreetingSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      <div className="h-4 w-16 rounded bg-chip" />
      <div className="h-8 w-32 rounded-lg bg-chip" />
    </div>
  );
}

// Placeholder until the rooms lot: proves the session and profile end to end.
export default function RoomsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-7">
      <header className="flex items-center justify-between animate-fade-up">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>
        <SignOutButton />
      </header>
      <section className="flex items-center gap-2.5 rounded-[20px] bg-accent-soft py-2.5 pr-4 pl-1.5 animate-fade-up [animation-delay:60ms]">
        <Tomy mood="degoute" size={72} />
        <div className="flex flex-col gap-0.5">
          <p className="font-bold">Pas encore de room</p>
          <p className="text-[13px] leading-snug text-muted">La création de rooms arrive très vite.</p>
        </div>
      </section>
    </main>
  );
}
