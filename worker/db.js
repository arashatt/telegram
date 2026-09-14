/* Every query the dashboard makes, in one place.

   The security property this file exists to hold: **every read and every write
   takes a shop id**, and it comes from the caller's verified membership, never
   from the request body. There is no function here that can return a row
   without being told which shop is asking, so cross-tenant leakage has to be a
   deliberate act rather than a forgotten WHERE clause.

   Money is integer cents and time is epoch milliseconds throughout — see
   shared/orderSchema.js for why. */

import {
  DEFAULT_CURRENCY,
  EARNED_STATUSES,
  LIMITS,
  currencyId,
  eventId,
  handle,
  integer,
  statusId,
  text,
} from "../shared/orderSchema.js";
import { invoiceStatusId } from "../shared/invoiceSchema.js";
import { ensureSchema } from "./schema.js";

export const hasDb = (env) => Boolean(env?.DB?.prepare);

const now = () => Date.now();
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

/* Placeholder lists are built from the array's own length rather than by
   interpolating values, so a bound statement stays a bound statement. */
const marks = (n) => Array.from({ length: n }, () => "?").join(", ");

/* ---- shops and membership ---- */

/* The only lookup keyed by a person rather than a shop, and the one every
   request starts from: which shops may this signed-in user see at all. */
export async function membershipsFor(db, userId) {
  if (!userId) return [];
  const { results } = await db
    .prepare(
      `SELECT m.shop_id AS shopId, m.role, s.name, s.ig_handle AS igHandle,
              s.currency, s.timezone
         FROM shop_members m
         JOIN shops s ON s.id = m.shop_id
        WHERE m.user_id = ?
        ORDER BY s.name`
    )
    .bind(String(userId))
    .all();
  return results ?? [];
}

/* Members are added by Telegram id, which is all the studio has before the
   person has ever signed in — so their row says "111" until they do. This
   fills in the name from their own session the first time they open the
   dashboard, and only when it would actually change something. */
export async function refreshMemberIdentity(db, user) {
  const username = text(user?.username, 64);
  const display = text([user?.firstName, user?.lastName].filter(Boolean).join(" "), 80);
  if (!user?.id || (!username && !display)) return;
  await db
    .prepare(
      `UPDATE shop_members SET username = ?, display = ?
        WHERE user_id = ? AND (username <> ? OR display <> ?)`
    )
    .bind(username, display, String(user.id), username, display)
    .run();
}

export async function membership(db, shopId, userId) {
  if (!shopId || !userId) return null;
  return db
    .prepare(`SELECT shop_id AS shopId, role FROM shop_members WHERE shop_id = ? AND user_id = ?`)
    .bind(shopId, String(userId))
    .first();
}

export async function createShop(db, input) {
  const id = newId("shop");
  const at = now();
  await db
    .prepare(
      `INSERT INTO shops (id, name, ig_handle, currency, timezone, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      text(input?.name, LIMITS.shopName) || "Untitled shop",
      handle(input?.igHandle),
      currencyId(input?.currency),
      text(input?.timezone, 60) || "UTC",
      at
    )
    .run();
  return getShop(db, id);
}

export async function getShop(db, shopId) {
  if (!shopId) return null;
  return db
    .prepare(
      `SELECT id, name, ig_handle AS igHandle, currency, timezone, created_at AS createdAt
         FROM shops WHERE id = ?`
    )
    .bind(shopId)
    .first();
}

export async function updateShop(db, shopId, patch) {
  const shop = await getShop(db, shopId);
  if (!shop) return null;
  await db
    .prepare(`UPDATE shops SET name = ?, ig_handle = ?, currency = ?, timezone = ? WHERE id = ?`)
    .bind(
      text(patch?.name, LIMITS.shopName) || shop.name,
      patch?.igHandle === undefined ? shop.igHandle : handle(patch.igHandle),
      patch?.currency === undefined ? shop.currency : currencyId(patch.currency),
      text(patch?.timezone, 60) || shop.timezone,
      shopId
    )
    .run();
  return getShop(db, shopId);
}

export async function listMembers(db, shopId) {
  const { results } = await db
    .prepare(
      `SELECT user_id AS userId, role, username, display, created_at AS createdAt
         FROM shop_members WHERE shop_id = ? ORDER BY created_at`
    )
    .bind(shopId)
    .all();
  return results ?? [];
}

/* Upsert rather than insert: adding somebody who is already a member is a
   role change, not an error, and their display name is refreshed from
   whatever the sign-in last reported. */
export async function addMember(db, shopId, user, role = "staff") {
  const at = now();
  await db
    .prepare(
      `INSERT INTO shop_members (shop_id, user_id, role, username, display, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (shop_id, user_id) DO UPDATE SET
         role = excluded.role,
         username = CASE WHEN excluded.username <> '' THEN excluded.username ELSE shop_members.username END,
         display = CASE WHEN excluded.display <> '' THEN excluded.display ELSE shop_members.display END`
    )
    .bind(
      shopId,
      String(user?.id ?? ""),
      role === "owner" ? "owner" : "staff",
      text(user?.username, 64),
      text(user?.display ?? user?.firstName, 80),
      at
    )
    .run();
  return membership(db, shopId, user?.id);
}

/* A shop with no owner is a shop nobody can administer, so the last one
   cannot be removed. Reported rather than thrown: the caller turns it into a
   422 with a message. */
export async function removeMember(db, shopId, userId) {
  const target = await membership(db, shopId, userId);
  if (!target) return { removed: false, reason: "not_a_member" };
  if (target.role === "owner") {
    const row = await db
      .prepare(`SELECT COUNT(*) AS n FROM shop_members WHERE shop_id = ? AND role = 'owner'`)
      .bind(shopId)
      .first();
    if ((row?.n ?? 0) <= 1) return { removed: false, reason: "last_owner" };
  }
  await db
    .prepare(`DELETE FROM shop_members WHERE shop_id = ? AND user_id = ?`)
    .bind(shopId, String(userId))
    .run();
  return { removed: true };
}

/* ---- ingest tokens ----

   Only the hash is stored. A leaked database row must not be usable as a
   credential, which also means the token can be shown exactly once, at the
   moment it is created. */

const encoder = new TextEncoder();

export async function hashToken(raw) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(raw)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createToken(db, shopId, label) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = "sk_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db
    .prepare(
      `INSERT INTO shop_tokens (token_hash, shop_id, label, created_at) VALUES (?, ?, ?, ?)`
    )
    .bind(await hashToken(raw), shopId, text(label, LIMITS.label), now())
    .run();
  return raw;
}

export async function listTokens(db, shopId) {
  const { results } = await db
    .prepare(
      `SELECT token_hash AS hash, label, created_at AS createdAt, last_used_at AS lastUsedAt
         FROM shop_tokens WHERE shop_id = ? ORDER BY created_at DESC`
    )
    .bind(shopId)
    .all();
  /* Never the whole hash: it is not a secret, but it is also not something a
     dashboard needs, and a prefix is enough to tell two tokens apart. */
  return (results ?? []).map((row) => ({ ...row, hash: row.hash.slice(0, 8) }));
}

export async function revokeToken(db, shopId, hashPrefix) {
  const prefix = String(hashPrefix ?? "").replace(/[^0-9a-f]/g, "").slice(0, 64);
  if (prefix.length < 8) return { revoked: false };
  const result = await db
    .prepare(`DELETE FROM shop_tokens WHERE shop_id = ? AND token_hash LIKE ?`)
    .bind(shopId, `${prefix}%`)
    .run();
  return { revoked: (result?.meta?.changes ?? 0) > 0 };
}

/* Resolves a bearer token to the shop it belongs to. The lookup is by hash, so
   a timing difference here reveals nothing a hash lookup would not. */
export async function shopForToken(db, raw) {
  if (typeof raw !== "string" || raw.length < 16) return null;
  const hash = await hashToken(raw);
  const row = await db
    .prepare(`SELECT shop_id AS shopId FROM shop_tokens WHERE token_hash = ?`)
    .bind(hash)
    .first();
  if (!row) return null;
  await db
    .prepare(`UPDATE shop_tokens SET last_used_at = ? WHERE token_hash = ?`)
    .bind(now(), hash)
    .run();
  return row.shopId;
}

/* ---- catalog ---- */

export async function listProducts(db, shopId, { includeInactive = true } = {}) {
  const { results } = await db
    .prepare(
      `SELECT id, sku, title, price_cents AS priceCents, stock, active,
              created_at AS createdAt, updated_at AS updatedAt
         FROM products
        WHERE shop_id = ? ${includeInactive ? "" : "AND active = 1"}
        ORDER BY active DESC, title`
    )
    .bind(shopId)
    .all();
  return results ?? [];
}

export async function getProduct(db, shopId, id) {
  return db
    .prepare(
      `SELECT id, sku, title, price_cents AS priceCents, stock, active
         FROM products WHERE shop_id = ? AND id = ?`
    )
    .bind(shopId, String(id ?? ""))
    .first();
}

export async function findProductBySku(db, shopId, sku) {
  const clean = text(sku, LIMITS.sku);
  if (!clean) return null;
  return db
    .prepare(`SELECT id, title, price_cents AS priceCents FROM products WHERE shop_id = ? AND sku = ?`)
    .bind(shopId, clean)
    .first();
}

export async function createProduct(db, shopId, input) {
  const id = newId("prod");
  const at = now();
  await db
    .prepare(
      `INSERT INTO products (id, shop_id, sku, title, price_cents, stock, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      shopId,
      text(input.sku, LIMITS.sku),
      text(input.title, LIMITS.title),
      integer(input.priceCents, { min: 0 }),
      integer(input.stock, { min: 0 }),
      input.active === false ? 0 : 1,
      at,
      at
    )
    .run();
  return getProduct(db, shopId, id);
}

export async function updateProduct(db, shopId, id, input) {
  const existing = await getProduct(db, shopId, id);
  if (!existing) return null;
  await db
    .prepare(
      `UPDATE products SET sku = ?, title = ?, price_cents = ?, stock = ?, active = ?, updated_at = ?
        WHERE shop_id = ? AND id = ?`
    )
    .bind(
      input.sku === undefined ? existing.sku : text(input.sku, LIMITS.sku),
      input.title === undefined ? existing.title : text(input.title, LIMITS.title),
      input.priceCents === undefined ? existing.priceCents : integer(input.priceCents, { min: 0 }),
      input.stock === undefined ? existing.stock : integer(input.stock, { min: 0 }),
      input.active === undefined ? existing.active : input.active ? 1 : 0,
      now(),
      shopId,
      existing.id
    )
    .run();
  return getProduct(db, shopId, existing.id);
}

/* Kept rather than deleted when it has ever been sold: an order line points at
   it, and the report's "top products" would lose its name. Deactivating is
   what the dashboard offers; this is only for a product nothing refers to. */
export async function deleteProduct(db, shopId, id) {
  const existing = await getProduct(db, shopId, id);
  if (!existing) return { deleted: false, reason: "not_found" };
  const used = await db
    .prepare(`SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?`)
    .bind(existing.id)
    .first();
  if ((used?.n ?? 0) > 0) return { deleted: false, reason: "has_orders" };
  await db.prepare(`DELETE FROM products WHERE shop_id = ? AND id = ?`).bind(shopId, existing.id).run();
  return { deleted: true };
}

/* ---- orders ---- */

export async function listOrders(db, shopId, { status, limit = 30, before } = {}) {
  const size = integer(limit, { min: 1, max: 100 });
  const clauses = ["shop_id = ?"];
  const values = [shopId];
  if (status && statusId(status) === status) {
    clauses.push("status = ?");
    values.push(status);
  }
  if (before) {
    clauses.push("created_at < ?");
    values.push(integer(before, { min: 0 }));
  }
  const { results } = await db
    .prepare(
      `SELECT id, ref, customer, status, total_cents AS totalCents, currency,
              source_post AS sourcePost, keyword, created_at AS createdAt, updated_at AS updatedAt
         FROM orders
        WHERE ${clauses.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ?`
    )
    .bind(...values, size + 1)
    .all();

  const rows = results ?? [];
  const page = rows.slice(0, size);
  return {
    orders: page,
    /* The cursor is the last row's timestamp rather than an offset, so a new
       order arriving mid-scroll cannot make a page repeat itself. */
    cursor: rows.length > size ? page[page.length - 1].createdAt : null,
  };
}

export async function getOrder(db, shopId, id) {
  const order = await db
    .prepare(
      `SELECT id, ref, customer, status, total_cents AS totalCents, currency,
              source_post AS sourcePost, keyword, note,
              created_at AS createdAt, updated_at AS updatedAt
         FROM orders WHERE shop_id = ? AND id = ?`
    )
    .bind(shopId, String(id ?? ""))
    .first();
  if (!order) return null;

  const { results } = await db
    .prepare(
      `SELECT id, product_id AS productId, title, qty, unit_price_cents AS unitPriceCents
         FROM order_items WHERE order_id = ? ORDER BY rowid`
    )
    .bind(order.id)
    .all();

  /* The conversation this order came out of, newest last, so the detail view
     can show what was actually said. */
  const events = await db
    .prepare(
      `SELECT type, at, keyword, payload FROM events
        WHERE shop_id = ? AND (order_id = ? OR (customer <> '' AND customer = ?))
        ORDER BY at DESC LIMIT 40`
    )
    .bind(shopId, order.id, order.customer)
    .all();

  return { ...order, items: results ?? [], events: (events.results ?? []).reverse() };
}

export async function setOrderStatus(db, shopId, id, status) {
  const next = statusId(status);
  const result = await db
    .prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE shop_id = ? AND id = ?`)
    .bind(next, now(), shopId, String(id ?? ""))
    .run();
  if ((result?.meta?.changes ?? 0) === 0) return null;
  return getOrder(db, shopId, id);
}

export async function orderCounts(db, shopId) {
  const { results } = await db
    .prepare(`SELECT status, COUNT(*) AS n FROM orders WHERE shop_id = ? GROUP BY status`)
    .bind(shopId)
    .all();
  const counts = {};
  for (const row of results ?? []) counts[row.status] = row.n;
  return counts;
}

/* The automation's write path, and the one that has to be idempotent: a
   retried delivery must update the order it already created rather than make a
   second one. `ref` is the shop's own identifier for the order and is unique
   per shop, which is what makes that possible. */
export async function upsertOrder(db, shopId, input, currency) {
  const at = now();
  const ref = input.ref || `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const existing = await db
    .prepare(`SELECT id FROM orders WHERE shop_id = ? AND ref = ?`)
    .bind(shopId, ref)
    .first();

  const id = existing?.id ?? newId("ord");

  /* Resolved before anything is written, because the order's total depends on
     it: a line that names a SKU and no price is worth what the catalog says,
     and until that lookup has happened the order has no total. */
  const lines = [];
  for (const item of input.items) {
    const match = item.sku ? await findProductBySku(db, shopId, item.sku) : null;
    lines.push({
      productId: match?.id ?? null,
      title: item.title || match?.title || item.sku,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents || match?.priceCents || 0,
    });
  }

  const totalCents =
    input.declaredTotalCents === null || input.declaredTotalCents === undefined
      ? lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0)
      : input.declaredTotalCents;

  const statements = [];

  if (existing) {
    statements.push(
      db
        .prepare(
          `UPDATE orders SET customer = ?, status = ?, total_cents = ?, currency = ?,
                  source_post = ?, keyword = ?, note = ?, updated_at = ?
            WHERE shop_id = ? AND id = ?`
        )
        .bind(
          input.customer,
          input.status,
          totalCents,
          currencyId(currency),
          input.sourcePost,
          input.keyword,
          input.note,
          at,
          shopId,
          id
        )
    );
    statements.push(db.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(id));
  } else {
    statements.push(
      db
        .prepare(
          `INSERT INTO orders (id, shop_id, ref, customer, status, total_cents, currency,
                               source_post, keyword, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          shopId,
          ref,
          input.customer,
          input.status,
          totalCents,
          currencyId(currency),
          input.sourcePost,
          input.keyword,
          input.note,
          at,
          at
        )
    );
  }

  for (const line of lines) {
    statements.push(
      db
        .prepare(
          `INSERT INTO order_items (id, order_id, product_id, title, qty, unit_price_cents)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(newId("item"), id, line.productId, line.title, line.qty, line.unitPriceCents)
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO events (id, shop_id, type, customer, order_id, source_post, keyword, at, payload)
         VALUES (?, ?, 'order', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId("evt"),
        shopId,
        input.customer,
        id,
        input.sourcePost,
        input.keyword,
        at,
        JSON.stringify({ ref, totalCents, replaced: Boolean(existing) })
      )
  );

  /* One batch, so a half-written order with no lines is not a state this
     database can be left in. */
  await db.batch(statements);
  return { id, ref, created: !existing };
}

/* ---- events ---- */

export async function recordEvent(db, shopId, input) {
  const type = eventId(input?.type);
  if (!type) return null;
  const id = newId("evt");
  const at = integer(input?.at ?? now(), { min: 0 }) || now();
  const payload = JSON.stringify(input?.payload ?? {}).slice(0, LIMITS.payload);
  await db
    .prepare(
      `INSERT INTO events (id, shop_id, type, customer, order_id, source_post, keyword, at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      shopId,
      type,
      handle(input?.customer),
      input?.orderId ? String(input.orderId) : null,
      text(input?.post ?? input?.sourcePost, LIMITS.sourcePost),
      text(input?.keyword, LIMITS.keyword),
      at,
      payload
    )
    .run();
  return { id, type, at };
}

export async function listEvents(db, shopId, { limit = 50, before } = {}) {
  const size = integer(limit, { min: 1, max: 200 });
  const { results } = await db
    .prepare(
      `SELECT id, type, customer, order_id AS orderId, source_post AS sourcePost,
              keyword, at, payload
         FROM events
        WHERE shop_id = ? ${before ? "AND at < ?" : ""}
        ORDER BY at DESC LIMIT ?`
    )
    .bind(...(before ? [shopId, integer(before, { min: 0 }), size] : [shopId, size]))
    .all();
  return results ?? [];
}

/* ---- the weekly report ----

   "A weekly report — revenue, top products, reply times" is a promise on the
   Instagram page, so each of those three is computed from stored rows rather
   than estimated.

   Revenue counts only orders that reached a status where money actually
   arrived: a cancelled order is not revenue and a brand new one is not yet. */

const EARNED_MARKS = marks(EARNED_STATUSES.length);

async function windowTotals(db, shopId, from, to) {
  const totals = await db
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN status IN (${EARNED_MARKS}) THEN total_cents ELSE 0 END), 0) AS revenue,
              COUNT(DISTINCT customer) AS customers
         FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at < ?`
    )
    .bind(...EARNED_STATUSES, shopId, from, to)
    .first();
  return {
    orders: totals?.orders ?? 0,
    revenueCents: totals?.revenue ?? 0,
    customers: totals?.customers ?? 0,
  };
}

/* Median rather than mean: one holiday weekend where nobody answered for two
   days would otherwise swallow a week of two-minute replies.

   A message only starts a wait if the previous thing in that thread was not
   also an inbound message — three messages in a row from one person is one
   wait, not three. */
async function replyTimes(db, shopId, from, to) {
  const { results } = await db
    .prepare(
      `SELECT (
                SELECT MIN(o.at) FROM events o
                 WHERE o.shop_id = i.shop_id AND o.customer = i.customer
                   AND o.type = 'dm_out' AND o.at > i.at
              ) - i.at AS delta
         FROM events i
        WHERE i.shop_id = ? AND i.type = 'dm_in' AND i.customer <> ''
          AND i.at >= ? AND i.at < ?
          AND (
                SELECT p.type FROM events p
                 WHERE p.shop_id = i.shop_id AND p.customer = i.customer
                   AND p.type IN ('dm_in', 'dm_out') AND p.at < i.at
                 ORDER BY p.at DESC LIMIT 1
              ) IS NOT 'dm_in'`
    )
    .bind(shopId, from, to)
    .all();

  const deltas = (results ?? [])
    .map((row) => row.delta)
    .filter((d) => typeof d === "number" && d >= 0)
    .sort((a, b) => a - b);

  if (deltas.length === 0) return { medianMs: null, answered: 0, waiting: 0 };

  const mid = Math.floor(deltas.length / 2);
  const medianMs =
    deltas.length % 2 ? deltas[mid] : Math.round((deltas[mid - 1] + deltas[mid]) / 2);

  const waiting = (results ?? []).filter((row) => row.delta === null).length;
  return { medianMs, answered: deltas.length, waiting };
}

export async function weeklyReport(db, shopId, { at = now(), days = 7 } = {}) {
  const span = days * 24 * 60 * 60 * 1000;
  const to = at;
  const from = to - span;
  const prevFrom = from - span;

  const [current, previous, top, posts, replies, counts, shop] = await Promise.all([
    windowTotals(db, shopId, from, to),
    windowTotals(db, shopId, prevFrom, from),
    db
      .prepare(
        `SELECT i.title,
                SUM(i.qty) AS units,
                SUM(i.qty * i.unit_price_cents) AS revenue
           FROM order_items i
           JOIN orders o ON o.id = i.order_id
          WHERE o.shop_id = ? AND o.created_at >= ? AND o.created_at < ?
            AND o.status IN (${EARNED_MARKS})
          GROUP BY i.title
          ORDER BY revenue DESC, units DESC
          LIMIT 5`
      )
      .bind(shopId, from, to, ...EARNED_STATUSES)
      .all(),
    /* Which post sold, not which post was liked — the claim demoPoint3 makes
       on the Instagram page. */
    db
      .prepare(
        `SELECT source_post AS post, COUNT(*) AS orders,
                COALESCE(SUM(CASE WHEN status IN (${EARNED_MARKS}) THEN total_cents ELSE 0 END), 0) AS revenue
           FROM orders
          WHERE shop_id = ? AND created_at >= ? AND created_at < ? AND source_post <> ''
          GROUP BY source_post
          ORDER BY revenue DESC, orders DESC
          LIMIT 5`
      )
      .bind(...EARNED_STATUSES, shopId, from, to)
      .all(),
    replyTimes(db, shopId, from, to),
    orderCounts(db, shopId),
    getShop(db, shopId),
  ]);

  return {
    from,
    to,
    days,
    currency: shop?.currency ?? DEFAULT_CURRENCY,
    current,
    previous,
    topProducts: top.results ?? [],
    topPosts: posts.results ?? [],
    replies,
    statusCounts: counts,
  };
}

/* ---- submitted briefs ----

   Not shop-scoped, unlike everything above: a brief is an enquiry addressed to
   the studio, not a row belonging to one of its clients' shops. Only the
   studio's own accounts — ADMIN_TELEGRAM_IDS — can read these, which
   worker/app.js enforces before any of them is called. */

export async function storeBrief(db, submission) {
  const id = newId("brief");
  const at = now();
  const form = submission?.form ?? {};
  const contact = [form.contactName, form.email, form.telegram, form.phone]
    .filter(Boolean)
    .join(" · ");

  await db
    .prepare(
      `INSERT INTO briefs (id, reference, platform, lang, bot_name, summary, contact,
                           payload, delivered_at, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)
       ON CONFLICT (reference) DO NOTHING`
    )
    .bind(
      id,
      String(submission?.reference ?? id),
      String(submission?.platform ?? "telegram"),
      String(submission?.lang ?? "en"),
      text(form.botName, LIMITS.title),
      text(form.summary, 500),
      text(contact, 300),
      /* The whole submission as it was assembled, so a retry sends what was
         originally meant rather than something rebuilt from columns. */
      JSON.stringify(submission),
      at
    )
    .run();

  return { id, at };
}

export async function markBriefDelivered(db, reference) {
  await db
    .prepare(`UPDATE briefs SET delivered_at = ?, last_error = '' WHERE reference = ?`)
    .bind(now(), String(reference))
    .run();
}

export async function markBriefFailed(db, reference, message) {
  await db
    .prepare(
      `UPDATE briefs SET attempts = attempts + 1, last_error = ? WHERE reference = ?`
    )
    .bind(text(message, 300), String(reference))
    .run();
}

export async function listBriefs(db, { limit = 30, before, undelivered = false } = {}) {
  const size = integer(limit, { min: 1, max: 100 });
  const clauses = [];
  const values = [];
  if (undelivered) clauses.push("delivered_at IS NULL");
  if (before) {
    clauses.push("created_at < ?");
    values.push(integer(before, { min: 0 }));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await db
    .prepare(
      `SELECT id, reference, platform, lang, bot_name AS botName, summary, contact,
              delivered_at AS deliveredAt, attempts, last_error AS lastError,
              created_at AS createdAt
         FROM briefs ${where}
        ORDER BY created_at DESC
        LIMIT ?`
    )
    .bind(...values, size + 1)
    .all();

  const rows = results ?? [];
  const page = rows.slice(0, size);
  return {
    briefs: page,
    cursor: rows.length > size ? page[page.length - 1].createdAt : null,
  };
}

/* The stored submission, parsed back into the shape deliverBrief expects. */
export async function briefPayload(db, reference) {
  const row = await db
    .prepare(`SELECT payload FROM briefs WHERE reference = ?`)
    .bind(String(reference))
    .first();
  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export async function briefCounts(db) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END) AS undelivered
         FROM briefs`
    )
    .first();
  return { total: row?.total ?? 0, undelivered: row?.undelivered ?? 0 };
}

/* ---- customers ----

   A brief on its own is an anonymous row. A customer is the identity those rows
   hang on, which is what makes "what has this person ordered before?" a
   question with an answer.

   Not shop-scoped: these are the studio's clients, not a shop's shoppers, and
   worker/app.js gates them on ADMIN_TELEGRAM_IDS rather than on membership. */

const lowerEmail = (value) => text(value, 160).toLowerCase();

const CUSTOMER_COLUMNS = `id, subject, name, email, telegram, phone, lang, note,
                          created_at AS createdAt, updated_at AS updatedAt`;

export async function getCustomer(db, id) {
  if (!id) return null;
  return db.prepare(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ?`).bind(String(id)).first();
}

export async function customerBySubject(db, subject) {
  if (!subject) return null;
  return db
    .prepare(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE subject = ?`)
    .bind(String(subject))
    .first();
}

/* Fills gaps, never overwrites. A later brief that arrives with a blank name
   must not erase the name an earlier one gave, and a *different* email must not
   silently replace the one this customer was matched on — that would move the
   identity out from under the rows already attached to it. */
async function fillCustomerGaps(db, customer, fields) {
  const patch = {
    name: customer.name || text(fields.name, LIMITS.customer),
    email: customer.email || lowerEmail(fields.email),
    telegram: customer.telegram || handle(fields.telegram),
    phone: customer.phone || text(fields.phone, 40),
    lang: fields.lang === "fa" || fields.lang === "en" ? fields.lang : customer.lang,
  };
  const changed = Object.entries(patch).some(([key, value]) => value !== customer[key]);
  if (!changed) return customer;

  await db
    .prepare(
      `UPDATE customers SET name = ?, email = ?, telegram = ?, phone = ?, lang = ?, updated_at = ?
        WHERE id = ?`
    )
    .bind(patch.name, patch.email, patch.telegram, patch.phone, patch.lang, now(), customer.id)
    .run();
  return { ...customer, ...patch };
}

async function createCustomer(db, { subject, name, email, telegram, phone, lang }) {
  const id = newId("cust");
  const at = now();
  await db
    .prepare(
      `INSERT INTO customers (id, subject, name, email, telegram, phone, lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      subject || null,
      text(name, LIMITS.customer),
      lowerEmail(email),
      handle(telegram),
      text(phone, 40),
      lang === "fa" ? "fa" : "en",
      at,
      at
    )
    .run();
  return getCustomer(db, id);
}

async function anonymousMatch(db, email, telegram) {
  if (email) {
    const byEmail = await db
      .prepare(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE email = ? ORDER BY created_at LIMIT 1`)
      .bind(email)
      .first();
    if (byEmail) return byEmail;
  }
  if (telegram) {
    return db
      .prepare(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE telegram = ? ORDER BY created_at LIMIT 1`)
      .bind(telegram)
      .first();
  }
  return null;
}

/* Which customer a submitted brief belongs to, in four steps:

     1. the OIDC subject, when they were signed in — the only identifier here
        that somebody had to prove;
     2. the email they typed;
     3. the Telegram handle they typed;
     4. otherwise a customer who did not exist until now.

   A signed-in person whose email or handle matches an earlier anonymous row
   adopts it, which is what makes a purchase history survive somebody briefing
   once without signing in and once with. */
export async function resolveCustomer(db, submission) {
  const form = submission?.form ?? {};
  const subject = String(submission?.verified?.id ?? "");
  const fields = {
    name: form.contactName,
    email: form.email,
    telegram: form.telegram,
    phone: form.phone,
    lang: submission?.lang,
  };
  const email = lowerEmail(form.email);
  const telegram = handle(form.telegram);

  if (subject) {
    const known = await customerBySubject(db, subject);
    if (known) return fillCustomerGaps(db, known, fields);

    const orphan = await anonymousMatch(db, email, telegram);
    if (orphan && !orphan.subject) {
      await db
        .prepare(`UPDATE customers SET subject = ?, updated_at = ? WHERE id = ? AND subject IS NULL`)
        .bind(subject, now(), orphan.id)
        .run();
      return fillCustomerGaps(db, { ...orphan, subject }, fields);
    }
    return createCustomer(db, { subject, ...fields });
  }

  const existing = await anonymousMatch(db, email, telegram);
  if (existing) return fillCustomerGaps(db, existing, fields);
  return createCustomer(db, { subject: "", ...fields });
}

/* The signed-in person's own customer row, adopting an earlier anonymous one
   when the Telegram handle lines up. Their email is not in the sign-in claims,
   so the handle is the only key available here. */
export async function customerForUser(db, user) {
  const subject = String(user?.id ?? "");
  if (!subject) return null;

  const known = await customerBySubject(db, subject);
  if (known) return known;

  const telegram = handle(user?.username);
  const orphan = telegram ? await anonymousMatch(db, "", telegram) : null;
  if (orphan && !orphan.subject) {
    await db
      .prepare(`UPDATE customers SET subject = ?, updated_at = ? WHERE id = ? AND subject IS NULL`)
      .bind(subject, now(), orphan.id)
      .run();
    return { ...orphan, subject };
  }

  return createCustomer(db, {
    subject,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    email: "",
    telegram,
    phone: user?.phone ?? "",
    lang: "en",
  });
}

/* Paid totals, grouped by currency and never added across them. A customer
   with a dollar invoice and a rial one has two totals, not one meaningless
   number. */
async function paidTotals(db, ids) {
  if (ids.length === 0) return {};
  const { results } = await db
    .prepare(
      `SELECT customer_id AS customerId, currency, SUM(amount_cents) AS cents
         FROM invoices
        WHERE status = 'paid' AND customer_id IN (${marks(ids.length)})
        GROUP BY customer_id, currency`
    )
    .bind(...ids)
    .all();

  const totals = {};
  for (const row of results ?? []) {
    (totals[row.customerId] ??= []).push({ currency: row.currency, cents: row.cents });
  }
  return totals;
}

export async function listCustomers(db, { limit = 30, before, query } = {}) {
  const size = integer(limit, { min: 1, max: 100 });
  const clauses = [];
  const values = [];

  const search = text(query, 80).toLowerCase();
  if (search) {
    clauses.push("(lower(c.name) LIKE ? OR c.email LIKE ? OR c.telegram LIKE ?)");
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const having = before ? "HAVING lastAt < ?" : "";
  if (before) values.push(integer(before, { min: 0 }));

  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, c.email, c.telegram, c.lang, c.subject IS NOT NULL AS signedIn,
              c.created_at AS createdAt,
              (SELECT COUNT(*) FROM briefs b WHERE b.customer_id = c.id) AS briefs,
              (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) AS invoices,
              (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'sent') AS awaiting,
              MAX(
                c.created_at,
                COALESCE((SELECT MAX(b.created_at) FROM briefs b WHERE b.customer_id = c.id), 0),
                COALESCE((SELECT MAX(i.created_at) FROM invoices i WHERE i.customer_id = c.id), 0)
              ) AS lastAt
         FROM customers c
         ${where}
         ${having}
         ORDER BY lastAt DESC
         LIMIT ?`
    )
    .bind(...values, size + 1)
    .all();

  const rows = results ?? [];
  const page = rows.slice(0, size);
  const totals = await paidTotals(db, page.map((row) => row.id));

  return {
    customers: page.map((row) => ({ ...row, paid: totals[row.id] ?? [] })),
    cursor: rows.length > size ? page[page.length - 1].lastAt : null,
  };
}

export async function briefsForCustomer(db, customerId) {
  const { results } = await db
    .prepare(
      `SELECT id, reference, platform, lang, bot_name AS botName, summary,
              delivered_at AS deliveredAt, created_at AS createdAt
         FROM briefs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .bind(String(customerId))
    .all();
  return results ?? [];
}

/* ---- invoices ---- */

/* Takes an alias because one of these queries joins `payments`, which has an
   `id`, a `currency`, a `status` and a `created_at` of its own — unqualified,
   SQLite refuses the statement as ambiguous rather than guessing.

   `token` is never in this list. It is the capability in a payment link and is
   selected explicitly, in the two places that have a reason to. */
const invoiceColumns = (alias = "") => {
  const q = alias ? `${alias}.` : "";
  return `${q}id, ${q}reference, ${q}customer_id AS customerId, ${q}brief_id AS briefId,
          ${q}title, ${q}description, ${q}amount_cents AS amountCents, ${q}currency, ${q}status,
          ${q}due_at AS dueAt, ${q}paid_at AS paidAt,
          ${q}created_at AS createdAt, ${q}updated_at AS updatedAt`;
};

const INVOICE_COLUMNS = invoiceColumns();

/* `withToken` is for one caller: the customer reading their *own* invoices at
   /api/app/mine, who needs the link to pay them. Every other reader gets the
   invoice without it. */
export async function invoicesForCustomer(db, customerId, { withToken = false } = {}) {
  const { results } = await db
    .prepare(
      `SELECT ${INVOICE_COLUMNS}${withToken ? ", token" : ""}
         FROM invoices WHERE customer_id = ? ORDER BY created_at DESC`
    )
    .bind(String(customerId))
    .all();
  return results ?? [];
}

export async function customerDetail(db, id) {
  const customer = await getCustomer(db, id);
  if (!customer) return null;
  const [briefs, invoices] = await Promise.all([
    briefsForCustomer(db, id),
    invoicesForCustomer(db, id),
  ]);
  return { customer, briefs, invoices };
}

export async function listInvoices(db, { status, limit = 30, before } = {}) {
  const size = integer(limit, { min: 1, max: 100 });
  const clauses = [];
  const values = [];
  if (invoiceStatusId(status) === status && status) {
    clauses.push("i.status = ?");
    values.push(status);
  }
  if (before) {
    clauses.push("i.created_at < ?");
    values.push(integer(before, { min: 0 }));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await db
    .prepare(
      `SELECT i.id, i.reference, i.customer_id AS customerId, i.title,
              i.amount_cents AS amountCents, i.currency, i.status,
              i.paid_at AS paidAt, i.created_at AS createdAt,
              c.name AS customerName, c.email AS customerEmail, c.telegram AS customerTelegram
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         ${where}
         ORDER BY i.created_at DESC
         LIMIT ?`
    )
    .bind(...values, size + 1)
    .all();

  const rows = results ?? [];
  const page = rows.slice(0, size);
  return { invoices: page, cursor: rows.length > size ? page[page.length - 1].createdAt : null };
}

/* `withToken` for the studio reading an invoice it raised: it needs the link to
   send to the customer, and the link is the token. Never set from a route that
   answers anybody else. */
export async function getInvoiceByReference(db, reference, { withToken = false } = {}) {
  return db
    .prepare(`SELECT ${INVOICE_COLUMNS}${withToken ? ", token" : ""} FROM invoices WHERE reference = ?`)
    .bind(text(reference, 32))
    .first();
}

/* The token is the whole authorisation for a payment link, so it is looked up
   and never listed, never logged, and never returned to anybody. */
export async function getInvoiceByToken(db, token) {
  const clean = String(token ?? "").replace(/[^0-9a-f]/g, "");
  if (clean.length !== 64) return null;
  return db
    .prepare(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE token = ?`)
    .bind(clean)
    .first();
}

export async function createInvoice(db, input) {
  const id = newId("inv");
  const at = now();
  const reference = `INV-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

  await db
    .prepare(
      `INSERT INTO invoices (id, reference, token, customer_id, brief_id, title, description,
                             amount_cents, currency, status, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      reference,
      token,
      String(input.customerId),
      input.briefId ? String(input.briefId) : null,
      text(input.title, 120),
      text(input.description, 1000),
      integer(input.amountCents, { min: 0 }),
      currencyId(input.currency),
      invoiceStatusId(input.status),
      input.dueAt ? integer(input.dueAt, { min: 0 }) : null,
      at,
      at
    )
    .run();

  /* The only moment the token leaves the database. The caller turns it into a
     link and it is never readable again. */
  return { ...(await getInvoiceByReference(db, reference)), token };
}

export async function updateInvoice(db, reference, patch) {
  const existing = await getInvoiceByReference(db, reference);
  if (!existing) return null;
  /* A paid invoice is a record of something that happened. Its amount and what
     it was for stop being editable the moment money arrives. */
  const locked = existing.status === "paid";

  await db
    .prepare(
      `UPDATE invoices SET title = ?, description = ?, amount_cents = ?, currency = ?,
              status = ?, due_at = ?, updated_at = ?
        WHERE reference = ?`
    )
    .bind(
      locked || patch.title === undefined ? existing.title : text(patch.title, 120),
      locked || patch.description === undefined ? existing.description : text(patch.description, 1000),
      locked || patch.amountCents === undefined ? existing.amountCents : integer(patch.amountCents, { min: 0 }),
      locked || patch.currency === undefined ? existing.currency : currencyId(patch.currency),
      patch.status === undefined ? existing.status : invoiceStatusId(patch.status),
      patch.dueAt === undefined ? existing.dueAt : patch.dueAt && integer(patch.dueAt, { min: 0 }),
      now(),
      existing.reference
    )
    .run();
  return getInvoiceByReference(db, existing.reference);
}

/* ---- payments ----

   One row per attempt. The unique index on (gateway, gateway_ref) is what makes
   a replayed webhook or a double-tapped callback settle an invoice once. */

export async function startPaymentRecord(db, invoice, gateway, gatewayRef) {
  const ref = text(gatewayRef, 120);
  /* A payment with no reference from the gateway cannot be settled later and
     must not be written: the unique index that makes settling idempotent skips
     empty references, so a row like this would be a duplicate waiting to
     happen rather than a payment. */
  if (!ref) return { id: null, gatewayRef: "" };

  const id = newId("pay");
  await db
    .prepare(
      `INSERT INTO payments (id, invoice_id, gateway, gateway_ref, amount_cents, currency,
                             status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'started', ?)
       /* The WHERE has to be repeated here. SQLite matches an ON CONFLICT
          target against a *partial* index only when the predicate matches
          too, and without it the statement is rejected outright. */
       ON CONFLICT (gateway, gateway_ref) WHERE gateway_ref <> '' DO NOTHING`
    )
    .bind(id, invoice.id, gateway, ref, invoice.amountCents, invoice.currency, now())
    .run();
  return { id, gatewayRef: ref };
}

/* Returns whether *this* call was the one that settled it. A replay gets
   `settled: false` and changes nothing, which is the whole point. */
export async function settlePaymentRecord(db, { gateway, gatewayRef, ok, detail }) {
  const ref = text(gatewayRef, 120);
  if (!ref) return { settled: false, reason: "no_reference" };

  const payment = await db
    .prepare(
      `SELECT id, invoice_id AS invoiceId, status FROM payments WHERE gateway = ? AND gateway_ref = ?`
    )
    .bind(gateway, ref)
    .first();
  if (!payment) return { settled: false, reason: "unknown_reference" };
  if (payment.status === "paid") return { settled: false, reason: "already_settled", invoiceId: payment.invoiceId };

  const at = now();
  await db
    .prepare(`UPDATE payments SET status = ?, detail = ?, settled_at = ? WHERE id = ?`)
    .bind(ok ? "paid" : "failed", text(detail, 300), at, payment.id)
    .run();

  if (!ok) return { settled: false, reason: "declined", invoiceId: payment.invoiceId };

  await db
    .prepare(`UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND status <> 'paid'`)
    .bind(at, at, payment.invoiceId)
    .run();

  return { settled: true, invoiceId: payment.invoiceId };
}

export async function paymentsForInvoice(db, invoiceId) {
  const { results } = await db
    .prepare(
      `SELECT gateway, gateway_ref AS gatewayRef, status, detail,
              created_at AS createdAt, settled_at AS settledAt
         FROM payments WHERE invoice_id = ? ORDER BY created_at DESC`
    )
    .bind(String(invoiceId))
    .all();
  return results ?? [];
}

/* ---- one-time attachment of briefs stored before customers existed ---- */

let backfilled = false;

export async function backfillCustomers(db) {
  if (backfilled) return;
  const pending = await db
    .prepare(`SELECT id, payload FROM briefs WHERE customer_id IS NULL LIMIT 200`)
    .all();

  for (const row of pending.results ?? []) {
    let submission = null;
    try {
      submission = JSON.parse(row.payload);
    } catch {
      /* A payload that will not parse cannot be attached to anybody, and
         failing the whole backfill over one bad row would strand the rest. */
    }
    if (!submission) continue;
    const customer = await resolveCustomer(db, submission);
    await db
      .prepare(`UPDATE briefs SET customer_id = ? WHERE id = ? AND customer_id IS NULL`)
      .bind(customer.id, row.id)
      .run();
  }

  /* Only stop looking once a pass finds nothing: a page of 200 leaves the rest
     for the next request rather than running past the Worker's time limit. */
  if ((pending.results ?? []).length === 0) backfilled = true;
}

/* ---- one call the routes start from ----

   Applying the schema and attaching orphaned briefs are two things that both
   have to have happened before any customer query is meaningful, and both are
   idempotent and self-limiting. Every route that touches customers calls this
   rather than remembering the pair. */
export async function ensureReady(db) {
  await ensureSchema(db);
  await backfillCustomers(db);
}

/* The invoice behind a gateway's callback, found by the reference the gateway
   itself gave us when the payment was started. This is what makes a callback
   trustworthy enough to verify: the payer's browser carries an authority or a
   trackId, and only a row we wrote earlier can turn it into an invoice. */
export async function invoiceForPaymentRef(db, gateway, gatewayRef) {
  const ref = text(gatewayRef, 120);
  if (!ref) return null;
  /* The one query that selects the token, because the payer coming back from
     their bank has lost it — it was in the page they left — and the only way
     to put them back in front of their own invoice is to carry it into the
     redirect. It goes to the browser that already had it, over https, and
     nowhere else. */
  return db
    .prepare(
      `SELECT ${invoiceColumns("i")}, i.token FROM invoices i
         JOIN payments p ON p.invoice_id = i.id
        WHERE p.gateway = ? AND p.gateway_ref = ?`
    )
    .bind(String(gateway), ref)
    .first();
}

export async function briefByReference(db, reference) {
  return db
    .prepare(
      `SELECT id, reference, customer_id AS customerId, platform, lang,
              bot_name AS botName, summary, created_at AS createdAt
         FROM briefs WHERE reference = ?`
    )
    .bind(text(reference, 32))
    .first();
}

/* Called once per submission, right after the brief is stored: the row exists,
   and this is what turns it from an anonymous enquiry into one person's. */
export async function linkBriefCustomer(db, reference, submission) {
  const customer = await resolveCustomer(db, submission);
  await db
    .prepare(`UPDATE briefs SET customer_id = ? WHERE reference = ? AND customer_id IS NULL`)
    .bind(customer.id, String(reference))
    .run();
  return customer;
}
