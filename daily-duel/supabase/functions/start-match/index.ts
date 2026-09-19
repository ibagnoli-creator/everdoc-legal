import { authenticate, playDateFor, serviceClient } from "../_shared/db.ts";
import { fail, json, serveJson } from "../_shared/http.ts";
import { leagueFor } from "../_shared/elo.ts";
import { syntheticTrace } from "../_shared/opponent.ts";
import { loadQuestionStats, serveQuestion } from "../_shared/match.ts";
import { bucketForElo } from "../_shared/sets.ts";
import { QUESTION_WINDOW_MS } from "../_shared/types.ts";
import type { Trace } from "../_shared/types.ts";

/**
 * Startet das Tagesduell.
 *
 * Reihenfolge ist wichtig: erst den Tages-Slot verbrauchen, dann den Gegner
 * suchen. Andersherum könnte ein abgebrochener Request einen Gegner binden,
 * ohne dass je gespielt wird.
 */
Deno.serve(serveJson(async (request) => {
  const userId = await authenticate(request);
  if (!userId) return fail(401, "unauthenticated", "Anmeldung erforderlich.");

  const { timezone } = await request.json().catch(() => ({ timezone: null }));
  const db = serviceClient();

  const { data: player } = await db
    .from("users")
    .select("id, display_name, elo, matches_played")
    .eq("id", userId)
    .single();

  if (!player) return fail(404, "no_profile", "Kein Profil vorhanden.");

  const playDate = playDateFor(timezone ?? null);
  const { data: hasSlot } = await db.rpc("consume_daily_slot", {
    p_user_id: userId,
    p_play_date: playDate,
  });

  if (!hasSlot) {
    return fail(
      403,
      "no_slots_left",
      "Für heute ist das Duell gespielt. Morgen gibt es ein neues.",
    );
  }

  const bucket = bucketForElo(player.elo);
  const opponent = await findOpponent(db, { userId, elo: player.elo, bucket });
  if (!opponent) {
    return fail(503, "no_questions", "Zurzeit sind keine Fragensets verfügbar.");
  }

  const { data: match, error: matchError } = await db
    .from("matches")
    .insert({
      set_id: opponent.setId,
      player_id: userId,
      opponent_id: opponent.userId,
      opponent_is_synthetic: opponent.isSynthetic,
      opponent_elo: opponent.elo,
      player_elo_before: player.elo,
      state: "playing",
    })
    .select("id")
    .single();

  if (matchError || !match) {
    return fail(500, "match_failed", "Duell konnte nicht angelegt werden.");
  }

  // Die Gegnerspur wird mitgespeichert, damit ein späterer Spieler gegen
  // dieselbe Spur antreten kann – auch bei synthetischen Gegnern.
  await db.from("traces").insert({
    match_id: match.id,
    user_id: opponent.userId,
    is_synthetic: opponent.isSynthetic,
    answers: opponent.trace.answers,
    score: opponent.trace.score,
  });

  const question = await serveQuestion(db, match.id, opponent.questionIds, 0);

  return json({
    matchId: match.id,
    totalQuestions: opponent.questionIds.length,
    opponent: {
      name: opponent.name,
      elo: opponent.elo,
      league: leagueFor(opponent.elo),
      country: opponent.country,
      // Der Client zeigt Übungsgegner sichtbar als solche an.
      isPractice: opponent.isSynthetic,
    },
    question: {
      ...question,
      opponentAnswerMs: opponent.trace.answers[0]?.ms ?? QUESTION_WINDOW_MS,
    },
  });
}));

interface Opponent {
  userId: string | null;
  name: string;
  country: string | null;
  elo: number;
  isSynthetic: boolean;
  setId: string;
  questionIds: string[];
  trace: Trace;
}

const ELO_BAND = 150;

/**
 * Sucht zuerst eine echte Spur im passenden Elo-Band; nur wenn keine
 * gefunden wird, entsteht ein Übungsgegner. In den ersten Wochen ist das der
 * Regelfall, später die Ausnahme.
 */
async function findOpponent(
  db: ReturnType<typeof serviceClient>,
  params: { userId: string; elo: number; bucket: number },
): Promise<Opponent | null> {
  const { data: played } = await db
    .from("matches")
    .select("set_id")
    .eq("player_id", params.userId);
  const playedSetIds = (played ?? []).map((row) => row.set_id);

  const real = await findRealOpponent(db, params, playedSetIds);
  if (real) return real;

  const set = await pickUnplayedSet(db, params.bucket, playedSetIds);
  if (!set) return null;

  const stats = await loadQuestionStats(db, set.question_ids);
  // Übungsgegner spielen leicht unter der Spielerstärke: ein knapper Sieg im
  // ersten Duell hält mehr Leute als eine ehrliche Niederlage.
  const opponentElo = Math.max(800, params.elo - 40);

  return {
    userId: null,
    name: randomPracticeName(set.id),
    country: null,
    elo: opponentElo,
    isSynthetic: true,
    setId: set.id,
    questionIds: set.question_ids,
    trace: syntheticTrace({
      questions: stats.list,
      correctIndexByQuestion: stats.correctIndex,
      opponentElo,
      setId: set.id,
    }),
  };
}

async function findRealOpponent(
  db: ReturnType<typeof serviceClient>,
  params: { userId: string; elo: number },
  playedSetIds: string[],
): Promise<Opponent | null> {
  const { data } = await db
    .from("matches")
    .select(
      "set_id, player_id, player_elo_before, " +
        "users!matches_player_id_fkey(display_name, country), " +
        "traces!inner(answers, score, is_synthetic), " +
        "question_sets!inner(question_ids)",
    )
    .eq("state", "finished")
    .eq("traces.is_synthetic", false)
    .neq("player_id", params.userId)
    .gte("player_elo_before", params.elo - ELO_BAND)
    .lte("player_elo_before", params.elo + ELO_BAND)
    .not("set_id", "in", `(${playedSetIds.join(",") || "''"})`)
    .limit(20);

  if (!data?.length) return null;

  // Aus den Treffern zufällig wählen, sonst spielt jeder gegen dieselbe
  // besonders aktive Person.
  const row = data[Math.floor(Math.random() * data.length)];
  const trace = Array.isArray(row.traces) ? row.traces[0] : row.traces;
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  const set = Array.isArray(row.question_sets) ? row.question_sets[0] : row.question_sets;

  return {
    userId: row.player_id,
    name: user?.display_name ?? "Unbekannt",
    country: user?.country ?? null,
    elo: row.player_elo_before,
    isSynthetic: false,
    setId: row.set_id,
    questionIds: set.question_ids,
    trace: { answers: trace.answers, score: trace.score },
  };
}

async function pickUnplayedSet(
  db: ReturnType<typeof serviceClient>,
  bucket: number,
  playedSetIds: string[],
) {
  const { data } = await db
    .from("question_sets")
    .select("id, question_ids")
    .eq("difficulty_bucket", bucket)
    .not("id", "in", `(${playedSetIds.join(",") || "''"})`)
    .limit(50);

  if (!data?.length) return null;
  return data[Math.floor(Math.random() * data.length)];
}

const PRACTICE_NAMES = [
  "Trainingspartner", "Übungsgegner", "Sparringspartner", "Testduellant",
];

function randomPracticeName(setId: string): string {
  const index = setId.charCodeAt(0) % PRACTICE_NAMES.length;
  return PRACTICE_NAMES[index];
}
