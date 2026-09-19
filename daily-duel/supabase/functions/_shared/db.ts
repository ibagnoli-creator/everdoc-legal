import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Client mit Service-Role-Key. Die Tabellen sind per RLS für Clients
 * gesperrt; sämtliche Schreibpfade laufen ausschliesslich hier durch.
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/**
 * Prüft das JWT aus dem Authorization-Header und gibt die Spieler-ID zurück.
 * Null bedeutet: nicht angemeldet.
 */
export async function authenticate(request: Request): Promise<string | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/** Tagesdatum in der Zeitzone des Spielers – der Reset soll um Mitternacht
 *  am Wohnort passieren, nicht um Mitternacht UTC. */
export function playDateFor(timezone: string | null): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}
