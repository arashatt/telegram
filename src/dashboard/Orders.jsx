import { useCallback, useEffect, useState } from "react";
import { ORDER_STATUSES, formatMoney, statusLabel } from "../../shared/orderSchema.js";
import { get, post } from "./api.js";
import { useDash } from "./copy.js";
import { count, relativeTime } from "./format.js";
import { EVENT_LABELS } from "../../shared/orderSchema.js";

/* The screen a shop owner actually lives in: what came in, from whom, and what
   still needs doing about it. Newest first, because the newest is the one
   somebody is waiting on. */

function StatusPill({ status, lang }) {
  return (
    <span className="ord__status" data-status={status}>
      {statusLabel(status, lang)}
    </span>
  );
}

export default function Orders({ shop }) {
  const { t, lang } = useDash();
  const [status, setStatus] = useState("");
  const [state, setState] = useState({ key: null, orders: [], cursor: null, counts: {} });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [reloads, setReloads] = useState(0);

  const key = `${shop.shopId}|${status}|${reloads}`;

  useEffect(() => {
    let live = true;
    const query = status ? `/api/app/orders?status=${status}` : "/api/app/orders";
    get(query, shop.shopId)
      .then((data) => {
        if (live) setState({ key, orders: data.orders, cursor: data.cursor, counts: data.counts });
      })
      .catch(() => {
        if (live) setState({ key, orders: [], cursor: null, counts: {}, failed: true });
      });
    return () => {
      live = false;
    };
  }, [key, shop.shopId, status]);

  const more = useCallback(async () => {
    if (!state.cursor || busy) return;
    setBusy(true);
    try {
      const query = `/api/app/orders?before=${state.cursor}${status ? `&status=${status}` : ""}`;
      const data = await get(query, shop.shopId);
      setState((prev) => ({
        ...prev,
        orders: [...prev.orders, ...data.orders],
        cursor: data.cursor,
      }));
    } finally {
      setBusy(false);
    }
  }, [state.cursor, busy, status, shop.shopId]);

  const move = useCallback(
    async (id, next) => {
      setBusy(true);
      try {
        const { order } = await post(`/api/app/orders/${id}/status`, shop.shopId, { status: next });
        setState((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? { ...o, status: order.status } : o)),
        }));
        setOpen((prev) => (prev && prev.id === id ? { ...prev, status: order.status } : prev));
        setReloads((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [shop.shopId]
  );

  const loading = state.key !== key;
  const total = Object.values(state.counts).reduce((sum, n) => sum + n, 0);

  return (
    <section className="ord">
      <div className="ord__filters" role="tablist">
        <button
          type="button"
          className="chip"
          aria-selected={status === ""}
          onClick={() => setStatus("")}
        >
          {t("all")} <b>{count(total, lang)}</b>
        </button>
        {ORDER_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
          >
            {statusLabel(value, lang)} <b>{count(state.counts[value] ?? 0, lang)}</b>
          </button>
        ))}
      </div>

      {loading && <p className="dash__note">{t("loading")}</p>}

      {!loading && state.orders.length === 0 && (
        <div className="dash__card dash__card--empty">
          <h2>{t("ordersEmpty")}</h2>
          <p>{t("ordersEmptyBody")}</p>
        </div>
      )}

      <ul className="ord__list">
        {state.orders.map((order) => (
          <li key={order.id}>
            <button type="button" className="ord__row" onClick={() => setOpen(order)}>
              <span className="ord__who" dir="ltr">
                {order.customer || "—"}
              </span>
              <span className="ord__meta">
                <span dir="ltr">{order.ref}</span>
                <span>·</span>
                <time dateTime={new Date(order.createdAt).toISOString()}>
                  {relativeTime(order.createdAt, lang)}
                </time>
              </span>
              <span className="ord__amount" dir="ltr">
                {formatMoney(order.totalCents, order.currency, lang)}
              </span>
              <StatusPill status={order.status} lang={lang} />
            </button>
          </li>
        ))}
      </ul>

      {state.cursor && (
        <button type="button" className="pill pill--ghost ord__more" onClick={more} disabled={busy}>
          {busy ? t("loading") : t("loadMore")}
        </button>
      )}

      {open && (
        <OrderSheet
          shop={shop}
          order={open}
          onClose={() => setOpen(null)}
          onMove={move}
          busy={busy}
        />
      )}
    </section>
  );
}

/* The detail, including the conversation the order came out of — which is the
   part that makes a disputed order answerable. */
function OrderSheet({ shop, order, onClose, onMove, busy }) {
  const { t, lang } = useDash();
  const [full, setFull] = useState(null);

  useEffect(() => {
    let live = true;
    get(`/api/app/orders/${order.id}`, shop.shopId)
      .then((data) => {
        if (live) setFull(data.order);
      })
      .catch(() => {
        if (live) setFull({ ...order, items: [], events: [] });
      });
    return () => {
      live = false;
    };
  }, [order, shop.shopId]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = full ?? order;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={data.ref}>
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label={t("close")} />
      <div className="sheet__panel">
        <header className="sheet__head">
          <div>
            <p className="sheet__ref" dir="ltr">
              {data.ref}
            </p>
            <h2 dir="ltr">{data.customer || "—"}</h2>
          </div>
          <StatusPill status={data.status} lang={lang} />
        </header>

        <dl className="sheet__facts">
          {data.sourcePost && (
            <>
              <dt>{t("orderPost")}</dt>
              <dd dir="auto">{data.sourcePost}</dd>
            </>
          )}
          {data.keyword && (
            <>
              <dt>{t("orderKeyword")}</dt>
              <dd dir="ltr">{data.keyword}</dd>
            </>
          )}
          {data.note && (
            <>
              <dt>{t("orderNote")}</dt>
              <dd dir="auto">{data.note}</dd>
            </>
          )}
        </dl>

        {data.items?.length > 0 && (
          <>
            <h3 className="sheet__title">{t("orderItems")}</h3>
            <ul className="sheet__items">
              {data.items.map((item) => (
                <li key={item.id}>
                  <span dir="auto">{item.title}</span>
                  <span className="sheet__qty" dir="ltr">
                    ×{count(item.qty, lang)}
                  </span>
                  <span dir="ltr">
                    {formatMoney(item.unitPriceCents * item.qty, data.currency, lang)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="sheet__total">
          <span>{t("orderTotal")}</span>
          <b dir="ltr">{formatMoney(data.totalCents, data.currency, lang)}</b>
        </p>

        <h3 className="sheet__title">{t("moveTo")}</h3>
        <div className="sheet__moves">
          {ORDER_STATUSES.filter((value) => value !== data.status).map((value) => (
            <button
              key={value}
              type="button"
              className="chip chip--action"
              disabled={busy}
              onClick={() => onMove(data.id, value)}
            >
              {statusLabel(value, lang)}
            </button>
          ))}
        </div>

        {data.events?.length > 0 && (
          <>
            <h3 className="sheet__title">{t("orderTimeline")}</h3>
            <ol className="sheet__events">
              {data.events.map((event, index) => (
                <li key={`${event.at}-${index}`} data-type={event.type}>
                  <span>{EVENT_LABELS[event.type]?.[lang === "fa" ? "fa" : "en"] ?? event.type}</span>
                  <time dateTime={new Date(event.at).toISOString()}>
                    {relativeTime(event.at, lang)}
                  </time>
                </li>
              ))}
            </ol>
          </>
        )}

        <button type="button" className="pill pill--ghost sheet__close" onClick={onClose}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}
