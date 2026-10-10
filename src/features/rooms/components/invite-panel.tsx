"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { regenerateInviteAction } from "../actions/room-actions";
import type { RoomFormState } from "../types";

type InvitePanelProps = {
  roomId: string;
  roomName: string;
  displayCode: string;
  inviteUrl: string;
  expiresLabel: string;
  isExpired: boolean;
  isAdmin: boolean;
};

type Copied = "code" | "link" | null;

export function InvitePanel({
  roomId,
  roomName,
  displayCode,
  inviteUrl,
  expiresLabel,
  isExpired,
  isAdmin,
}: InvitePanelProps) {
  const [copied, setCopied] = useState<Copied>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [state, regenerate, regenerating] = useActionState<RoomFormState>(
    () => regenerateInviteAction(roomId),
    {},
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(text: string, what: Exclude<Copied, null>) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(what);
    } catch {
      setCopyFailed(true);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Ciné Daube",
          text: `Rejoins « ${roomName} » sur Ciné Daube, on juge des navets !`,
          url: inviteUrl,
        });
        return;
      } catch (error) {
        // Closing the share sheet is not an error worth a fallback.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy(inviteUrl, "link");
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-[18px] shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">Invite tes potes</h2>
        <span className={isExpired ? "text-xs font-semibold text-accent-strong" : "text-xs text-muted"}>
          {isExpired ? "Code expiré" : `Valable jusqu'au ${expiresLabel}`}
        </span>
      </div>

      <p
        className={`rounded-[14px] bg-subtle p-4 text-center text-[26px] font-extrabold tracking-[3px] ${isExpired ? "text-faint line-through" : ""}`}
      >
        {displayCode}
      </p>
      <p className="truncate text-center text-[13px] text-muted">{inviteUrl.replace(/^https?:\/\//, "")}</p>

      {!isExpired && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className={`h-[46px] text-sm ${copied === "code" ? "bg-success-soft text-success" : "bg-accent-soft text-accent-strong"}`}
            onClick={() => copy(displayCode, "code")}
          >
            {copied === "code" ? "Copié !" : "Copier le code"}
          </Button>
          <Button variant="secondary" className="h-[46px] text-sm" onClick={share}>
            {copied === "link" ? "Lien copié !" : "Partager le lien"}
          </Button>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {copied ? "Copié dans le presse-papiers" : ""}
      </p>
      {copyFailed && (
        <FormAlert tone="error">Impossible de copier automatiquement : sélectionne le code à la main.</FormAlert>
      )}

      {isAdmin && (
        <form action={regenerate} className="flex flex-col gap-2">
          {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
          <Button type="submit" variant="ghost" disabled={regenerating}>
            {regenerating ? "Nouveau code…" : isExpired ? "Générer un nouveau code" : "Changer le code"}
          </Button>
        </form>
      )}
      {!isAdmin && isExpired && (
        <p className="text-center text-[13px] text-muted">Demande à l&apos;admin de générer un nouveau code.</p>
      )}
    </section>
  );
}
