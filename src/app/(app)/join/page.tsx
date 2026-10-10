import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { JoinRoomForm } from "@/features/rooms";

export const metadata: Metadata = { title: "Rejoindre une room · Ciné Daube" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-5">
      <header className="flex items-center gap-1">
        <BackLink href="/rooms" label="Retour à mes rooms" />
        <h1 className="text-[22px] font-extrabold tracking-tight">Rejoindre une room</h1>
      </header>
      <JoinRoomForm />
    </main>
  );
}
