/* Verification for the Telegram Login Widget.

   Telegram signs the payload with HMAC-SHA256, keyed by SHA-256 of the bot
   token. Because the signature is self-contained and re-checkable, no session
   is needed: the browser hands the same payload back when it submits a brief
   and the Worker verifies it again from scratch. auth_date bounds how long a
   captured payload stays usable. */

const AUTH_MAX_AGE_SECONDS = 3600;
const CLOCK_SKEW_SECONDS = 60;
const HASH_RE = /^[a-f0-9]{64}$/i;

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* Compares in constant time: a length-independent early return would leak how
   much of a forged hash was correct. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyTelegramAuth(botToken, payload) {
  if (!botToken || !payload || typeof payload !== "object") return null;

  const { hash, ...fields } = payload;
  if (typeof hash !== "string" || !HASH_RE.test(hash)) return null;

  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate)) return null;
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > AUTH_MAX_AGE_SECONDS || age < -CLOCK_SKEW_SECONDS) return null;

  // Telegram's data_check_string: every received field except hash, sorted by
  // key, as key=value joined with newlines.
  const checkString = Object.keys(fields)
    .filter((key) => fields[key] !== undefined && fields[key] !== null)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const encoder = new TextEncoder();
  const secret = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(checkString));

  if (!timingSafeEqual(toHex(signature), hash.toLowerCase())) return null;

  return {
    id: String(fields.id ?? ""),
    username: typeof fields.username === "string" ? fields.username.slice(0, 64) : "",
    firstName: typeof fields.first_name === "string" ? fields.first_name.slice(0, 80) : "",
    lastName: typeof fields.last_name === "string" ? fields.last_name.slice(0, 80) : "",
    authDate,
  };
}

export function displayName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
}
