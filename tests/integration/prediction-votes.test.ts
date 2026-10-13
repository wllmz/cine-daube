// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import {
  castPredictionVote,
  findFilmToJudge,
  settleExpiredPredictions,
} from "@/features/predictions/services/judging-service";
import { addPrediction, getPredictionBoard } from "@/features/predictions/services/prediction-service";
import { createRoom, joinRoom } from "@/features/rooms/services/room-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

const FINISHED_AT = new Date("2026-10-13T22:00:00Z");
const minutesLater = (minutes: number) => new Date(FINISHED_AT.getTime() + minutes * 60_000);
const NOW = minutesLater(1);
const FILM = 1;

let db: Database;
let pglite: PGlite;
let roomId: string;
let will: string;
let sarah: string;
let momo: string;
let julie: string;

/** The room watched FILM with these voters; predictions are made before it finishes. */
async function watch(voterIds: string[]) {
  await pglite.query("insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count) values ($1, 'Film 1', 3, 100)", [FILM]);
  const spin = await pglite.query<{ id: string }>(
    "insert into spins (room_id, movie_id, status, resolved_at) values ($1, $2, 'accepted', now()) returning id",
    [roomId, FILM],
  );
  for (const userId of voterIds) {
    await pglite.query("insert into spin_votes (spin_id, room_id, user_id, vote, voted_at) values ($1, $2, $3, 'yes', now())", [
      spin.rows[0]?.id,
      roomId,
      userId,
    ]);
  }
  await pglite.query("insert into room_movies (room_id, movie_id, status, spin_id) values ($1, $2, 'watched', $3)", [
    roomId,
    FILM,
    spin.rows[0]?.id,
  ]);
}

async function predict(userId: string, content: string): Promise<string> {
  await addPrediction(db, { roomId, movieId: FILM, userId, content });
  const row = await pglite.query<{ id: string }>("select id from predictions where user_id = $1 and content = $2", [userId, content]);
  const id = row.rows[0]?.id;
  if (!id) throw new Error("Prediction not saved");
  return id;
}

async function finishFilm() {
  await pglite.query("update room_movies set finished_at = $1 where room_id = $2 and movie_id = $3", [FINISHED_AT, roomId, FILM]);
}

const vote = (userId: string, predictionId: string, value: "yes" | "no", now = NOW) =>
  castPredictionVote(db, { roomId, predictionId, userId, vote: value, now });
const board = (userId: string, now = NOW) => getPredictionBoard(db, { roomId, movieId: FILM, userId, now });

async function verdict(predictionId: string): Promise<boolean | null> {
  const row = await pglite.query<{ validated: boolean | null }>("select validated from predictions where id = $1", [predictionId]);
  return row.rows[0]?.validated ?? null;
}

let piscine: string;
let clavier: string;

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
  momo = await createUser(pglite, "Momo");
  julie = await createUser(pglite, "Julie");
  ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", generateCode: () => "AAAAAAAA" }));
  for (const user of [sarah, momo, julie]) await joinRoom(db, { userId: user, code: "AAAAAAAA" });
  // Julie was not there tonight.
  await watch([will, sarah, momo]);
  piscine = await predict(will, "Le héros finit dans une piscine");
  clavier = await predict(sarah, "Clavier crie");
});

describe("castPredictionVote", () => {
  it("waits for the end of the film", async () => {
    expect(await vote(sarah, piscine, "yes")).toEqual({ status: "not_finished" });
  });

  it("validates a prediction on a majority of the other participants: 1 point", async () => {
    await finishFilm();
    // Sarah and Momo judge Will's prediction: 1 yes out of 2 is not a majority yet.
    expect(await vote(sarah, piscine, "yes")).toEqual({ status: "voted", verdict: "pending" });
    expect(await vote(momo, piscine, "yes")).toEqual({ status: "voted", verdict: "validated" });
    expect(await verdict(piscine)).toBe(true);
    expect(await vote(sarah, piscine, "no")).toEqual({ status: "closed" });
  });

  it("misses on a tie or a majority of no", async () => {
    await finishFilm();
    await vote(sarah, piscine, "yes");
    expect(await vote(momo, piscine, "no")).toEqual({ status: "voted", verdict: "rejected" });
    await vote(will, clavier, "no");
    expect(await vote(momo, clavier, "no")).toEqual({ status: "voted", verdict: "rejected" });
  });

  it("lets a vote change while the prediction is being judged", async () => {
    await finishFilm();
    await vote(sarah, piscine, "no");
    await vote(sarah, piscine, "yes");
    expect((await board(will))?.revealed.find((a) => a.pseudo === "Will")?.predictions[0]).toMatchObject({ yes: 1, no: 0 });
  });

  it("keeps authors and absent members out", async () => {
    await finishFilm();
    expect(await vote(will, piscine, "yes")).toEqual({ status: "own_prediction" });
    expect(await vote(julie, piscine, "yes")).toEqual({ status: "not_voter" });
  });

  it("refuses votes after 20 minutes and judges with the votes cast", async () => {
    await finishFilm();
    await vote(sarah, piscine, "yes");
    expect(await vote(momo, piscine, "no", minutesLater(20))).toEqual({ status: "closed" });
    // Momo's late "no" does not count: 1 yes, 0 no.
    expect(await verdict(piscine)).toBe(true);
  });
});

describe("settleExpiredPredictions", () => {
  it("judges with the votes cast once the 20 minutes are over", async () => {
    const nobody = await predict(momo, "Personne ne vote pour moi");
    const tie = await predict(momo, "Égalité");
    await finishFilm();
    await vote(sarah, piscine, "yes");
    await vote(will, tie, "yes");
    await vote(sarah, tie, "no");

    await settleExpiredPredictions(db, { roomId, now: minutesLater(19) });
    expect(await verdict(piscine)).toBeNull();

    await settleExpiredPredictions(db, { roomId, now: minutesLater(20) });
    expect([await verdict(piscine), await verdict(clavier), await verdict(nobody), await verdict(tie)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("leaves films still on alone", async () => {
    await settleExpiredPredictions(db, { roomId, now: minutesLater(60) });
    expect(await verdict(piscine)).toBeNull();
  });
});

describe("results on the film page", () => {
  it("shows every prediction with its votes and each author's points", async () => {
    await finishFilm();
    await vote(sarah, piscine, "yes");
    await vote(momo, piscine, "yes");
    await vote(momo, clavier, "no");

    const seenByMomo = await board(momo);
    expect(seenByMomo).toMatchObject({ canJudge: true, judgingEndsAt: minutesLater(20) });
    expect(
      seenByMomo?.revealed.map((a) => [a.pseudo, a.points, a.predictions.map((p) => [p.validated, p.yes, p.no, p.myVote])]),
    ).toEqual([
      ["Will", 1, [[true, 2, 0, "yes"]]],
      ["Sarah", 0, [[null, 0, 1, "no"]]],
    ]);
    expect((await board(julie))?.canJudge).toBe(false);
    expect((await board(momo, minutesLater(20)))?.canJudge).toBe(false);
  });
});

describe("findFilmToJudge", () => {
  it("points participants to predictions they have not judged yet", async () => {
    expect(await findFilmToJudge(db, { roomId, userId: momo, now: NOW })).toBeNull();
    await finishFilm();

    expect(await findFilmToJudge(db, { roomId, userId: momo, now: NOW })).toMatchObject({ tmdbId: FILM });
    expect(await findFilmToJudge(db, { roomId, userId: julie, now: NOW })).toBeNull();

    await vote(momo, piscine, "yes");
    await vote(momo, clavier, "yes");
    expect(await findFilmToJudge(db, { roomId, userId: momo, now: NOW })).toBeNull();
    expect(await findFilmToJudge(db, { roomId, userId: will, now: minutesLater(20) })).toBeNull();
  });
});

it("tells the room about votes and verdicts", async () => {
  await finishFilm();
  await pglite.exec("delete from realtime.sent");
  await vote(sarah, piscine, "yes");
  await vote(momo, piscine, "yes");
  const sent = await pglite.query<{ payload: { table: string } }>("select payload from realtime.sent");
  expect(new Set(sent.rows.map((row) => row.payload.table))).toEqual(new Set(["prediction_votes", "predictions"]));
});
