/* The three gateway modules all talk to somebody else's HTTP API, and they all
   need the same four things: a request that cannot hang forever, a JSON reply
   that might not be JSON, an HMAC, and a comparison that does not leak how much
   of a signature was right. They live here so each gateway module is only its
   own protocol. */

/* A Worker's CPU budget is generous but its wall clock is not, and a payment
   request that hangs holds a person on a spinner. Fifteen seconds is longer
   than any of these APIs should ever take and short enough to fail visibly. */
const TIMEOUT_MS = 15_000;

/* Never throws. Every failure comes back as `{ error }` so a gateway module can
   record the attempt and tell the payer something true, rather than the route
   turning an upstream outage into a 500. */
export async function upstream(url, { method = "POST", headers = {}, body, timeout = TIMEOUT_MS } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout) });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    return { error: timedOut ? "timeout" : "unreachable", detail: err?.message ?? String(err) };
  }

  const raw = await res.text().catch(() => "");
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* An HTML error page from a proxy, or a gateway having a bad day. The
       status and the first of the body are worth keeping; the rest is noise. */
    return { error: "bad_response", status: res.status, detail: `${res.status}: ${raw.slice(0, 160)}` };
  }

  return { ok: res.ok, status: res.status, data };
}

export const jsonHeaders = { "content-type": "application/json", accept: "application/json" };

export function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(String(message))));
}

/* Compares in time that does not depend on where the first difference is. A
   `===` on a signature tells an attacker, over enough attempts, how many
   leading characters they guessed right. */
export function timingSafeEqual(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export const seconds = () => Math.floor(Date.now() / 1000);
