import { useI18n } from "../i18n.js";

/* The hero mark: idle breath, thinking dots, and something that leaves once
   every 6.6s. Pure CSS on inline SVG — no library, no canvas, no JS ticker, so
   it costs nothing at runtime and stops dead under reduced motion. Decorative.

   Two faces, because the mark is the page's first claim about what it is: a
   chat bubble and a paper plane for Telegram, a camera frame and an up-arrow
   for Instagram. The motion, the halos and the class names are shared — only
   the two shapes differ. */
export default function BotMark() {
  const { platform } = useI18n();
  const instagram = platform === "instagram";

  return (
    <div className="botmark" aria-hidden="true">
      <span className="botmark__halo botmark__halo--outer" />
      <span className="botmark__halo botmark__halo--inner" />
      <svg viewBox="0 0 320 320" className="botmark__svg">
        <g className="botmark__bubble">
          {instagram ? (
            <g>
              <rect
                x="72"
                y="72"
                width="176"
                height="176"
                rx="54"
                fill="var(--surface)"
                stroke="var(--tg-blue)"
                strokeWidth="9"
              />
              <circle cx="221" cy="99" r="8" fill="var(--tg-blue)" />
            </g>
          ) : (
            <g transform="translate(64,64) scale(6)">
              <path
                d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
                fill="var(--surface)"
                stroke="var(--tg-blue)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          )}
          <circle className="botmark__dot" cx="127" cy={instagram ? 160 : 148} r="11" fill="var(--tg-blue)" />
          <circle className="botmark__dot" cx="160" cy={instagram ? 160 : 148} r="11" fill="var(--tg-blue)" />
          <circle className="botmark__dot" cx="193" cy={instagram ? 160 : 148} r="11" fill="var(--tg-blue)" />
        </g>
        {instagram ? (
          <g className="botmark__plane" transform="translate(200,90) scale(1.4)">
            <g
              fill="none"
              stroke="var(--tg-blue)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20V5" />
              <path d="m5.6 11.4 6.4-6.4 6.4 6.4" />
            </g>
          </g>
        ) : (
          <g className="botmark__plane" transform="translate(196,94) scale(1.5)">
            <path
              d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"
              fill="var(--tg-blue)"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
