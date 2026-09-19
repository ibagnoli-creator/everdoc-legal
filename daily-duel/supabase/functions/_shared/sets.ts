import { makeRng } from "./random.ts";
import { QUESTIONS_PER_MATCH } from "./types.ts";

/**
 * Fragensets werden vorab erzeugt (nächtlicher Cron), nicht zur Laufzeit:
 * Beide Spieler eines asynchronen Duells müssen dieselben fünf Fragen sehen,
 * und die Auswahl soll nicht im heissen Pfad des Match-Starts hängen.
 */

export interface PoolQuestion {
  id: string;
  categoryId: number;
  /** Empirischer p-Wert, null solange die Frage zu selten gestellt wurde. */
  pCorrect: number | null;
}

export const BUCKET_COUNT = 5;

/** Ziel-Trefferquote je Schwierigkeits-Bucket. */
const TARGET_P_CORRECT = [0.8, 0.7, 0.6, 0.5, 0.4];

/** Neue Fragen ohne Statistik werden als mittelschwer behandelt. */
const ASSUMED_P_CORRECT = 0.6;

/** Höchstens zwei Fragen aus derselben Kategorie pro Set. */
const MAX_PER_CATEGORY = 2;

export function bucketForElo(elo: number): number {
  if (elo < 1100) return 0;
  if (elo < 1250) return 1;
  if (elo < 1400) return 2;
  if (elo < 1600) return 3;
  return 4;
}

export function targetPCorrect(bucket: number): number {
  return TARGET_P_CORRECT[clampBucket(bucket)];
}

/**
 * Wählt fünf Fragen, deren Schwierigkeit zum Bucket passt.
 *
 * Nicht einfach die fünf nächstliegenden: aus den besten Kandidaten wird
 * zufällig gezogen, sonst bekommt jeder Spieler eines Buckets über Wochen
 * dieselben Fragen. `seed` macht die Auswahl reproduzierbar.
 */
export function buildQuestionSet(
  pool: PoolQuestion[],
  bucket: number,
  seed: number,
): string[] {
  if (pool.length < QUESTIONS_PER_MATCH) {
    throw new Error(
      `Fragenpool zu klein: ${pool.length} Fragen, ${QUESTIONS_PER_MATCH} benötigt`,
    );
  }

  const target = targetPCorrect(bucket);
  const rng = makeRng(seed);

  // Kandidatenfenster: viermal so viele wie gebraucht, damit die Zufallsziehung
  // noch Spielraum hat, ohne die Schwierigkeit zu verwässern.
  const candidates = [...pool]
    .sort((a, b) => distance(a, target) - distance(b, target))
    .slice(0, Math.max(QUESTIONS_PER_MATCH * 4, QUESTIONS_PER_MATCH));

  shuffle(candidates, rng);

  const chosen: PoolQuestion[] = [];
  const perCategory = new Map<number, number>();

  for (const pass of [MAX_PER_CATEGORY, Infinity]) {
    for (const question of candidates) {
      if (chosen.length === QUESTIONS_PER_MATCH) break;
      if (chosen.includes(question)) continue;

      const used = perCategory.get(question.categoryId) ?? 0;
      if (used >= pass) continue;

      chosen.push(question);
      perCategory.set(question.categoryId, used + 1);
    }
    if (chosen.length === QUESTIONS_PER_MATCH) break;
    // Zweiter Durchlauf ohne Kategoriegrenze: lieber ein einseitiges Set als
    // gar kein Duell. Kommt nur bei dünnem Pool vor.
  }

  return chosen.map((question) => question.id);
}

function distance(question: PoolQuestion, target: number): number {
  return Math.abs((question.pCorrect ?? ASSUMED_P_CORRECT) - target);
}

function shuffle<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function clampBucket(bucket: number): number {
  return Math.min(BUCKET_COUNT - 1, Math.max(0, Math.trunc(bucket)));
}
