import { useCallback, useEffect, useState } from "react";
import { formatMoney, validateProduct } from "../../shared/orderSchema.js";
import { ApiError, get, post } from "./api.js";
import { useDash } from "./copy.js";
import { count } from "./format.js";

/* What the shop sells, which is what the automation quotes from. Editing here
   changes what a customer is offered in a DM tomorrow; it never rewrites what
   an order was sold for yesterday — order lines keep their own copy of the
   title and price. */

const EMPTY = { title: "", sku: "", price: "", stock: "", active: true };

export default function Catalog({ shop }) {
  const { t, lang } = useDash();
  const [state, setState] = useState({ key: null, products: [] });
  const [editing, setEditing] = useState(null);
  const [problem, setProblem] = useState(null);
  const [reloads, setReloads] = useState(0);

  const key = `${shop.shopId}|${reloads}`;

  useEffect(() => {
    let live = true;
    get("/api/app/products", shop.shopId)
      .then((data) => {
        if (live) setState({ key, products: data.products });
      })
      .catch(() => {
        if (live) setState({ key, products: [] });
      });
    return () => {
      live = false;
    };
  }, [key, shop.shopId]);

  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  const remove = useCallback(
    async (product) => {
      if (!window.confirm(t("removeConfirm"))) return;
      setProblem(null);
      try {
        await post(`/api/app/products/${product.id}/delete`, shop.shopId);
        refresh();
      } catch (err) {
        setProblem(err.code === "has_orders" ? "errHasOrders" : "errNetwork");
      }
    },
    [shop.shopId, refresh, t]
  );

  const loading = state.key !== key;

  return (
    <section className="cat">
      <div className="cat__head">
        <button type="button" className="pill" onClick={() => setEditing(EMPTY)}>
          {t("addProduct")}
        </button>
      </div>

      {problem && <p className="dash__error">{t(problem)}</p>}
      {loading && <p className="dash__note">{t("loading")}</p>}

      {!loading && state.products.length === 0 && (
        <div className="dash__card dash__card--empty">
          <h2>{t("catalogEmpty")}</h2>
          <p>{t("catalogEmptyBody")}</p>
        </div>
      )}

      <ul className="cat__list">
        {state.products.map((product) => (
          <li key={product.id} className="cat__row" data-inactive={product.active ? undefined : "true"}>
            <button type="button" className="cat__open" onClick={() => setEditing(product)}>
              <span className="cat__title" dir="auto">
                {product.title}
              </span>
              <span className="cat__meta">
                {product.sku && <code dir="ltr">{product.sku}</code>}
                <span>{t("stockLeft", { n: count(product.stock, lang) })}</span>
                {!product.active && <span className="cat__hidden">{t("inactive")}</span>}
              </span>
            </button>
            <span className="cat__price" dir="ltr">
              {formatMoney(product.priceCents, shop.currency, lang)}
            </span>
            <button
              type="button"
              className="cat__remove"
              onClick={() => remove(product)}
              aria-label={t("remove")}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <ProductForm
          shop={shop}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}

function ProductForm({ shop, product, onClose, onSaved }) {
  const { t } = useDash();
  const [form, setForm] = useState(() => ({
    title: product.title ?? "",
    sku: product.sku ?? "",
    /* Cents in the database, a decimal in the field: nobody types 6250 for
       $62.50. parseMoney turns it back on the way in. */
    price: product.priceCents === undefined ? "" : String(product.priceCents / 100),
    stock: product.stock === undefined ? "" : String(product.stock),
    active: product.active === undefined ? true : Boolean(product.active),
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (field) => (event) =>
    setForm((prev) => ({
      ...prev,
      [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    /* Validated with the same function the Worker uses, so the field that
       lights up here is the one that would have been rejected there. */
    const found = validateProduct(form);
    setErrors(found);
    if (Object.keys(found).length || busy) return;

    setBusy(true);
    try {
      const path = product.id ? `/api/app/products/${product.id}` : "/api/app/products";
      await post(path, shop.shopId, form);
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError && err.body?.errors ? err.body.errors : { title: "required" });
    } finally {
      setBusy(false);
    }
  };

  const message = (code) =>
    ({ required: "errRequired", number: "errNumber", negative: "errNegative" })[code] ?? "errRequired";

  return (
    <div className="sheet" role="dialog" aria-modal="true">
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label={t("cancel")} />
      <form className="sheet__panel" onSubmit={submit}>
        <h2 className="sheet__formtitle">{product.id ? t("editProduct") : t("addProduct")}</h2>

        <label className="dash__field">
          <span>{t("productTitle")}</span>
          <input value={form.title} onChange={set("title")} maxLength={120} dir="auto" />
          {errors.title && <em className="dash__error">{t(message(errors.title))}</em>}
        </label>

        <div className="dash__pair">
          <label className="dash__field">
            <span>{t("productPrice")}</span>
            <input value={form.price} onChange={set("price")} inputMode="decimal" dir="ltr" />
            {errors.price && <em className="dash__error">{t(message(errors.price))}</em>}
          </label>
          <label className="dash__field">
            <span>{t("productStock")}</span>
            <input value={form.stock} onChange={set("stock")} inputMode="numeric" dir="ltr" />
            {errors.stock && <em className="dash__error">{t(message(errors.stock))}</em>}
          </label>
        </div>

        <label className="dash__field">
          <span>{t("productSku")}</span>
          <input value={form.sku} onChange={set("sku")} maxLength={40} dir="ltr" />
        </label>

        <label className="dash__check">
          <input type="checkbox" checked={form.active} onChange={set("active")} />
          <span>{t("productActive")}</span>
        </label>

        <div className="sheet__actions">
          <button type="submit" className="pill" disabled={busy}>
            {busy ? t("saving") : t("save")}
          </button>
          <button type="button" className="pill pill--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
