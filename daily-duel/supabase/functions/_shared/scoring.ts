import {
  BASE_POINTS,
  MAX_SPEED_BONUS,
  MIN_PLAUSIBLE_MS,
  QUESTION_WINDOW_MS,
  SUBMIT_GRACE_MS,
} from "./types.ts";
import type { Answer } from "./types.ts";

/**
 * Punkte für eine einzelne Antwort.
 *
 * Grundpunkte gibt es nur für richtig. Der Tempo-Bonus fällt linear über das
 * Zeitfenster ab – er ist der Grund, warum ein 5:5 an richtigen Antworten
 * trotzdem spannend ausgeht.
 */
export function pointsForAnswer(
  answer: Answer,
  correctIndex: number,
): number {
  if (answer.chosen === null) return 0;
  if (answer.chosen !== correctIndex) return 0;
  if (!isPlausible(answer.ms)) return 0;

  const remaining = Math.max(0, QUESTION_WINDOW_MS - answer.ms);
  const speedBonus = Math.round(MAX_SPEED_BONUS * (remaining / QUESTION_WINDOW_MS));
  return BASE_POINTS + speedBonus;
}

/**
 * Antworten ausserhalb dieses Fensters zählen als Fehlversuch. Das ersetzt
 * keine echte Betrugserkennung, deckt aber die billigen Fälle ab: geskriptete
 * Sofortantworten und nachgereichte Antworten mit angehaltener Uhr.
 */
export function isPlausible(ms: number): boolean {
  return ms >= MIN_PLAUSIBLE_MS && ms <= QUESTION_WINDOW_MS + SUBMIT_GRACE_MS;
}

export function scoreTrace(
  answers: Answer[],
  correctIndexByQuestion: Map<string, number>,
): number {
  let total = 0;
  for (const answer of answers) {
    const correct = correctIndexByQuestion.get(answer.q);
    if (correct === undefined) continue;
    total += pointsForAnswer(answer, correct);
  }
  return total;
}
