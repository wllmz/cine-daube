"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { requireRoomMember } from "@/features/rooms/server";
import { movieIdSchema, ratingFormSchema } from "../schemas";
import { saveRating } from "../services/rating-service";
import type { RatingFormState } from "../types";

function formValue(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" ? value : undefined;
}

export async function rateMovieAction(
  roomId: string,
  movieId: string,
  _state: RatingFormState,
  formData: FormData,
): Promise<RatingFormState> {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  const parsedMovie = movieIdSchema.safeParse(movieId);
  const scores = ratingFormSchema.safeParse({
    humour: formValue(formData, "humour"),
    scenario: formValue(formData, "scenario"),
    actingEnabled: formValue(formData, "actingEnabled"),
    acting: formValue(formData, "acting"),
  });
  if (!parsedMovie.success || !scores.success) {
    return { error: "Les notes vont de 0 à 10." };
  }

  try {
    await saveRating(getDb(), { roomId: room.id, movieId: parsedMovie.data, userId: user.id, scores: scores.data });
  } catch (error) {
    // The database refuses films the room did not watch.
    console.error("saveRating failed", error);
    return { error: "Impossible d'enregistrer ta note pour ce film." };
  }
  redirect(`/rooms/${room.id}/movies/${parsedMovie.data}`);
}
