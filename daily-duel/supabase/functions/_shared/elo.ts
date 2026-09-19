/**
 * Elo, wie er in Schach und den meisten PvP-Casual-Games verwendet wird.
 * Bewusst unverändert: eine eigene Formel bringt hier nichts ausser Risiko.
 */

/** Erwarteter Ausgang für `ratingA` gegen `ratingB`, zwischen 0 und 1. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * K-Faktor. Die ersten Partien bewegen stark, damit neue Spieler schnell in
 * ihrer echten Liga ankommen statt zwanzig Runden gegen zu starke Gegner zu
 * verlieren.
 */
export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < 20 ? 40 : 20;
}

export type Outcome = "win" | "draw" | "loss";

export function outcomeOf(playerScore: number, opponentScore: number): Outcome {
  if (playerScore > opponentScore) return "win";
  if (playerScore < opponentScore) return "loss";
  return "draw";
}

const SCORE_OF: Record<Outcome, number> = { win: 1, draw: 0.5, loss: 0 };

/** Elo-Veränderung des Spielers, gerundet auf ganze Punkte. */
export function eloDelta(params: {
  playerElo: number;
  opponentElo: number;
  matchesPlayed: number;
  outcome: Outcome;
}): number {
  const expected = expectedScore(params.playerElo, params.opponentElo);
  const actual = SCORE_OF[params.outcome];
  return Math.round(kFactor(params.matchesPlayed) * (actual - expected));
}

export const LEAGUES = [
  { slug: "bronze", minElo: 0 },
  { slug: "silber", minElo: 1100 },
  { slug: "gold", minElo: 1300 },
  { slug: "platin", minElo: 1500 },
  { slug: "diamant", minElo: 1700 },
] as const;

export function leagueFor(elo: number): string {
  let current = LEAGUES[0].slug;
  for (const league of LEAGUES) {
    if (elo >= league.minElo) current = league.slug;
  }
  return current;
}
