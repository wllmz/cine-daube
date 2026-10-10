import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Tomy } from "@/components/ui/tomy";
import { JoinRoomForm, normalizeInviteCode } from "@/features/rooms";
import { getInvitePreview } from "@/features/rooms/server";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Invitation · Ciné Daube" };

function InvalidInvite({ reason }: { reason: string }) {
  return (
    <>
      <Tomy mood="degoute" size={112} />
      <h1 className="text-[22px] font-extrabold tracking-tight">Invitation invalide</h1>
      <p className="text-sm leading-relaxed text-muted">{reason}</p>
      <Link href="/join" className={buttonClassName("secondary", "w-full")}>
        Entrer un code
      </Link>
    </>
  );
}

async function Invite({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCode(decodeURIComponent(rawCode));
  const room = code ? await getInvitePreview(code) : null;
  if (!code || !room) {
    return <InvalidInvite reason="Ce lien ne correspond à aucune room. Vérifie-le auprès de tes potes." />;
  }

  if (room.isExpired) {
    return <InvalidInvite reason="Ce lien a expiré. Demande un nouveau lien à l'admin de la room." />;
  }

  return (
    <>
      <Tomy mood="content" size={112} />
      <p className="text-sm text-muted">On t&apos;invite dans</p>
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{room.name}</h1>
      <p className="text-sm text-muted">{plural(room.memberCount, "membre")} t&apos;y attendent déjà.</p>
      <div className="w-full">
        <JoinRoomForm code={code} submitLabel="Rejoindre la room" />
      </div>
    </>
  );
}

export default function JoinWithCodePage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Suspense fallback={<div aria-hidden="true" className="h-[320px] w-full animate-pulse rounded-3xl bg-chip" />}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}
