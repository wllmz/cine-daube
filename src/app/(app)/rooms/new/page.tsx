import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { CreateRoomForm } from "@/features/rooms";

export const metadata: Metadata = { title: "Nouvelle room · Ciné Daube" };

export default function NewRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-5">
      <header className="flex items-center gap-1">
        <BackLink href="/rooms" label="Retour à mes rooms" />
        <h1 className="text-[22px] font-extrabold tracking-tight">Nouvelle room</h1>
      </header>
      <p className="text-sm leading-relaxed text-muted">
        Donne-lui un nom, tu pourras ensuite inviter tes potes avec un code ou un lien.
      </p>
      <CreateRoomForm />
    </main>
  );
}
