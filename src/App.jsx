import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Conversation from "./components/Conversation.jsx";
import Landing from "./components/Landing.jsx";
import SignIn from "./components/SignIn.jsx";
import { BubbleMark, MoonIcon } from "./components/Icons.jsx";
import { DEFAULT_LANG, LangContext, dirFor, translations } from "./i18n.js";
import { prefersPersian } from "./lang.js";
import { SessionContext, useTelegramSession } from "./session.js";

/* The veil is opaque across its midpoint, so the language and direction swap
   entirely out of sight. That is the whole trick: the reflow is never seen, so
   no separate page fade is needed. */
const VEIL_MS = 900;
const SWAP_MS = 420;
const NOTICE_MS = 4200;

/* A visitor whose browser asks for Persian gets Persian from the first paint —
   no veil, since nothing is changing for them. */
const initialLang = () => (prefersPersian() ? "fa" : DEFAULT_LANG);

/* Follows the system by default. Not persisted, matching the site's rule that
   nothing is: the language is not remembered either, and a fresh load is a
   fresh conversation. */
const initialTheme = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export default function App() {
  const [lang, setLang] = useState(initialLang);
  const [theme, setTheme] = useState(initialTheme);
  const [veil, setVeil] = useState(false);
  const [notice, setNotice] = useState(false);
  const langRef = useRef(null);
  const timers = useRef([]);
  const dict = translations[lang];

  if (langRef.current === null) langRef.current = lang;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /* No language button: the only caller is the conversation, when the visitor
     writes Persian. Driven from here rather than from effects, so the swap is
     one intentional sequence instead of renders reacting to each other. */
  const requestLang = useCallback((next) => {
    if (langRef.current === next) return;
    langRef.current = next;
    setVeil(true);

    timers.current.push(
      setTimeout(() => {
        setLang(next);
        if (next !== DEFAULT_LANG) {
          setNotice(true);
          timers.current.push(setTimeout(() => setNotice(false), NOTICE_MS));
        }
      }, SWAP_MS)
    );
    timers.current.push(setTimeout(() => setVeil(false), VEIL_MS));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
    document.documentElement.dataset.theme = theme;
    document.title = dict.siteTitle;
  }, [lang, theme, dict]);

  const context = useMemo(() => ({ lang, setLang: requestLang }), [lang, requestLang]);
  const session = useTelegramSession();

  return (
    <LangContext.Provider value={context}>
      <SessionContext.Provider value={session}>
        <div className="page" data-theme={theme}>
          {veil && <div className="veil" aria-hidden="true" />}

          <header className="page__header">
            <div className="page__header-inner">
              {/* The whole brand is the way home. Nothing is persisted, so a
                  fresh load is a fresh conversation. */}
              <a className="brand" href="/">
                <span className="brand__disc">
                  <BubbleMark size={19} />
                </span>
                <span className="brand__title">{dict.tagline}</span>
              </a>

              <div className="page__header-end">
                <button
                  type="button"
                  className="themetoggle"
                  onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
                  aria-label={dict.themeToggle}
                >
                  <MoonIcon />
                </button>
                <SignIn />
              </div>
            </div>
          </header>

          <main>
            <Landing>
              <Conversation />
            </Landing>
          </main>

          <div className="langnotice" role="status" aria-live="polite">
            {notice && <span className="langnotice__pill">{dict.switchedToFa}</span>}
          </div>
        </div>
      </SessionContext.Provider>
    </LangContext.Provider>
  );
}
