import { gaussian, makeRng, seedFrom } from "./random.ts";
import { scoreTrace } from "./scoring.ts";
import { MIN_PLAUSIBLE_MS, QUESTION_WINDOW_MS, STARTING_ELO } from "./types.ts";
import type { Answer, QuestionStats, Trace } from "./types.ts";

/**
 * Erzeugt die Spur eines Übungsgegners.
 *
 * Gebraucht wird das nur dort, wo keine echte Spur vorliegt: in den ersten
 * Wochen und in dünn besetzten Elo-Bändern. Im Client sind solche Gegner
 * sichtbar als "Übungsgegner" gekennzeichnet – verdeckte Fake-Gegner sind in
 * Quiz-Apps ein verlässlicher Weg zu einer 1-Stern-Welle.
 *
 * Modell: Rasch. Die Trefferwahrscheinlichkeit einer Frage ist ihr empirischer
 * p-Wert, verschoben um die Spielstärke. 400 Elo Unterschied entsprechen
 * ungefähr einer Verdreifachung der Chance, richtig zu liegen.
 */
export function syntheticTrace(params: {
  questions: QuestionStats[];
  correctIndexByQuestion: Map<string, number>;
  opponentElo: number;
  setId: string;
}): Trace {
  const rng = makeRng(seedFrom(params.setId, params.opponentElo));
  const skill = (params.opponentElo - STARTING_ELO) / 400;

  const answers: Answer[] = params.questions.map((question) => {
    const pCorrect = adjustedPCorrect(question.pCorrect ?? DEFAULT_P_CORRECT, skill);
    const meanMs = question.meanAnswerMs ?? DEFAULT_MEAN_MS;

    if (rng() < timeoutChance(skill)) {
      return { q: question.id, chosen: null, ms: QUESTION_WINDOW_MS };
    }

    const isCorrect = rng() < pCorrect;
    const correctIndex = params.correctIndexByQuestion.get(question.id) ?? 0;

    return {
      q: question.id,
      chosen: isCorrect ? correctIndex : wrongOption(correctIndex, rng),
      ms: answerTime({ meanMs, skill, isCorrect, rng }),
    };
  });

  return {
    answers,
    score: scoreTrace(answers, params.correctIndexByQuestion),
  };
}

/** Annahmen für Fragen, die noch nicht genug Antworten gesammelt haben. */
const DEFAULT_P_CORRECT = 0.6;
const DEFAULT_MEAN_MS = 5_500;

/** Streuung der Antwortzeiten, aus Beobachtung: ±35 % sind typisch. */
const TIME_SIGMA = 0.35;

/** Falsche Antworten dauern länger – geraten wird nach dem Nachdenken. */
const WRONG_ANSWER_SLOWDOWN = 1.25;

export function adjustedPCorrect(basePCorrect: number, skill: number): number {
  const p = clamp(basePCorrect, 0.02, 0.98);
  const shifted = Math.log(p / (1 - p)) + skill;
  const result = 1 / (1 + Math.exp(-shifted));
  return clamp(result, 0.05, 0.97);
}

function timeoutChance(skill: number): number {
  return clamp(0.05 - skill * 0.02, 0.005, 0.12);
}

function answerTime(params: {
  meanMs: number;
  skill: number;
  isCorrect: boolean;
  rng: () => number;
}): number {
  // Stärkere Spieler antworten schneller, aber nicht beliebig schnell.
  const skillFactor = clamp(1 - params.skill * 0.15, 0.55, 1.6);
  const slowdown = params.isCorrect ? 1 : WRONG_ANSWER_SLOWDOWN;
  const mu = Math.log(params.meanMs * skillFactor * slowdown);
  const sampled = Math.exp(mu + TIME_SIGMA * gaussian(params.rng));

  // Innerhalb des plausiblen Fensters bleiben, sonst verwirft die
  // Punkteberechnung die Antwort des eigenen Übungsgegners.
  return Math.round(clamp(sampled, MIN_PLAUSIBLE_MS + 100, QUESTION_WINDOW_MS - 50));
}

function wrongOption(correctIndex: number, rng: () => number): number {
  const options = [0, 1, 2, 3].filter((index) => index !== correctIndex);
  return options[Math.floor(rng() * options.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
