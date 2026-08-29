import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Conversation from "./components/Conversation.jsx";
import DayNight from "./components/DayNight.jsx";
import SignIn from "./components/SignIn.jsx";
import { Mark } from "./components/Brand.jsx";
import { SessionContext, useTelegramSession } from "./session.js";
import { DEFAULT_LANG, LangContext, dirFor, translations } from "./i18n.js";
import { prefersPersian } from "./lang.js";

/* The sunset runs for DAYNIGHT_MS and is darkest at its midpoint, which is
   exactly when the language swaps — the RTL/LTR reflow happens behind the
   night sky and is never seen. The page's own fade is shorter, so content is
   already gone by the time the sky is deep. */
const DAYNIGHT_MS = 1400;
const SWAP_MS = DAYNIGHT_MS / 2;
const FADE_MS = 320;
const NOTICE_MS = 3600;

/* A visitor whose browser asks for Persian gets Persian from the first paint —
   no sunset, since nothing is changing for them. Everyone else starts in
   English, and the static HTML is English too so no Persian ever flashes in
   the tab title. */
const initialLang = () => (prefersPersian() ? "fa" : DEFAULT_LANG);

export default function App() {
  const [lang, setLang] = useState(initialLang);
  const [phase, setPhase] = useState("idle");
  const [sunset, setSunset] = useState(false);
  const [notice, setNotice] = useState(false);
  const langRef = useRef(null);
  const timers = useRef([]);
  const dict = translations[lang];

  if (langRef.current === null) langRef.current = lang;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /* There is no language button: the only caller is the conversation, when the
     visitor writes Persian. The whole sequence is driven from here rather than
     from effects, so the swap is one intentional animation instead of a chain
     of renders reacting to each other. */
  const requestLang = useCallback((next) => {
    if (langRef.current === next) return;
    langRef.current = next;
    setSunset(true);
    setPhase("out");

    timers.current.push(
      setTimeout(() => {
        setLang(next);
        setPhase("in");
        timers.current.push(setTimeout(() => setPhase("idle"), FADE_MS));
        timers.current.push(setTimeout(() => setSunset(false), SWAP_MS));

        // Say what happened once, quietly — a page that silently changes
        // direction is disorienting, and role="status" reads it out.
        if (next !== DEFAULT_LANG) {
          setNotice(true);
          timers.current.push(setTimeout(() => setNotice(false), NOTICE_MS));
        }
      }, SWAP_MS)
    );
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
    document.title = dict.siteTitle;
  }, [lang, dict]);

  const context = useMemo(() => ({ lang, setLang: requestLang }), [lang, requestLang]);
  const session = useTelegramSession();

  return (
    <LangContext.Provider value={context}>
      <SessionContext.Provider value={session}>
      <div className="page" data-phase={phase}>
        <DayNight active={sunset} />
        <header className="page__header">
          {/* The whole brand is the way home. A fresh load is a fresh
              conversation, since nothing is persisted. */}
          <a className="brand" href="/">
            <Mark size={28} filled />
            <span className="brand__title">{dict.tagline}</span>
          </a>

          <div className="page__header-end">
            <SignIn />
          </div>
        </header>

        <main className="page__main">
          <Conversation />
        </main>

        <div className="langnotice" role="status" aria-live="polite">
          {notice && <span className="langnotice__pill">{dict.switchedToFa}</span>}
        </div>
      </div>
      </SessionContext.Provider>
    </LangContext.Provider>
  );
}
