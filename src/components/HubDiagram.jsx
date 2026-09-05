import { useI18n } from "../i18n.js";

/* The bot as the hub: the customer's message arrives, and the bot fans out to
   the records, the admin panel and the team's chat — which is where briefs
   already land, via worker/telegram.js.

   Geometry is symmetrical, so RTL needs no mirroring; only the labels flip,
   and they are content, so they translate. */
export default function HubDiagram() {
  const { t } = useI18n();

  return (
    <div className="hub">
      <svg viewBox="0 0 520 520" className="hub__svg" aria-hidden="true">
        <circle
          className="hub__orbit"
          cx="260"
          cy="260"
          r="170"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1.5"
          strokeDasharray="5 9"
        />
        <g stroke="var(--line)" strokeWidth="1.5">
          <path d="M260 152V108" />
          <path d="M368 260h44" />
          <path d="M260 368v44" />
          <path d="M152 260h-44" />
        </g>

        <circle className="hub__msg hub__msg--down" cx="260" cy="120" r="5" fill="var(--tg-blue)" />
        <circle
          className="hub__msg hub__msg--down hub__msg--late"
          cx="260"
          cy="212"
          r="5"
          fill="var(--tg-blue)"
        />
        <circle className="hub__msg hub__msg--right" cx="308" cy="260" r="5" fill="var(--tg-blue)" />
        <circle className="hub__msg hub__msg--left" cx="212" cy="260" r="5" fill="var(--tg-blue)" />

        <g className="hub__core">
          <circle cx="260" cy="260" r="31" fill="var(--tg-blue)" />
          <g transform="translate(236,236) scale(1.5)">
            <path
              d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
              fill="#fff"
            />
            <circle cx="10.5" cy="14" r="1.8" fill="var(--tg-blue)" />
            <circle cx="16" cy="14" r="1.8" fill="var(--tg-blue)" />
            <circle cx="21.5" cy="14" r="1.8" fill="var(--tg-blue)" />
          </g>
        </g>
      </svg>

      {/* Placed from the stylesheet rather than inline, so a narrow screen can
          move the two side anchors inward — an inline style would outrank the
          media query that does it. */}
      <span className="hub__label hub__label--n">{t("hubCustomer")}</span>
      <span className="hub__label hub__label--e">{t("hubAdmin")}</span>
      <span className="hub__label hub__label--s">{t("hubDatabase")}</span>
      <span className="hub__label hub__label--w">{t("hubTeam")}</span>
    </div>
  );
}
