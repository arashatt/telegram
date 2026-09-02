import { useI18n } from "../i18n.js";
import BotMark from "./BotMark.jsx";
import CodeFilm from "./CodeFilm.jsx";
import HubDiagram from "./HubDiagram.jsx";
import { CheckIcon, PlaneGlyph } from "./Icons.jsx";
import "./Landing.css";

/* Everything above the intake. The three trust cards and the checklist are
   grounded in real option sets (TIMELINE_OPTIONS, BOT_LANGUAGE_OPTIONS,
   HOSTING_OPTIONS, and the menus/database/scheduled features) — if those
   change in shared/formSchema.js, this copy should change with them.
   The languages card names a few and says "and more" rather than listing the
   set: the English page leads with the languages an international visitor is
   looking for, while the form still offers every option. */
export default function Landing({ children }) {
  const { t, lang } = useI18n();

  const trust = [
    ["trustTimelineKicker", "trustTimelineTitle", "trustTimelineBody"],
    ["trustLanguagesKicker", "trustLanguagesTitle", "trustLanguagesBody"],
    ["trustHostingKicker", "trustHostingTitle", "trustHostingBody"],
  ];

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="hero__kicker">{t("heroKicker")}</span>
          <h1 className="hero__title">{t("heroTitle")}</h1>
          <p className="hero__body">{t("heroBody")}</p>
          <div className="hero__actions">
            <a className="pill pill--lg" href="#brief">
              <PlaneGlyph size={17} />
              {t("heroPrimary")}
            </a>
            <a className="pill pill--lg pill--ghost" href="#how">
              {t("heroSecondary")}
            </a>
          </div>
        </div>
        <div className="hero__visual">
          <BotMark />
        </div>
      </section>

      <section className="trust">
        {trust.map(([kicker, title, body]) => (
          <article className="trust__card" key={kicker}>
            <span className="trust__kicker">{t(kicker)}</span>
            <h3 className="trust__title">{t(title)}</h3>
            <p className="trust__body">{t(body)}</p>
          </article>
        ))}
      </section>

      {/* The film's caption track is English only, so it is shown only on the
          English page rather than captioning a Persian one in English. */}
      <section className="film">
        <div className="film__inner">
          <h2 className="film__title">{t("filmTitle")}</h2>
          <p className="film__body">{t("filmBody")}</p>
          <CodeFilm captions={lang === "en"} pauseOffscreen />
        </div>
      </section>

      <section className="how" id="how">
        <div className="how__inner">
          <div>
            <h2 className="how__title">{t("howTitle")}</h2>
            <p className="how__body">{t("howBody")}</p>
            <ul className="how__list">
              {["howMenus", "howDatabase", "howScheduled"].map((key) => (
                <li key={key}>
                  <span className="how__tick">
                    <CheckIcon />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <div className="how__visual">
            <HubDiagram />
          </div>
        </div>
      </section>

      <section className="brief" id="brief">
        <h2 className="brief__title">{t("briefTitle")}</h2>
        <p className="brief__sub">{t("briefSub")}</p>
        {children}
      </section>

      <footer className="sitefoot">
        <div className="sitefoot__inner">
          <span>{t("footerNote")}</span>
          <a href="#brief">{t("footerLink")}</a>
        </div>
      </footer>
    </>
  );
}
