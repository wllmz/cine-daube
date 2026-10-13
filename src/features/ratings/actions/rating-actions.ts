"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { isForeignKeyViolation } from "@/db/errors";
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
  if (!parsedMovie.success) return { error: "Film introuvable." };
  if (!scores.success) return { error: "Les notes vont de 0 à 10." };

  try {
    const result = await saveRating(getDb(), {
      roomId: room.id,
      movieId: parsedMovie.data,
      userId: user.id,
      scores: scores.data,
    });
    if (result === "not_finished") return { error: "Attends la fin du film pour le noter." };
  } catch (error) {
    // The database refuses films the room did not watch; anything else is a real failure.
    if (!isForeignKeyViolation(error, "ratings_room_movie_fk")) throw error;
    return { error: "Impossible d'enregistrer ta note pour ce film." };
  }
  redirect(`/rooms/${room.id}/movies/${parsedMovie.data}`);
}
