import { Avatar } from "@/components/ui/avatar";
import type { RoomMember } from "../types";

export function MemberList({ members, currentUserId }: { members: RoomMember[]; currentUserId: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="mb-1.5 text-[13px] font-semibold text-muted">Dans la room · {members.length}</h2>
      <ul className="flex flex-col">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 py-2">
            <Avatar id={member.id} pseudo={member.pseudo} />
            <span className="flex-1 text-[15px] font-semibold">
              {member.pseudo}
              {member.id === currentUserId && <span className="font-normal text-muted"> (toi)</span>}
            </span>
            {member.role === "admin" && (
              <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink-soft">Admin</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
