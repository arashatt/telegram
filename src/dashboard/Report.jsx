import { useState } from "react";
import { formatMoney, statusLabel, ORDER_STATUSES } from "../../shared/orderSchema.js";
import { useDash } from "./copy.js";
import { useResource } from "./useResource.js";
import { count, delta, duration } from "./format.js";

/* "A weekly report — revenue, top products, reply times" is a promise the
   Instagram page makes. This is it, and every number on it is computed from
   stored rows rather than estimated.

   Four figures and two rankings. The figures are stat tiles because a single
   number is not a chart; the rankings are single-series bars, so they carry no
   legend — the heading names what they are — and each bar is labelled with its
   own value, which is what a five-row ranking can afford. Colour is the site's
   one accent used as magnitude; the text stays in ink tokens, never the bar's
   colour. */

function Figure({ label, value, sub }) {
  return (
    <div className="rep__tile">
      <span className="rep__label">{label}</span>
      <strong className="rep__value" dir="ltr">
        {value}
      </strong>
      {sub && <span className="rep__sub">{sub}</span>}
    </div>
  );
}

function Ranking({ title, rows, empty }) {
  const top = Math.max(...rows.map((row) => row.amount), 1);
  if (rows.length === 0) return null;
  return (
    <section className="rep__block">
      <h3 className="rep__blocktitle">{title}</h3>
      <ol className="rep__bars">
        {rows.map((row) => (
          <li key={row.key}>
            <span className="rep__barlabel" dir="auto">
              {row.label}
            </span>
            {/* The value is on the row, so the bar is the comparison and the
                text is the number — no tooltip is hiding anything. */}
            <span className="rep__track" title={`${row.label} — ${row.value}`}>
              <span className="rep__fill" style={{ inlineSize: `${(row.amount / top) * 100}%` }} />
            </span>
            <span className="rep__barvalue" dir="ltr">
              {row.value}
            </span>
            {row.note && <span className="rep__barnote">{row.note}</span>}
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="dash__note">{empty}</p>}
    </section>
  );
}

export default function Report({ shop }) {
  const { t, lang } = useDash();
  const [days, setDays] = useState(7);
  const { loading, data } = useResource(`/api/app/report?days=${days}`, shop.shopId);

  const report = data?.report;

  return (
    <section className="rep">
      <div className="rep__ranges" role="tablist">
        {[7, 30].map((value) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-selected={days === value}
            onClick={() => setDays(value)}
          >
            {t(value === 7 ? "reportRange7" : "reportRange30")}
          </button>
        ))}
      </div>

      {loading && <p className="dash__note">{t("loading")}</p>}

      {!loading && report && (
        <>
          <div className="rep__tiles">
            <Figure
              label={t("revenue")}
              value={formatMoney(report.current.revenueCents, report.currency, lang)}
              sub={changeLabel(report.current.revenueCents, report.previous.revenueCents, t, days, lang)}
            />
            <Figure
              label={t("ordersCount")}
              value={count(report.current.orders, lang)}
              sub={changeLabel(report.current.orders, report.previous.orders, t, days, lang)}
            />
            <Figure label={t("customers")} value={count(report.current.customers, lang)} />
            <Figure
              label={t("replyTime")}
              value={report.replies.medianMs === null ? "—" : duration(report.replies.medianMs, lang)}
              sub={
                report.replies.medianMs === null
                  ? t("noReplies")
                  : report.replies.waiting
                    ? t("waitingCount", { n: count(report.replies.waiting, lang) })
                    : null
              }
            />
          </div>

          <Ranking
            title={t("topProducts")}
            empty={t("reportEmpty")}
            rows={report.topProducts.map((row) => ({
              key: row.title,
              label: row.title,
              amount: row.revenue,
              value: formatMoney(row.revenue, report.currency, lang),
              note: t("unitsSold", { n: count(row.units, lang) }),
            }))}
          />

          <Ranking
            title={t("topPosts")}
            empty={t("reportEmpty")}
            rows={report.topPosts.map((row) => ({
              key: row.post,
              label: row.post,
              amount: row.revenue,
              value: formatMoney(row.revenue, report.currency, lang),
              note: t("unitsSold", { n: count(row.orders, lang) }),
            }))}
          />

          <section className="rep__block">
            <h3 className="rep__blocktitle">{t("statusBreakdown")}</h3>
            <ul className="rep__statuses">
              {ORDER_STATUSES.map((value) => (
                <li key={value}>
                  {/* Status is never colour alone: the name is always beside
                      the swatch. */}
                  <span className="ord__status" data-status={value}>
                    {statusLabel(value, lang)}
                  </span>
                  <b dir="ltr">{count(report.statusCounts[value] ?? 0, lang)}</b>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  );
}

/* "+18% vs previous 7 days", or nothing at all when the previous window was
   empty — a percentage against zero is not a fact. */
function changeLabel(current, previous, t, days, lang) {
  const change = delta(current, previous);
  if (change === null) return null;
  const sign = change > 0 ? "+" : "";
  return `${sign}${count(change, lang)}% ${t("vsPrevious", { n: count(days, lang) })}`;
}
