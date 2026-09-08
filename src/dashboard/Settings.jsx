import { useCallback, useState } from "react";
import { CURRENCIES } from "../../shared/orderSchema.js";
import { post } from "./api.js";
import { useDash } from "./copy.js";
import { useResource } from "./useResource.js";
import { relativeTime } from "./format.js";

/* Everything about the shop rather than about a day's orders: who can see it,
   what the automation authenticates with, and — while the automation is still
   being built — a way to fill the shop with plausible data so the rest of the
   dashboard can be judged.

   Staff can read this screen. Only an owner can change anything on it, which
   the Worker enforces; the controls are hidden here so nobody is offered a
   button that would come back 403. */

export default function Settings({ shop, user, onChanged }) {
  const { t, lang } = useDash();
  const [reloads, setReloads] = useState(0);
  const { data } = useResource("/api/app/settings", shop.shopId, reloads);
  const refresh = useCallback(() => setReloads((n) => n + 1), []);
  const owner = shop.role === "owner";

  /* Gated on the absence of data, not on `loading`: a refresh after creating a
     token must not unmount this subtree, because the token is held in a
     child's state and is shown exactly once. Re-rendering with the previous
     answer while the next one arrives is also what the rest of the screen
     wants. */
  if (!data) return <p className="dash__note">{t("loading")}</p>;

  return (
    <section className="set">
      <ShopForm shop={shop} settings={data} owner={owner} onSaved={onChanged} />
      <Members shop={shop} settings={data} owner={owner} user={user} onChanged={refresh} />
      <Tokens shop={shop} settings={data} owner={owner} onChanged={refresh} lang={lang} />
      {owner && <Sample shop={shop} />}
    </section>
  );
}

function ShopForm({ shop, settings, owner, onSaved }) {
  const { t } = useDash();
  const [form, setForm] = useState({
    name: settings.shop.name,
    igHandle: settings.shop.igHandle,
    currency: settings.shop.currency,
  });
  const [busy, setBusy] = useState(false);
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await post("/api/app/settings", shop.shopId, form);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="dash__card" onSubmit={submit}>
      <h2>{t("shopSection")}</h2>
      <label className="dash__field">
        <span>{t("shopName")}</span>
        <input value={form.name} onChange={set("name")} disabled={!owner} maxLength={80} dir="auto" />
      </label>
      <div className="dash__pair">
        <label className="dash__field">
          <span>{t("shopHandle")}</span>
          <input
            value={form.igHandle}
            onChange={set("igHandle")}
            disabled={!owner}
            maxLength={40}
            dir="ltr"
          />
        </label>
        <label className="dash__field">
          <span>{t("shopCurrency")}</span>
          <select value={form.currency} onChange={set("currency")} disabled={!owner}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {owner && (
        <button type="submit" className="pill" disabled={busy}>
          {busy ? t("saving") : t("save")}
        </button>
      )}
    </form>
  );
}

function Members({ shop, settings, owner, user, onChanged }) {
  const { t } = useDash();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("staff");
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  const add = async (event) => {
    event.preventDefault();
    if (!userId.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await post("/api/app/members", shop.shopId, { userId, role });
      setUserId("");
      onChanged();
    } catch {
      setProblem("errNetwork");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id) => {
    setProblem(null);
    try {
      await post("/api/app/members/remove", shop.shopId, { userId: id });
      onChanged();
    } catch (err) {
      setProblem(err.code === "last_owner" ? "lastOwner" : "errNetwork");
    }
  };

  return (
    <div className="dash__card">
      <h2>{t("membersSection")}</h2>
      <ul className="set__members">
        {settings.members.map((member) => (
          <li key={member.userId}>
            <span dir="ltr">{member.username ? `@${member.username}` : member.display || member.userId}</span>
            <span className="set__role">{t(member.role === "owner" ? "roleOwner" : "roleStaff")}</span>
            {owner && member.userId !== String(user.id) && (
              <button type="button" className="dash__link" onClick={() => drop(member.userId)}>
                {t("remove")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {problem && <p className="dash__error">{t(problem)}</p>}

      {owner && (
        <form className="set__add" onSubmit={add}>
          <label className="dash__field">
            <span>{t("memberId")}</span>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              inputMode="numeric"
              dir="ltr"
            />
          </label>
          <label className="dash__field">
            <span>{t("memberRole")}</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="staff">{t("roleStaff")}</option>
              <option value="owner">{t("roleOwner")}</option>
            </select>
          </label>
          <button type="submit" className="pill" disabled={busy || !userId.trim()}>
            {t("add")}
          </button>
        </form>
      )}
    </div>
  );
}

function Tokens({ shop, settings, owner, onChanged, lang }) {
  const { t } = useDash();
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const data = await post("/api/app/tokens", shop.shopId, { label });
      /* Held in this component's state and nowhere else. It is not in the
         listing that follows, and reloading the page loses it — which is the
         point: only the hash is stored. */
      setFresh(data.token);
      setCopied(false);
      setLabel("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      /* Clipboard access can be refused; the token is on screen to select. */
    }
  };

  return (
    <div className="dash__card">
      <h2>{t("tokensSection")}</h2>
      <p>{t("tokensBody")}</p>
      <pre className="set__endpoint" dir="ltr">
        POST {typeof window === "undefined" ? "" : window.location.origin}/api/app/ingest{"\n"}
        Authorization: Bearer &lt;token&gt;{"\n"}
        {'{ "orders": [ … ], "events": [ … ] }'}
      </pre>

      {fresh && (
        <div className="set__fresh">
          <code dir="ltr">{fresh}</code>
          <button type="button" className="pill pill--ghost" onClick={copy}>
            {copied ? t("copied") : t("copy")}
          </button>
          <p className="set__once">{t("tokenOnce")}</p>
        </div>
      )}

      <ul className="set__tokens">
        {settings.tokens.map((token) => (
          <li key={token.hash}>
            <code dir="ltr">{token.hash}…</code>
            <span dir="auto">{token.label}</span>
            <span className="set__used">
              {token.lastUsedAt
                ? t("tokenLastUsed", { when: relativeTime(token.lastUsedAt, lang) })
                : t("tokenNever")}
            </span>
            {owner && (
              <button
                type="button"
                className="dash__link"
                onClick={() => post("/api/app/tokens/revoke", shop.shopId, { hash: token.hash }).then(onChanged)}
              >
                {t("tokenRevoke")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {owner && (
        <form className="set__add" onSubmit={create}>
          <label className="dash__field">
            <span>{t("tokenLabel")}</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} dir="auto" />
          </label>
          <button type="submit" className="pill" disabled={busy}>
            {t("tokenCreate")}
          </button>
        </form>
      )}
    </div>
  );
}

function Sample({ shop }) {
  const { t } = useDash();
  const [state, setState] = useState("idle");

  const load = async () => {
    setState("busy");
    try {
      await post("/api/app/demo", shop.shopId);
      setState("done");
    } catch (err) {
      setState(err.code === "shop_not_empty" ? "not_empty" : "failed");
    }
  };

  return (
    <div className="dash__card">
      <h2>{t("sampleSection")}</h2>
      <p>{t("sampleBody")}</p>
      <button type="button" className="pill pill--ghost" onClick={load} disabled={state === "busy"}>
        {state === "busy" ? t("saving") : t("sampleAction")}
      </button>
      {state === "done" && <p className="dash__note">{t("sampleDone")}</p>}
      {state === "not_empty" && <p className="dash__error">{t("errShopNotEmpty")}</p>}
      {state === "failed" && <p className="dash__error">{t("errNetwork")}</p>}
    </div>
  );
}
