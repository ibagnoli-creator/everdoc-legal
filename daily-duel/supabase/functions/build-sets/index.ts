import { serviceClient } from "../_shared/db.ts";
import { fail, json, serveJson } from "../_shared/http.ts";
import { BUCKET_COUNT, buildQuestionSet } from "../_shared/sets.ts";
import type { PoolQuestion } from "../_shared/sets.ts";

/**
 * Nächtlicher Job: legt neue Fragensets an.
 *
 * Sets werden vorab erzeugt, nicht beim Match-Start. Zwei Gründe: der Start
 * soll schnell sein, und beide Spieler eines asynchronen Duells müssen
 * garantiert dieselben fünf Fragen bekommen.
 *
 * Aufruf per Supabase Scheduled Function mit dem Cron-Secret im Header –
 * dieser Endpunkt gehört keinem Spieler.
 */
Deno.serve(serveJson(async (request) => {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== Deno.env.get("CRON_SECRET")) {
    return fail(401, "unauthenticated", "Nicht für Clients.");
  }

  const { locale = "de", setsPerBucket = 40 } = await request.json().catch(() => ({}));
  const db = serviceClient();

  const { data: questions, error } = await db
    .from("questions")
    .select("id, category_id, times_served, times_correct")
    .eq("locale", locale)
    .eq("status", "live");

  if (error) return fail(500, "pool_unavailable", "Fragenpool nicht lesbar.");

  const pool: PoolQuestion[] = (questions ?? []).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    pCorrect: row.times_served >= 30 ? row.times_correct / row.times_served : null,
  }));

  if (pool.length < 5) {
    return fail(503, "pool_too_small", `Nur ${pool.length} Fragen verfügbar.`);
  }

  // Gegen Wiederholung: bereits vorhandene Sets desselben Zuschnitts werden
  // übersprungen, statt den Pool mit Dubletten zu fluten.
  const { data: existing } = await db
    .from("question_sets")
    .select("question_ids")
    .eq("locale", locale);

  const seen = new Set(
    (existing ?? []).map((row) => [...row.question_ids].sort().join("|")),
  );

  const rows: { locale: string; difficulty_bucket: number; question_ids: string[] }[] = [];
  let skipped = 0;

  for (let bucket = 0; bucket < BUCKET_COUNT; bucket++) {
    for (let i = 0; i < setsPerBucket; i++) {
      const seed = Date.now() + bucket * 1_000 + i;
      const questionIds = buildQuestionSet(pool, bucket, seed);
      const fingerprint = [...questionIds].sort().join("|");

      if (seen.has(fingerprint)) {
        skipped++;
        continue;
      }
      seen.add(fingerprint);
      rows.push({ locale, difficulty_bucket: bucket, question_ids: questionIds });
    }
  }

  if (rows.length) {
    const { error: insertError } = await db.from("question_sets").insert(rows);
    if (insertError) return fail(500, "insert_failed", "Sets nicht gespeichert.");
  }

  return json({ created: rows.length, skippedAsDuplicate: skipped, poolSize: pool.length });
}));
