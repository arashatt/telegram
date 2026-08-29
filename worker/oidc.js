/* Telegram's OpenID Connect provider — Authorization Code flow with PKCE.

   This replaces the old Login Widget, whose iframe posted a payload signed
   with the bot token. Here the client secret never leaves the Worker, the
   code is bound to a PKCE verifier, and identity arrives as an id_token
   signed by Telegram and checked against their published JWKS. */

const DEFAULT_ISSUER = "https://oauth.telegram.org";
const DISCOVERY_PATH = "/.well-known/openid-configuration";
const CACHE_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 120;

let discoveryCache = null;
let jwksCache = null;

/* ---------- base64url ---------- */

export function bytesToB64u(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64uToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const b64uToString = (value) => new TextDecoder().decode(b64uToBytes(value));

/* ---------- PKCE ---------- */

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToB64u(bytes);
}

export async function codeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToB64u(new Uint8Array(digest));
}

/* ---------- provider metadata ---------- */

export function issuerFor(env) {
  return (env.TELEGRAM_OIDC_ISSUER || DEFAULT_ISSUER).replace(/\/$/, "");
}

export async function getDiscovery(env, fetchImpl = fetch) {
  const issuer = issuerFor(env);
  if (discoveryCache?.issuer === issuer && discoveryCache.expires > Date.now()) {
    return discoveryCache.value;
  }

  const res = await fetchImpl(issuer + DISCOVERY_PATH, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
  const value = await res.json();

  if (value.issuer && value.issuer.replace(/\/$/, "") !== issuer) {
    throw new Error("OIDC discovery issuer mismatch");
  }
  if (!value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) {
    throw new Error("OIDC discovery is missing required endpoints");
  }

  discoveryCache = { issuer, value, expires: Date.now() + CACHE_MS };
  return value;
}

async function getJwks(jwksUri, fetchImpl, force = false) {
  if (!force && jwksCache?.uri === jwksUri && jwksCache.expires > Date.now()) {
    return jwksCache.keys;
  }
  const res = await fetchImpl(jwksUri, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache = { uri: jwksUri, keys, expires: Date.now() + CACHE_MS };
  return keys;
}

/* ---------- id_token verification ---------- */

const ALGORITHMS = {
  RS256: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  RS384: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  RS512: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  PS256: { import: { name: "RSA-PSS", hash: "SHA-256" }, verify: { name: "RSA-PSS", saltLength: 32 } },
  ES256: { import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" } },
};

/* WebCrypto rejects a JWK carrying key_ops/use that disagree with the usage
   we ask for, and providers vary in what they include — so import only the
   fields that describe the key itself. */
function cleanJwk(jwk) {
  const picked = {};
  for (const field of ["kty", "n", "e", "crv", "x", "y"]) {
    if (jwk[field] !== undefined) picked[field] = jwk[field];
  }
  return picked;
}

async function findKey(jwksUri, kid, fetchImpl) {
  let keys = await getJwks(jwksUri, fetchImpl);
  let match = kid ? keys.find((k) => k.kid === kid) : keys[0];

  // An unknown kid usually means Telegram rotated keys; refetch once before
  // treating the token as bad.
  if (!match) {
    keys = await getJwks(jwksUri, fetchImpl, true);
    match = kid ? keys.find((k) => k.kid === kid) : keys[0];
  }
  if (!match) throw new Error("No matching JWKS key for id_token");
  return match;
}

export async function verifyIdToken(idToken, options) {
  const { jwksUri, issuer, clientId, nonce, fetchImpl = fetch, now = Date.now() } = options;

  const parts = String(idToken ?? "").split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");

  const header = JSON.parse(b64uToString(parts[0]));
  const claims = JSON.parse(b64uToString(parts[1]));

  const spec = ALGORITHMS[header.alg];
  if (!spec) throw new Error(`Unsupported id_token algorithm: ${header.alg}`);

  const jwk = await findKey(jwksUri, header.kid, fetchImpl);
  const key = await crypto.subtle.importKey("jwk", cleanJwk(jwk), spec.import, false, [
    "verify",
  ]);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(spec.verify, key, b64uToBytes(parts[2]), signed);
  if (!valid) throw new Error("id_token signature is not valid");

  if (String(claims.iss ?? "").replace(/\/$/, "") !== issuer) {
    throw new Error("id_token issuer mismatch");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(clientId)) throw new Error("id_token audience mismatch");
  if (claims.azp !== undefined && claims.azp !== clientId) {
    throw new Error("id_token azp mismatch");
  }

  const seconds = Math.floor(now / 1000);
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) + CLOCK_SKEW_SECONDS < seconds) {
    throw new Error("id_token has expired");
  }
  if (Number.isFinite(Number(claims.iat)) && Number(claims.iat) - CLOCK_SKEW_SECONDS > seconds) {
    throw new Error("id_token was issued in the future");
  }
  if (nonce !== undefined && claims.nonce !== nonce) throw new Error("id_token nonce mismatch");

  return claims;
}

/* ---------- token exchange ---------- */

export async function exchangeCode(options) {
  const {
    tokenEndpoint,
    code,
    codeVerifier,
    redirectUri,
    clientId,
    clientSecret,
    fetchImpl = fetch,
  } = options;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetchImpl(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${payload.error ?? "unknown error"}`
    );
  }
  if (!payload.id_token) throw new Error("Token response contained no id_token");
  return payload;
}

/* Claim names vary between providers; take the first that is present rather
   than assuming one shape. */
export function userFromClaims(claims) {
  const first = claims.given_name ?? claims.first_name ?? "";
  const last = claims.family_name ?? claims.last_name ?? "";
  const full = claims.name ?? [first, last].filter(Boolean).join(" ");
  return {
    id: String(claims.sub ?? ""),
    username: String(claims.preferred_username ?? claims.username ?? "").replace(/^@/, ""),
    firstName: String(first || full || ""),
    lastName: String(last || ""),
  };
}
