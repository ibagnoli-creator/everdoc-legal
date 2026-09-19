// Gemeinsame Typen für Edge Functions und Tests.

/** Zeitfenster pro Frage. Fünf Fragen ergeben die 60 Sekunden des Duells. */
export const QUESTION_WINDOW_MS = 12_000;

/** Kulanz obendrauf: Netzlaufzeit soll keine korrekte Antwort kosten. */
export const SUBMIT_GRACE_MS = 1_000;

/** Schneller hat niemand gelesen – das ist ein Bot oder ein Zufallstipp. */
export const MIN_PLAUSIBLE_MS = 400;

export const QUESTIONS_PER_MATCH = 5;

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 100;

export const STARTING_ELO = 1200;

export interface Answer {
  /** Frage-ID. */
  q: string;
  /** Gewählte Option, oder null bei Zeitablauf. */
  chosen: number | null;
  /** Antwortzeit ab Ausliefern der Frage. */
  ms: number;
}

export interface Trace {
  answers: Answer[];
  score: number;
}

/** Was die Set-Erzeugung pro Frage an Kalibrierung kennt. */
export interface QuestionStats {
  id: string;
  /** Anteil richtiger Antworten, null solange zu wenig Daten vorliegen. */
  pCorrect: number | null;
  meanAnswerMs: number | null;
}
