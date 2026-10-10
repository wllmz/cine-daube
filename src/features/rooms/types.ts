export type RoomRole = "admin" | "member";

export type MemberPreview = { id: string; pseudo: string };

export type RoomSummary = {
  id: string;
  name: string;
  role: RoomRole;
  memberCount: number;
  watchedCount: number;
  previewMembers: MemberPreview[];
};

export type RoomDetails = {
  id: string;
  name: string;
  inviteCode: string;
  inviteExpiresAt: Date;
  role: RoomRole;
};

export type RoomMember = {
  id: string;
  pseudo: string;
  role: RoomRole;
  joinedAt: Date;
};

export type RoomInvitePreview = {
  id: string;
  name: string;
  inviteExpiresAt: Date;
  memberCount: number;
};

export type JoinRoomResult =
  | { status: "joined" | "already_member"; roomId: string }
  | { status: "not_found" | "expired" };

/** State returned by room server actions to their `useActionState` form. */
export type RoomFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "code", string>>;
  values?: { name?: string; code?: string };
};
