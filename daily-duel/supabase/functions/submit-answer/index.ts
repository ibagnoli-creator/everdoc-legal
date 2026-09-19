import { authenticate, serviceClient } from "../_shared/db.ts";
import { fail, json, serveJson } from "../_shared/http.ts";
import { serveQuestion } from "../_shared/match.ts";
import { pointsForAnswer } from "../_shared/scoring.ts";
import { QUESTION_WINDOW_MS, QUESTIONS_PER_MATCH } from "../_shared/types.ts";
import type { Answer } from "../_shared/types.ts";

/**
 * Nimmt eine Antwort entgegen, wertet sie aus und liefert die nächste Frage.
 *
 * Die Antwortzeit kommt aus der Differenz zu `served_at` auf dem Server. Eine
 * vom Client gemeldete Zeit wird bewusst ignoriert: sie wäre der erste Wert,
 * den jemand manipuliert.
 */
Deno.serve(serveJson(async (request) => {
  const userId = await authenticate(request);
  if (!userId) return fail(401, "unauthenticated", "Anmeldung erforderlich.");

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return fail(400, "bad_request", "matchId, position und chosen erforderlich.");
  }

  const db = serviceClient();

  const { data: match } = await db
    .from("matches")
    .select("id, player_id, state, question_sets!inner(question_ids)")
    .eq("id", body.matchId)
    .single();

  if (!match || match.player_id !== userId) {
    return fail(404, "no_match", "Duell nicht gefunden.");
  }
  if (match.state !== "playing") {
    return fail(409, "match_closed", "Dieses Duell läuft nicht mehr.");
  }

  const set = Array.isArray(match.question_sets) ? match.question_sets[0] : match.question_sets;
  const questionIds: string[] = set.question_ids;

  const { data: served } = await db
    .from("served_questions")
    .select("position, question_id, served_at, answered_at")
    .eq("match_id", body.matchId)
    .eq("position", body.position)
    .single();

  if (!served) return fail(404, "not_served", "Diese Frage wurde nicht gestellt.");
  if (served.answered_at) {
    return fail(409, "already_answered", "Diese Frage ist bereits beantwortet.");
  }

  const answeredAt = new Date();
  const elapsedMs = answeredAt.getTime() - new Date(served.served_at).getTime();

  const { data: question } = await db
    .from("questions")
    .select("correct_index")
    .eq("id", served.question_id)
    .single();

  const answer: Answer = {
    q: served.question_id,
    chosen: body.chosen,
    ms: elapsedMs,
  };
  const points = pointsForAnswer(answer, question!.correct_index);
  const isCorrect = body.chosen === question!.correct_index && points > 0;

  await db
    .from("served_questions")
    .update({
      answered_at: answeredAt.toISOString(),
      chosen_index: body.chosen,
      is_correct: isCorrect,
      points,
    })
    .eq("match_id", body.matchId)
    .eq("position", body.position);

  const opponentAnswer = await opponentAnswerAt(db, body.matchId, body.position);
  const playerScore = await runningScore(db, body.matchId);

  const nextPosition = body.position + 1;
  const hasNext = nextPosition < QUESTIONS_PER_MATCH && nextPosition < questionIds.length;

  const nextQuestion = hasNext
    ? await serveQuestion(db, body.matchId, questionIds, nextPosition)
    : null;

  const nextOpponentAnswer = hasNext
    ? await opponentAnswerAt(db, body.matchId, nextPosition)
    : null;

  return json({
    // Erst jetzt erfährt der Client die Lösung – vorher nie.
    result: {
      correctIndex: question!.correct_index,
      isCorrect,
      points,
      elapsedMs,
    },
    opponent: opponentAnswer
      ? {
        isCorrect: opponentAnswer.isCorrect,
        points: opponentAnswer.points,
        answerMs: opponentAnswer.ms,
      }
      : null,
    playerScore,
    opponentScore: await opponentRunningScore(db, body.matchId, body.position),
    question: nextQuestion
      ? {
        ...nextQuestion,
        opponentAnswerMs: nextOpponentAnswer?.ms ?? QUESTION_WINDOW_MS,
      }
      : null,
  });
}));

interface Body {
  matchId: string;
  position: number;
  chosen: number | null;
}

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.matchId !== "string") return false;
  if (typeof candidate.position !== "number") return false;
  if (candidate.position < 0 || candidate.position >= QUESTIONS_PER_MATCH) return false;
  if (candidate.chosen === null) return true;
  return typeof candidate.chosen === "number" &&
    candidate.chosen >= 0 && candidate.chosen <= 3;
}

/** Die Gegnerspur ist bereits vollständig gespeichert – hier wird nur die
 *  Zeile zur laufenden Position herausgegriffen. */
async function opponentAnswerAt(
  db: ReturnType<typeof serviceClient>,
  matchId: string,
  position: number,
) {
  const { data: trace } = await db
    .from("traces")
    .select("answers")
    .eq("match_id", matchId)
    .limit(1)
    .single();

  const answer = trace?.answers?.[position];
  if (!answer) return null;

  const { data: question } = await db
    .from("questions")
    .select("correct_index")
    .eq("id", answer.q)
    .single();

  const points = pointsForAnswer(answer, question!.correct_index);
  return { isCorrect: points > 0, points, ms: answer.ms };
}

async function runningScore(
  db: ReturnType<typeof serviceClient>,
  matchId: string,
): Promise<number> {
  const { data } = await db
    .from("served_questions")
    .select("points")
    .eq("match_id", matchId)
    .not("points", "is", null);

  return (data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
}

/** Punktestand des Gegners bis einschliesslich `position` – damit der
 *  Fortschrittsbalken nicht verrät, was danach kommt. */
async function opponentRunningScore(
  db: ReturnType<typeof serviceClient>,
  matchId: string,
  position: number,
): Promise<number> {
  const { data: trace } = await db
    .from("traces")
    .select("answers")
    .eq("match_id", matchId)
    .limit(1)
    .single();

  const answers: Answer[] = (trace?.answers ?? []).slice(0, position + 1);
  if (!answers.length) return 0;

  const { data: questions } = await db
    .from("questions")
    .select("id, correct_index")
    .in("id", answers.map((answer) => answer.q));

  const correctIndex = new Map((questions ?? []).map((row) => [row.id, row.correct_index]));
  return answers.reduce(
    (sum, answer) => sum + pointsForAnswer(answer, correctIndex.get(answer.q) ?? -1),
    0,
  );
}
