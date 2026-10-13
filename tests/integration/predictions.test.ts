// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { isCheckViolation, isForeignKeyViolation } from "@/db/errors";
import {
  addPrediction,
  castFinishVote,
  deletePrediction,
  findFilmInProgress,
  getPredictionBoard,
  listPendingFinishVotes,
  proposeFinish,
} from "@/features/predictions/services/prediction-service";
import { createRoom, joinRoom } from "@/features/rooms/services/room-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

const NOW = new Date("2026-10-13T21:00:00Z");
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const FILM = 1;

let db: Database;
let pglite: PGlite;
let roomId: string;
let will: string;
let sarah: string;
let momo: string;
let julie: string;

/** The room watches a film: an accepted spin with these voters, film not finished. */
async function watch(movieId: number, voterIds: string[]) {
  await pglite.query(
    "insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count) values ($1, $2, 3, 100) on conflict do nothing",
    [movieId, `Film ${movieId}`],
  );
  const spin = await pglite.query<{ id: string }>(
    "insert into spins (room_id, movie_id, status, resolved_at) values ($1, $2, 'accepted', now()) returning id",
    [roomId, movieId],
  );
  const spinId = spin.rows[0]?.id;
  for (const userId of voterIds) {
    await pglite.query("insert into spin_votes (spin_id, room_id, user_id, vote, voted_at) values ($1, $2, $3, 'yes', now())", [
      spinId,
      roomId,
      userId,
    ]);
  }
  await pglite.query("insert into room_movies (room_id, movie_id, status, spin_id) values ($1, $2, 'watched', $3)", [
    roomId,
    movieId,
    spinId,
  ]);
}

const predict = (userId: string, content: string, movieId = FILM) => addPrediction(db, { roomId, movieId, userId, content });
const board = (userId: string, now = NOW) => getPredictionBoard(db, { roomId, movieId: FILM, userId, now });
const propose = (userId: string, now = NOW) => proposeFinish(db, { roomId, movieId: FILM, userId, now });
const vote = (userId: string, proposalId: string, value: "yes" | "no", now = NOW) =>
  castFinishVote(db, { roomId, proposalId, userId, vote: value, now });

async function proposed(userId: string, now = NOW): Promise<string> {
  const result = await propose(userId, now);
  if (result.status !== "proposed") throw new Error(`Expected a proposal, got ${result.status}`);
  return result.proposalId;
}

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
  momo = await createUser(pglite, "Momo");
  julie = await createUser(pglite, "Julie");
  ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", generateCode: () => "AAAAAAAA" }));
  for (const user of [sarah, momo, julie]) await joinRoom(db, { userId: user, code: "AAAAAAAA" });
  // Julie was not there tonight.
  await watch(FILM, [will, sarah, momo]);
});

describe("predictions", () => {
  it("keeps them hidden from the others until the film is finished", async () => {
    await predict(will, "Le héros finit dans une piscine");
    await predict(sarah, "Christian Clavier crie");
    await predict(sarah, "Mariage raté");

    const seenByWill = await board(will);
    expect(seenByWill?.myPredictions.map((p) => p.content)).toEqual(["Le héros finit dans une piscine"]);
    expect(seenByWill?.revealed).toEqual([]);
    expect(seenByWill?.participants.map((p) => [p.pseudo, p.predictionCount])).toEqual([
      ["Momo", 0],
      ["Sarah", 2],
      ["Will", 1],
    ]);
  });

  it("stops at 10 per member and film", async () => {
    for (let i = 1; i <= 10; i++) expect(await predict(will, `Prédiction ${i}`)).toEqual({ status: "added" });
    expect(await predict(will, "Une de trop")).toEqual({ status: "limit_reached" });
    // The limit is per member: Sarah still has all hers.
    expect(await predict(sarah, "Ma première")).toEqual({ status: "added" });
  });

  it("is reserved to the members who watched the film", async () => {
    expect(await predict(julie, "Je n'étais pas là")).toEqual({ status: "not_participant" });
    expect(await predict(will, "Film jamais vu", 999)).toEqual({ status: "not_found" });
  });

  it("lets a member delete their own predictions only", async () => {
    await predict(will, "Une coquille");
    const [mine] = (await board(will))?.myPredictions ?? [];
    if (!mine) throw new Error("Expected a prediction");

    expect(await deletePrediction(db, { roomId, movieId: FILM, userId: sarah, predictionId: mine.id })).toEqual({
      status: "not_found",
    });
    expect(await deletePrediction(db, { roomId, movieId: FILM, userId: will, predictionId: mine.id })).toEqual({
      status: "deleted",
    });
    expect((await board(will))?.myPredictions).toEqual([]);
  });

  it("is enforced by the database too", async () => {
    await expect(
      pglite.query("insert into predictions (room_id, movie_id, user_id, content) values ($1, $2, $3, 'x')", [roomId, 999, will]),
    ).rejects.toSatisfy((error) => isForeignKeyViolation(error, "predictions_room_movie_fk"));
    await expect(
      pglite.query("insert into predictions (room_id, movie_id, user_id, content) values ($1, $2, $3, '')", [roomId, FILM, will]),
    ).rejects.toSatisfy((error) => isCheckViolation(error, "predictions_content_length"));
  });
});

describe("Film terminé ?", () => {
  it("finishes the film on a majority, then reveals every prediction", async () => {
    await predict(will, "Piscine");
    await predict(sarah, "Clavier crie");
    const proposalId = await proposed(will);

    expect(await vote(sarah, proposalId, "yes")).toEqual({ status: "voted", outcome: "accepted" });
    const after = await board(momo);
    expect(after?.finishedAt).toEqual(NOW);
    expect(after?.finishVote).toBeNull();
    expect(after?.revealed.map((a) => [a.pseudo, a.predictions.map((p) => p.content)])).toEqual([
      ["Sarah", ["Clavier crie"]],
      ["Will", ["Piscine"]],
    ]);
    expect(await predict(momo, "Trop tard")).toEqual({ status: "finished" });
    expect(await findFilmInProgress(db, roomId)).toBeNull();
  });

  it("goes on when the majority has not finished, and can be proposed again", async () => {
    const first = await proposed(will);
    expect(await vote(sarah, first, "no")).toEqual({ status: "voted", outcome: "pending" });
    expect(await vote(momo, first, "no")).toEqual({ status: "voted", outcome: "rejected" });

    expect((await board(will))?.finishedAt).toBeNull();
    expect(await predict(momo, "Encore le temps")).toEqual({ status: "added" });
    expect((await propose(sarah)).status).toBe("proposed");
  });

  it("asks the participants only, and the proposer counts as a yes", async () => {
    expect(await propose(julie)).toEqual({ status: "not_participant" });
    const proposalId = await proposed(will);

    const finishVote = (await board(will))?.finishVote;
    expect(finishVote?.proposedBy).toBe("Will");
    expect(finishVote?.voters.map((v) => [v.pseudo, v.vote])).toEqual([
      ["Momo", null],
      ["Sarah", null],
      ["Will", "yes"],
    ]);
    expect(await vote(julie, proposalId, "yes")).toEqual({ status: "not_voter" });
    expect(await propose(sarah)).toEqual({ status: "already_voting", proposalId });
  });

  it("shows the banner to voters who have not answered yet", async () => {
    const proposalId = await proposed(will);
    expect(await listPendingFinishVotes(db, { roomId, userId: sarah, now: NOW })).toEqual([
      { proposalId, movieId: FILM, title: "Film 1", proposedBy: "Will" },
    ]);
    expect(await listPendingFinishVotes(db, { roomId, userId: will, now: NOW })).toEqual([]);
    expect(await listPendingFinishVotes(db, { roomId, userId: julie, now: NOW })).toEqual([]);
    // After 20 minutes the vote no longer waits for anyone.
    expect(await listPendingFinishVotes(db, { roomId, userId: sarah, now: minutesLater(20) })).toEqual([]);
  });

  it("ignores missing votes after 20 minutes", async () => {
    const proposalId = await proposed(will);
    expect((await board(will, minutesLater(20)))?.finishVote?.expired).toBe(true);

    // Only Will answered: proposing again settles the old vote with the votes cast.
    expect(await propose(sarah, minutesLater(21))).toEqual({ status: "finished" });
    expect((await board(will))?.finishedAt).toEqual(minutesLater(21));
    expect(await vote(momo, proposalId, "no", minutesLater(22))).toEqual({ status: "closed" });
  });

  it("settles an expired vote on the next answer too", async () => {
    const proposalId = await proposed(will);
    expect(await vote(sarah, proposalId, "no", minutesLater(25))).toEqual({ status: "voted", outcome: "rejected" });
    expect((await board(will))?.finishedAt).toBeNull();
  });

  it("finishes at once when the proposer watched alone", async () => {
    await watch(2, [julie]);
    expect(await proposeFinish(db, { roomId, movieId: 2, userId: julie, now: NOW })).toMatchObject({
      status: "proposed",
      outcome: "accepted",
    });
  });

  it("tells the room about predictions and votes", async () => {
    await pglite.exec("delete from realtime.sent");
    await predict(will, "Piscine");
    const proposalId = await proposed(will);
    await vote(sarah, proposalId, "yes");
    const sent = await pglite.query<{ payload: { table: string } }>("select payload from realtime.sent");
    expect(new Set(sent.rows.map((row) => row.payload.table))).toEqual(
      new Set(["predictions", "finish_proposals", "finish_votes"]),
    );
  });
});

describe("room_movies.finished_at", () => {
  it("only applies to watched films", async () => {
    await pglite.query("insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count) values (3, 'Film 3', 3, 100)");
    await expect(
      pglite.query("insert into room_movies (room_id, movie_id, status, finished_at) values ($1, 3, 'seen_before', now())", [roomId]),
    ).rejects.toSatisfy((error) => isCheckViolation(error, "room_movies_finished_when_watched"));
  });
});
