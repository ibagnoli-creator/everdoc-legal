import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adjustedPCorrect, syntheticTrace } from "../supabase/functions/_shared/opponent.ts";
import { isPlausible } from "../supabase/functions/_shared/scoring.ts";
import { QUESTION_WINDOW_MS } from "../supabase/functions/_shared/types.ts";
import type { QuestionStats } from "../supabase/functions/_shared/types.ts";

const QUESTIONS: QuestionStats[] = [
  { id: "q1", pCorrect: 0.85, meanAnswerMs: 4_000 },
  { id: "q2", pCorrect: 0.7, meanAnswerMs: 5_000 },
  { id: "q3", pCorrect: 0.55, meanAnswerMs: 6_500 },
  { id: "q4", pCorrect: 0.4, meanAnswerMs: 7_500 },
  { id: "q5", pCorrect: null, meanAnswerMs: null },
];

const CORRECT = new Map([["q1", 0], ["q2", 1], ["q3", 2], ["q4", 3], ["q5", 0]]);

function trace(elo: number, setId: string) {
  return syntheticTrace({
    questions: QUESTIONS,
    correctIndexByQuestion: CORRECT,
    opponentElo: elo,
    setId,
  });
}

function averageScore(elo: number, runs = 400): number {
  let total = 0;
  for (let i = 0; i < runs; i++) total += trace(elo, `set-${i}`).score;
  return total / runs;
}

describe("adjustedPCorrect", () => {
  it("lässt die Trefferquote bei Durchschnittsstärke unverändert", () => {
    assert.ok(Math.abs(adjustedPCorrect(0.6, 0) - 0.6) < 1e-9);
  });

  it("hebt sie für stärkere Gegner und senkt sie für schwächere", () => {
    assert.ok(adjustedPCorrect(0.6, 1) > 0.6);
    assert.ok(adjustedPCorrect(0.6, -1) < 0.6);
  });

  it("bleibt auch bei extremer Spielstärke im offenen Intervall", () => {
    assert.ok(adjustedPCorrect(0.99, 10) <= 0.97);
    assert.ok(adjustedPCorrect(0.01, -10) >= 0.05);
  });
});

describe("syntheticTrace", () => {
  it("ist deterministisch für dieselbe Kombination aus Set und Elo", () => {
    assert.deepEqual(trace(1200, "set-a"), trace(1200, "set-a"));
  });

  it("liefert für verschiedene Sets verschiedene Spuren", () => {
    assert.notDeepEqual(trace(1200, "set-a").answers, trace(1200, "set-b").answers);
  });

  it("antwortet auf jede Frage des Sets genau einmal", () => {
    const answers = trace(1350, "set-c").answers;
    assert.deepEqual(answers.map((a) => a.q), QUESTIONS.map((q) => q.id));
  });

  it("hält jede beantwortete Frage im plausiblen Zeitfenster", () => {
    for (let i = 0; i < 200; i++) {
      for (const answer of trace(1000 + i * 3, `set-${i}`).answers) {
        if (answer.chosen === null) {
          assert.equal(answer.ms, QUESTION_WINDOW_MS);
        } else {
          assert.ok(
            isPlausible(answer.ms),
            `unplausible Antwortzeit: ${answer.ms} ms`,
          );
        }
      }
    }
  });

  it("wählt bei falschen Antworten nie versehentlich die richtige Option", () => {
    for (let i = 0; i < 200; i++) {
      for (const answer of trace(900 + i * 4, `set-${i}`).answers) {
        if (answer.chosen === null) continue;
        assert.ok(answer.chosen >= 0 && answer.chosen <= 3);
      }
    }
  });

  it("lässt stärkere Gegner im Mittel deutlich besser abschneiden", () => {
    const schwach = averageScore(900);
    const mittel = averageScore(1200);
    const stark = averageScore(1600);

    assert.ok(schwach < mittel, `${schwach} < ${mittel}`);
    assert.ok(mittel < stark, `${mittel} < ${stark}`);
    // Der Abstand muss spürbar sein, sonst ist die Elo-Zuordnung wirkungslos.
    assert.ok(stark - schwach > 150, `Abstand nur ${stark - schwach}`);
  });

  it("bleibt auch für sehr starke Gegner unter dem theoretischen Maximum", () => {
    // 5 Fragen à höchstens 197 Punkte. Ein Übungsgegner, der regelmässig
    // perfekt spielt, wäre als Gegner unglaubwürdig.
    assert.ok(averageScore(2000) < 5 * 197);
  });

  it("kommt mit Fragen ohne Statistik zurecht", () => {
    const answer = trace(1200, "set-d").answers.at(-1);
    assert.equal(answer?.q, "q5");
    assert.ok(answer?.chosen === null || isPlausible(answer!.ms));
  });
});
