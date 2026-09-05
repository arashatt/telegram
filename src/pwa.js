/* The bits that make the two sites installable on a phone.

   Kept out of the components because two of them have to happen before React
   exists: `beforeinstallprompt` fires once and early, and the service worker
   should be registered from the entry point rather than from a render. */

/* ---- install prompt ----

   Chrome (and every Chromium browser on Android) fires `beforeinstallprompt`
   when it decides the site is installable, and it fires it once. The event is
   captured here at module scope — before React mounts — and replayed to
   whoever subscribes afterwards, so a banner mounted a second later still
   knows the browser is willing.

   Calling preventDefault() is what suppresses Chrome's own mini-infobar; in
   exchange we owe the visitor a way to install, which is InstallPrompt.jsx. */
let deferred = null;
const listeners = new Set();

const announce = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    announce();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    announce();
  });
}

export const canInstall = () => deferred !== null;

/* Shaped for useSyncExternalStore: a stable subscribe that returns its own
   unsubscribe, so the banner never has to correct itself from an effect. */
export function subscribeInstallable(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/* The captured event is single use — once prompt() has been called it cannot
   be called again, so it is dropped whether the visitor accepts or not.
   Chrome fires a fresh one on a later visit if they declined. */
export async function promptInstall() {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  announce();
  event.prompt();
  const choice = await event.userChoice;
  return choice?.outcome || "dismissed";
}

/* ---- what the browser can and cannot do ---- */

/* Already installed: the app is running from the home screen, so there is
   nothing to offer. `navigator.standalone` is iOS Safari's own flag, which
   predates and still outlives the display-mode query there. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true ||
    window.navigator.standalone === true
  );
}

/* iOS has no beforeinstallprompt and no programmatic install at all: the only
   route is Share → Add to Home Screen, which the visitor has to be told about.
   Every iOS browser is WebKit underneath, but only Safari's own shell offers
   that menu item, so Chrome, Firefox, Edge and Opera on iOS are excluded —
   telling their users to tap a button that is not there would be worse than
   saying nothing. */
export function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    /* iPadOS 13+ reports itself as a Mac; the touch points give it away. */
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
}

/* ---- remembering a dismissal ----

   The one thing this site stores. The rest of it deliberately persists
   nothing — a fresh load is a fresh conversation — but a banner that returns
   on every visit after being waved away is a different kind of rudeness, so
   the dismissal is kept for a month, per browser, and never leaves it. */
const DISMISS_KEY = "install-dismissed-at";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function wasDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    /* Private mode and "block site data" both throw on access, not on write. */
    return false;
  }
}

export function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* Nothing to do: the banner stays gone for this page view either way. */
  }
}

/* ---- service worker ----

   Registered only from a built site. Over `vite dev` a worker would serve
   yesterday's modules against today's HMR, which is a long afternoon.

   No automatic reload when a new worker takes over: nothing here is
   persisted, so reloading under someone mid-conversation would throw away
   the brief they are in the middle of writing. The new version is picked up
   on their next load, which is soon enough for a page like this. */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* An unsupported context — a sandboxed frame, a private window in some
         browsers — is not an error worth showing anyone. */
    });
  });
}
