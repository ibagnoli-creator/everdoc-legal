import { QUESTION_WINDOW_MS } from "./types.ts";
import type { QuestionStats } from "./types.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Ab so vielen Antworten gelten p-Wert und Durchschnittszeit als belastbar. */
const CALIBRATION_THRESHOLD = 30;

export interface LoadedQuestions {
  list: QuestionStats[];
  correctIndex: Map<string, number>;
}

/**
 * Lädt Kalibrierung und richtige Antworten eines Sets – nur serverseitig.
 * Die Reihenfolge des Sets bleibt erhalten, weil beide Spieler eines Duells
 * dieselbe Abfolge sehen müssen.
 */
export async function loadQuestionStats(
  db: SupabaseClient,
  questionIds: string[],
): Promise<LoadedQuestions> {
  const { data } = await db
    .from("questions")
    .select("id, correct_index, times_served, times_correct, sum_answer_ms")
    .in("id", questionIds);

  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const correctIndex = new Map<string, number>();
  const list: QuestionStats[] = [];

  for (const id of questionIds) {
    const row = byId.get(id);
    if (!row) continue;
    correctIndex.set(id, row.correct_index);
    const calibrated = row.times_served >= CALIBRATION_THRESHOLD;
    list.push({
      id,
      pCorrect: calibrated ? row.times_correct / row.times_served : null,
      meanAnswerMs: calibrated ? Math.round(row.sum_answer_ms / row.times_served) : null,
    });
  }

  return { list, correctIndex };
}

export interface ServedQuestion {
  position: number;
  id: string;
  text: string;
  options: string[];
  windowMs: number;
}

/**
 * Liefert eine Frage aus und stempelt den Ausliefer-Zeitpunkt.
 *
 * `served_at` entsteht ausschliesslich hier. Es ist die Uhr, gegen die
 * submit-answer misst – eine vom Client gemeldete Zeit wäre wertlos.
 * `correct_index` verlässt den Server nie.
 */
export async function serveQuestion(
  db: SupabaseClient,
  matchId: string,
  questionIds: string[],
  position: number,
): Promise<ServedQuestion> {
  const questionId = questionIds[position];

  const { data: question, error } = await db
    .from("questions")
    .select("id, text, options")
    .eq("id", questionId)
    .single();

  if (error || !question) {
    throw new Error(`Frage ${questionId} nicht gefunden`);
  }

  await db.from("served_questions").insert({
    match_id: matchId,
    position,
    question_id: questionId,
  });

  return {
    position,
    id: question.id,
    text: question.text,
    options: question.options,
    windowMs: QUESTION_WINDOW_MS,
  };
}
