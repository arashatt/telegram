/* Per-IP rate limiting via Cloudflare's rate-limiting bindings.

   This exists to cap abuse and the AI spend behind it — a scripted loop
   against /api/chat/stream is otherwise free to run up a bill. It is not what
   stops a volumetric DDoS: that is absorbed at Cloudflare's edge, before a
   request ever reaches this Worker. */

export function clientKey(request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

export async function overLimit(limiter, key) {
  // Missing binding (local dev, or a deploy predating the config) must not
  // block real work.
  if (!limiter?.limit) return false;
  try {
    const { success } = await limiter.limit({ key });
    return !success;
  } catch (err) {
    // Fail open: a limiter outage should degrade protection, not the site.
    console.error("Rate limiter unavailable:", err.message);
    return false;
  }
}
