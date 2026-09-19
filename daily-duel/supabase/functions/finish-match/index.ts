import { authenticate, serviceClient } from "../_shared/db.ts";
import { fail, json, serveJson } from "../_shared/http.ts";
import { eloDelta, leagueFor, outcomeOf } from "../_shared/elo.ts";

/**
 * Schliesst das Duell ab: Punktestand festschreiben, Elo verrechnen, Serie
 * fortschreiben. Der Client ruft das nach der fünften Antwort auf; die
 * Punkte selbst kommen aus den serverseitig gespeicherten Einzelwertungen,
 * nicht aus dem Request.
 */
Deno.serve(serveJson(async (request) => {
  const userId = await authenticate(request);
  if (!userId) return fail(401, "unauthenticated", "Anmeldung erforderlich.");

  const { matchId } = await request.json().catch(() => ({ matchId: null }));
  if (typeof matchId !== "string") {
    return fail(400, "bad_request", "matchId erforderlich.");
  }

  const db = serviceClient();

  const { data: match } = await db
    .from("matches")
    .select("id, player_id, state, opponent_elo, opponent_is_synthetic, player_elo_before")
    .eq("id", matchId)
    .single();

  if (!match || match.player_id !== userId) {
    return fail(404, "no_match", "Duell nicht gefunden.");
  }
  if (match.state !== "playing") {
    return fail(409, "match_closed", "Dieses Duell ist bereits abgeschlossen.");
  }

  const { data: answered } = await db
    .from("served_questions")
    .select("position, points, is_correct, answered_at")
    .eq("match_id", matchId)
    .order("position");

  const rounds = answered ?? [];
  const unanswered = rounds.filter((round) => !round.answered_at);

  // Abgebrochene Runden zählen als verpasst, nicht als offen: sonst bliebe
  // ein weggewischtes Duell für immer im Zustand "playing" stehen.
  if (unanswered.length) {
    await db
      .from("served_questions")
      .update({ points: 0, is_correct: false, answered_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .is("answered_at", null);
  }

  const playerScore = rounds.reduce((sum, round) => sum + (round.points ?? 0), 0);

  const { data: trace } = await db
    .from("traces")
    .select("score")
    .eq("match_id", matchId)
    .limit(1)
    .single();

  const opponentScore = trace?.score ?? 0;

  const { data: player } = await db
    .from("users")
    .select("matches_played, streak")
    .eq("id", userId)
    .single();

  const outcome = outcomeOf(playerScore, opponentScore);
  const delta = eloDelta({
    playerElo: match.player_elo_before,
    opponentElo: match.opponent_elo,
    matchesPlayed: player?.matches_played ?? 0,
    outcome,
  });

  const { error } = await db.rpc("finalize_match", {
    p_match_id: matchId,
    p_player_score: playerScore,
    p_opponent_score: opponentScore,
    p_elo_delta: delta,
  });

  if (error) return fail(500, "finalize_failed", "Ergebnis konnte nicht gespeichert werden.");

  const { data: updated } = await db
    .from("users")
    .select("elo, streak, matches_played")
    .eq("id", userId)
    .single();

  return json({
    outcome,
    playerScore,
    opponentScore,
    eloBefore: match.player_elo_before,
    eloAfter: updated?.elo ?? match.player_elo_before + delta,
    eloDelta: delta,
    league: leagueFor(updated?.elo ?? match.player_elo_before + delta),
    streak: updated?.streak ?? 0,
    // Übungsduelle zählen für die Wertung, werden im Ergebnis aber als
    // solche ausgewiesen.
    wasPractice: match.opponent_is_synthetic,
    rounds: rounds.map((round) => ({
      position: round.position,
      points: round.points ?? 0,
      isCorrect: round.is_correct ?? false,
    })),
  });
}));
