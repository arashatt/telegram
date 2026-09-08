/* The request/response plumbing both route files share, so the body cap and
   the JSON shape are defined once rather than per endpoint. */

export const MAX_BODY_BYTES = 64 * 1024;

/* The public intake endpoints are called from the two marketing pages and are
   deliberately open. The dashboard's are not: they carry a session cookie, and
   a credentialed request can never use "*" anyway — see jsonPrivate. */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...headers },
  });
}

/* Same shape, no cross-origin invitation, and never stored: these answers are
   one shop's data and belong to the person who asked for them. */
export function jsonPrivate(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function readBody(request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { tooLarge: true };
  if (!text) return { body: {} };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { invalid: true };
  }
}
