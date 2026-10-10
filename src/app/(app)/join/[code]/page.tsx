import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Tomy } from "@/components/ui/tomy";
import { JoinRoomForm, normalizeInviteCode } from "@/features/rooms";
import { INVALID_INVITE_MESSAGE } from "@/features/rooms/messages";
import { getInvitePreview } from "@/features/rooms/server";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Invitation · Ciné Daube" };

function InvalidInvite() {
  return (
    <>
      <Tomy mood="degoute" size={112} />
      <h1 className="text-[22px] font-extrabold tracking-tight">Invitation invalide</h1>
      <p className="text-sm leading-relaxed text-muted">{INVALID_INVITE_MESSAGE}</p>
      <Link href="/join" className={buttonClassName("secondary", "w-full")}>
        Entrer un code
      </Link>
    </>
  );
}

async function Invite({ params }: { params: Promise<{ code: string }> }) {
  // Next already decodes the segment; anything outside the alphabet is rejected.
  const code = normalizeInviteCode((await params).code);
  if (!code) return <InvalidInvite />;

  const preview = await getInvitePreview(code);
  if (preview.status === "invalid") return <InvalidInvite />;

  if (preview.status === "member") {
    return (
      <>
        <Tomy mood="content" size={112} />
        <h1 className="text-[22px] font-extrabold tracking-tight">Tu fais déjà partie de cette room</h1>
        <Link href={`/rooms/${preview.roomId}`} className={buttonClassName("primary", "w-full")}>
          Ouvrir la room
        </Link>
      </>
    );
  }

  const { room } = preview;
  return (
    <>
      <Tomy mood="content" size={112} />
      <p className="text-sm text-muted">On t&apos;invite dans</p>
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{room.name}</h1>
      <p className="text-sm text-muted">
        {room.memberCount > 1
          ? `${plural(room.memberCount, "membre")} t'y attendent déjà.`
          : "1 membre t'y attend déjà."}
      </p>
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
