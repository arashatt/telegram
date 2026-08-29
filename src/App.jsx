import { useEffect, useMemo, useState } from "react";
import Conversation from "./components/Conversation.jsx";
import { LemonMark } from "./components/Brand.jsx";
import {
  DEFAULT_LANG,
  LANGS,
  LangContext,
  STORAGE_KEY,
  dirFor,
  translations,
} from "./i18n.js";

function initialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGS.includes(stored)) return stored;
  } catch {
    // Storage can be blocked (private mode, embedded frames) — fall through.
  }
  return DEFAULT_LANG;
}

export default function App() {
  const [lang, setLang] = useState(initialLang);
  const dict = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
    document.title = `${dict.brand} — ${dict.tagline}`;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Persisting the choice is a convenience, not a requirement.
    }
  }, [lang, dict]);

  const context = useMemo(() => ({ lang, setLang }), [lang]);
  const other = LANGS.find((l) => l !== lang) ?? DEFAULT_LANG;

  return (
    <LangContext.Provider value={context}>
      <div className="page">
        <header className="page__header">
          <div className="brand">
            <LemonMark size={28} filled />
            <div>
              <span className="brand__name">{dict.brand}</span>
              <span className="brand__tagline">{dict.tagline}</span>
            </div>
          </div>
          <button
            type="button"
            className="langswitch"
            onClick={() => setLang(other)}
            aria-label={dict.langToggleLabel}
            lang={other}
          >
            {dict.langToggle}
          </button>
        </header>

        <main className="page__main">
          <Conversation />
        </main>
      </div>
    </LangContext.Provider>
  );
}
