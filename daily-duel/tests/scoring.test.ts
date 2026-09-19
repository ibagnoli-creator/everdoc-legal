import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlausible, pointsForAnswer, scoreTrace } from "../supabase/functions/_shared/scoring.ts";
import { QUESTION_WINDOW_MS } from "../supabase/functions/_shared/types.ts";

describe("pointsForAnswer", () => {
  it("gibt für eine sofortige richtige Antwort die volle Punktzahl", () => {
    // 500 ms sind gerade plausibel, der Tempo-Bonus daher fast vollständig.
    const points = pointsForAnswer({ q: "a", chosen: 2, ms: 500 }, 2);
    assert.equal(points, 100 + 96);
  });

  it("halbiert den Tempo-Bonus zur Hälfte des Zeitfensters", () => {
    const points = pointsForAnswer({ q: "a", chosen: 2, ms: QUESTION_WINDOW_MS / 2 }, 2);
    assert.equal(points, 150);
  });

  it("gibt am Ende des Fensters nur die Grundpunkte", () => {
    const points = pointsForAnswer({ q: "a", chosen: 2, ms: QUESTION_WINDOW_MS }, 2);
    assert.equal(points, 100);
  });

  it("gibt nichts für eine falsche Antwort, egal wie schnell", () => {
    assert.equal(pointsForAnswer({ q: "a", chosen: 1, ms: 600 }, 2), 0);
  });

  it("gibt nichts für eine abgelaufene Frage", () => {
    assert.equal(pointsForAnswer({ q: "a", chosen: null, ms: QUESTION_WINDOW_MS }, 2), 0);
  });

  it("verwirft eine unmöglich schnelle Antwort", () => {
    assert.equal(pointsForAnswer({ q: "a", chosen: 2, ms: 120 }, 2), 0);
  });

  it("verwirft eine deutlich verspätete Antwort", () => {
    assert.equal(pointsForAnswer({ q: "a", chosen: 2, ms: QUESTION_WINDOW_MS + 5_000 }, 2), 0);
  });
});

describe("isPlausible", () => {
  it("lässt Netzlaufzeit knapp über dem Fenster durchgehen", () => {
    assert.equal(isPlausible(QUESTION_WINDOW_MS + 800), true);
  });

  it("weist Antworten unter der Lesezeit ab", () => {
    assert.equal(isPlausible(399), false);
  });
});

describe("scoreTrace", () => {
  const correct = new Map([["a", 0], ["b", 1], ["c", 2]]);

  it("summiert über alle Antworten", () => {
    const score = scoreTrace(
      [
        { q: "a", chosen: 0, ms: 6_000 },
        { q: "b", chosen: 3, ms: 4_000 },
        { q: "c", chosen: 2, ms: 6_000 },
      ],
      correct,
    );
    assert.equal(score, 150 + 0 + 150);
  });

  it("ignoriert Antworten auf Fragen ausserhalb des Sets", () => {
    const score = scoreTrace([{ q: "fremd", chosen: 0, ms: 1_000 }], correct);
    assert.equal(score, 0);
  });

  it("bleibt pro Frage unter der theoretischen Obergrenze von 200", () => {
    const perfect = [...correct.entries()].map(([q, chosen]) => ({ q, chosen, ms: 400 }));
    // Bei 400 ms ist der Tempo-Bonus 97, nicht 100: die Mindestlesezeit
    // kostet immer ein paar Punkte. 200 pro Frage ist unerreichbar.
    assert.equal(scoreTrace(perfect, correct), 3 * 197);
  });
});
