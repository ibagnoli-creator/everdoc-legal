/** Kleine Helfer, damit die Edge Functions nur noch Spiellogik enthalten. */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

export function fail(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Verpackt einen Handler: CORS, Methodenprüfung, und eine Fehlerbarriere,
 * damit ein Stacktrace nie im Client landet.
 */
export function serveJson(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === "OPTIONS") return preflight();
    if (request.method !== "POST") {
      return fail(405, "method_not_allowed", "Nur POST.");
    }
    try {
      return await handler(request);
    } catch (error) {
      console.error(error);
      return fail(500, "internal", "Unerwarteter Fehler.");
    }
  };
}
