import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Tomy } from "@/components/ui/tomy";

/** Also shown for rooms the visitor is not a member of: no hint they exist. */
export default function AppNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Tomy mood="choque" size={112} />
      <h1 className="text-[22px] font-extrabold tracking-tight">Rien à voir ici</h1>
      <p className="text-sm leading-relaxed text-muted">
        Cette page n&apos;existe pas, ou tu n&apos;as pas accès à cette room.
      </p>
      <Link href="/rooms" className={buttonClassName("secondary", "w-full")}>
        Retour à mes rooms
      </Link>
    </main>
  );
}
