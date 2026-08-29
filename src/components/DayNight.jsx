/* The language change plays as a sunset: the sky deepens, the sun sinks below
   the horizon, stars come out, the moon rises — and then it lifts back to
   daylight in the new language. The swap itself happens at peak night, while
   the page is hidden behind the overlay, so the RTL/LTR reflow is never seen.

   Purely decorative, so it is aria-hidden and never focusable. */
export default function DayNight({ active }) {
  if (!active) return null;

  return (
    <div className="daynight" aria-hidden="true">
      <div className="daynight__sky" />
      <div className="daynight__stars" />
      <div className="daynight__sun" />
      <div className="daynight__moon" />
      <div className="daynight__horizon" />
    </div>
  );
}
