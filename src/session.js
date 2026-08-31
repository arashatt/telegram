import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* One session for the whole page. Sign-in used to live inside the
   requirements form, which meant a visitor could not sign in until they had
   sent a message and waited for the form — and nothing outside that form knew
   who they were. The state lives here now, the header offers it, and the form
   consumes the same session. */

const POPUP = { width: 520, height: 680 };
const POLL_MS = 400;

export const SessionContext = createContext(null);

export function useSession() {
  return useContext(SessionContext);
}

export function useTelegramSession() {
  const [user, setUser] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const listeners = useRef(new Set());
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  /* Anything already on screen when a sign-in completes gets told, so a form
     that is open mid-conversation fills itself in without being remounted. */
  const subscribe = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  // Pure I/O; callers decide what to do with the answer.
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/telegram/me", { credentials: "same-origin" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetchSession().then((data) => {
      if (!live || !data) return;
      setConfigured(Boolean(data.configured));
      setUser(data.user ?? null);
    });
    return () => {
      live = false;
      stopPolling();
    };
  }, [fetchSession, stopPolling]);

  useEffect(() => {
    async function onMessage(event) {
      // Only this origin can tell us a sign-in happened.
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "telegram-auth") return;

      stopPolling();
      setPending(false);
      if (!event.data.ok) {
        setFailed(true);
        return;
      }

      const data = await fetchSession();
      if (data?.user) {
        setUser(data.user);
        listeners.current.forEach((listener) => listener(data.user));
      } else {
        setFailed(true);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fetchSession, stopPolling]);

  /* A popup, not a redirect: the conversation and a half-filled form live only
     in memory and navigating away would lose them. */
  const signIn = useCallback(() => {
    setFailed(false);
    setPending(true);

    const left = window.screenX + Math.max(0, (window.outerWidth - POPUP.width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - POPUP.height) / 2);
    const popup = window.open(
      "/api/auth/telegram/start",
      "telegram-signin",
      `width=${POPUP.width},height=${POPUP.height},left=${left},top=${top}`
    );

    if (!popup) {
      window.location.href = "/api/auth/telegram/start";
      return;
    }

    popupRef.current = popup;
    stopPolling();
    // Closing the window without finishing sends no message, so the button has
    // to notice on its own.
    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        stopPolling();
        setPending(false);
      }
    }, POLL_MS);
  }, [stopPolling]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/telegram/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Clearing locally is still the right outcome for the visitor.
    }
    setUser(null);
    setFailed(false);
  }, []);

  return { user, configured, pending, failed, signIn, signOut, subscribe };
}

export function displayName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
}

/* Contact fields a verified sign-in can prove, without ever overwriting what
   the visitor typed themselves. */
export function contactFromUser(user, existing = {}) {
  if (!user) return {};
  const filled = {};
  const name = displayName(user);
  if (name && !existing.contactName) filled.contactName = name;
  if (user.username && !existing.telegram) filled.telegram = `@${user.username}`;
  if (user.phone && !existing.phone) filled.phone = user.phone;
  return filled;
}
