/* HMAC-signed cookies, used for two short-lived things: the in-flight OIDC
   transaction (state, nonce, PKCE verifier) and the signed-in session.

   The browser never gets to assert who it is - it holds an opaque signed
   blob, and the Worker re-checks the signature on every read. */

import { b64uToBytes, bytesToB64u } from "./oidc.js";

const encoder = new TextEncoder();

export const TX_COOKIE = "tg_tx";
export const SESSION_COOKIE = "tg_session";
export const TX_TTL_SECONDS = 600;
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

/* Derived from the OIDC client secret so there is no extra secret to
   configure, and domain-separated so a session token can never be replayed
   as a transaction token. */
async function signingKey(secret, purpose) {
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${purpose} ${secret}`)
  );
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function sealCookie(secret, purpose, payload, ttlSeconds) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = bytesToB64u(encoder.encode(JSON.stringify(body)));
  const key = await signingKey(secret, purpose);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encoded));
  return `${encoded}.${bytesToB64u(new Uint8Array(signature))}`;
}

export async function openCookie(secret, purpose, token) {
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const key = await signingKey(secret, purpose);
    // crypto.subtle.verify is constant-time, so a forged signature leaks
    // nothing about how close it was.
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64uToBytes(signature),
      encoder.encode(encoded)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64uToBytes(encoded)));
    if (!Number.isFinite(payload?.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

/* SameSite=Lax, not Strict: the OIDC callback arrives as a top-level
   navigation from Telegram, and Strict would withhold the transaction cookie
   exactly when it is needed. */
export function cookieHeader(name, value, maxAgeSeconds, secure = true) {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export const clearCookie = (name, secure = true) => cookieHeader(name, "", 0, secure);
