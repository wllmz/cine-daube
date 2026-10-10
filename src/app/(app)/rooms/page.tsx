import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Tomy } from "@/components/ui/tomy";
import { SignOutButton } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";
import { RoomCard } from "@/features/rooms";
import { getMyRooms } from "@/features/rooms/server";

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

async function RoomList() {
  const rooms = await getMyRooms();

  if (rooms.length === 0) {
    return (
      <p className="rounded-[20px] bg-subtle p-5 text-center text-sm leading-relaxed text-muted">
        Tu n&apos;es dans aucune room pour l&apos;instant.
        <br />
        Crée la tienne ou rejoins celle de tes potes.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rooms.map((room) => (
        <li key={room.id}>
          <RoomCard room={room} />
        </li>
      ))}
    </ul>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[20px] bg-chip ${className}`} />;
}

export default function RoomsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-7">
      <header className="flex items-center justify-between animate-fade-up">
        <Suspense fallback={<Skeleton className="h-14 w-32 rounded-lg" />}>
          <Greeting />
        </Suspense>
        <SignOutButton />
      </header>

      <section className="flex items-center gap-2.5 rounded-[20px] bg-accent-soft py-2.5 pr-4 pl-1.5 animate-fade-up [animation-delay:60ms]">
        <Tomy mood="degoute" size={72} />
        <div className="flex flex-col gap-0.5">
          <p className="font-bold">Ce soir, quelle daube ?</p>
          <p className="text-[13px] leading-snug text-muted">Choisis ta room et lance la roulette.</p>
        </div>
      </section>

      <section className="flex flex-col gap-3 animate-fade-up [animation-delay:120ms]">
        <h2 className="text-[13px] font-semibold text-muted">Tes rooms</h2>
        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <Skeleton className="h-[110px]" />
              <Skeleton className="h-[110px]" />
            </div>
          }
        >
          <RoomList />
        </Suspense>
      </section>

      <div className="mt-auto flex flex-col gap-2.5 animate-fade-up [animation-delay:180ms]">
        <Link href="/rooms/new" className={buttonClassName("primary")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Créer une room
        </Link>
        <Link href="/join" className={buttonClassName("secondary")}>
          Rejoindre avec un code
        </Link>
      </div>
    </main>
  );
}
