import { z } from "zod";
import { normalizeInviteCode } from "./invite-code";

// Mirrors the rooms_name_length database constraint.
export const ROOM_NAME_MAX_LENGTH = 50;

export const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Donne un nom à ta room.")
    .max(ROOM_NAME_MAX_LENGTH, `${ROOM_NAME_MAX_LENGTH} caractères maximum.`),
});

export const inviteCodeSchema = z
  .string()
  .transform((value, context) => {
    const code = normalizeInviteCode(value);
    if (!code) {
      context.addIssue({ code: "custom", message: "Ce code ne ressemble pas à une invitation." });
      return z.NEVER;
    }
    return code;
  });

export const roomIdSchema = z.uuid();
