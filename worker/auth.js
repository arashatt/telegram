/* The three endpoints behind "Sign in with Telegram".

   Flow: /start redirects into Telegram's OIDC provider, Telegram redirects
   back to /callback with a code, the Worker exchanges it and stores an
   HMAC-signed session cookie. The page then asks /me who it is talking to.
   The client secret and the id_token never reach the browser. */

import {
  codeChallenge,
  exchangeCode,
  getDiscovery,
  issuerFor,
  randomToken,
  userFromClaims,
  verifyIdToken,
} from "./oidc.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  TX_COOKIE,
  TX_TTL_SECONDS,
  clearCookie,
  cookieHeader,
  openCookie,
  readCookie,
  sealCookie,
} from "./session.js";

const SCOPE = "openid";

/* Public — it travels in the authorization URL, so it is a code default rather
   than a secret. Override it from the dashboard to point at a different app. */
const DEFAULT_CLIENT_ID = "8928298590";

export const clientId = (env) => env?.TELEGRAM_CLIENT_ID || DEFAULT_CLIENT_ID;

/* Only the secret gates sign-in: without it the exchange cannot happen, so the
   button is not offered at all. */
export function isAuthConfigured(env) {
  return Boolean(env?.TELEGRAM_CLIENT_SECRET);
}

function redirectUri(request, env) {
  return env.TELEGRAM_REDIRECT_URI || new URL("/api/auth/telegram/callback", request.url).toString();
}

// http://localhost during `wrangler dev` would reject a Secure cookie.
const isSecure = (request) => new URL(request.url).protocol === "https:";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/* The popup closes itself and tells the opener to refresh its idea of who is
   signed in. targetOrigin is pinned to this origin so the message cannot be
   read by a page from anywhere else. */
function popupCloser(origin, ok, reason = "") {
  const payload = JSON.stringify({ type: "telegram-auth", ok, reason });
  return `<!doctype html><meta charset="utf-8"><title>Signing in…</title>
<body style="font:14px system-ui;padding:24px">
<p>${ok ? "Signed in. You can close this window." : "Sign-in failed: " + escapeHtml(reason)}</p>
<script>
  try { window.opener && window.opener.postMessage(${payload}, ${JSON.stringify(origin)}); } catch (e) {}
  setTimeout(function () { try { window.close(); } catch (e) {} }, ${ok ? 150 : 2500});
</script>`;
}

/* cookies is a list because the callback sets two of them, and Set-Cookie is
   the one header that must never be comma-joined. */
function html(body, status = 200, cookies = []) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(body, { status, headers });
}

export async function handleAuthStart(request, env) {
  if (!isAuthConfigured(env)) {
    return html(popupCloser(new URL(request.url).origin, false, "not configured"), 503);
  }

  const discovery = await getDiscovery(env);
  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(32);

  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId(env));
  authUrl.searchParams.set("redirect_uri", redirectUri(request, env));
  authUrl.searchParams.set("scope", env.TELEGRAM_OIDC_SCOPE || SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", await codeChallenge(verifier));
  authUrl.searchParams.set("code_challenge_method", "S256");

  const tx = await sealCookie(
    env.TELEGRAM_CLIENT_SECRET,
    "tx",
    { state, nonce, verifier },
    TX_TTL_SECONDS
  );

  return new Response(null, {
    status: 302,
    headers: {
      location: authUrl.toString(),
      "set-cookie": cookieHeader(TX_COOKIE, tx, TX_TTL_SECONDS, isSecure(request)),
      "cache-control": "no-store",
    },
  });
}

export async function handleAuthCallback(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const secure = isSecure(request);
  const dropTx = clearCookie(TX_COOKIE, secure);

  const fail = (reason) => html(popupCloser(origin, false, reason), 400, [dropTx]);

  if (url.searchParams.get("error")) {
    return fail(url.searchParams.get("error_description") || url.searchParams.get("error"));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("missing code or state");

  const tx = await openCookie(
    env.TELEGRAM_CLIENT_SECRET,
    "tx",
    readCookie(request, TX_COOKIE)
  );
  if (!tx) return fail("sign-in expired, please try again");

  // Constant-time-ish equality is unnecessary here (state is single-use and
  // already secret), but a mismatch means CSRF and must abort.
  if (tx.state !== state) return fail("state mismatch");

  try {
    const discovery = await getDiscovery(env);
    const tokens = await exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      code,
      codeVerifier: tx.verifier,
      redirectUri: redirectUri(request, env),
      clientId: clientId(env),
      clientSecret: env.TELEGRAM_CLIENT_SECRET,
    });

    const claims = await verifyIdToken(tokens.id_token, {
      jwksUri: discovery.jwks_uri,
      issuer: issuerFor(env),
      clientId: clientId(env),
      nonce: tx.nonce,
    });

    const user = userFromClaims(claims);
    if (!user.id) return fail("id_token had no subject");

    const session = await sealCookie(
      env.TELEGRAM_CLIENT_SECRET,
      "session",
      { user },
      SESSION_TTL_SECONDS
    );

    return html(popupCloser(origin, true), 200, [
      dropTx,
      cookieHeader(SESSION_COOKIE, session, SESSION_TTL_SECONDS, secure),
    ]);
  } catch (err) {
    console.error("Telegram OIDC callback failed:", err.message);
    return fail("could not verify the sign-in");
  }
}

export async function currentUser(request, env) {
  const session = await openCookie(
    env.TELEGRAM_CLIENT_SECRET,
    "session",
    readCookie(request, SESSION_COOKIE)
  );
  return session?.user ?? null;
}

export async function handleAuthMe(request, env) {
  const user = await currentUser(request, env);
  return new Response(JSON.stringify({ user, configured: isAuthConfigured(env) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function handleAuthLogout(request) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": clearCookie(SESSION_COOKIE, isSecure(request)),
      "cache-control": "no-store",
    },
  });
}
