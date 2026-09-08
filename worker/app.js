/* The shop owner's dashboard API.

   Its own module because it is the only part of this Worker with path
   parameters, a database behind it, and more than one tenant. Everything the
   two intake pages do is unaffected by it — they never touch env.DB, so a
   Worker deployed without a database still serves them normally and only
   /api/app/* answers 503.

   Two ways in, and they are not the same:

     a signed-in person   the existing Telegram sign-in says who they are, and
                          shop_members says which shop they may see. The shop
                          id always comes from their membership, never from the
                          request.
     the automation       a per-shop bearer token on /api/app/ingest, which is
                          the seam the Instagram side writes orders and DM
                          events through. It can write, and it can read
                          nothing.

   Responses carry no CORS headers and are never stored: this is one shop's
   data, answered to the browser that asked for it. */

import { currentUser, isAuthConfigured } from "./auth.js";
import { jsonPrivate, readBody } from "./http.js";
import { clientKey, overLimit } from "./ratelimit.js";
import {
  addMember,
  createProduct,
  createShop,
  createToken,
  deleteProduct,
  getOrder,
  getShop,
  hasDb,
  listEvents,
  listMembers,
  listOrders,
  listProducts,
  listTokens,
  membershipsFor,
  orderCounts,
  recordEvent,
  refreshMemberIdentity,
  removeMember,
  revokeToken,
  setOrderStatus,
  shopForToken,
  updateProduct,
  updateShop,
  upsertOrder,
  weeklyReport,
} from "./db.js";
import {
  LIMITS,
  eventId,
  handle,
  integer,
  normalizeIngestOrder,
  parseMoney,
  statusId,
  text,
  validateProduct,
} from "../shared/orderSchema.js";

const PREFIX = "/api/app/";

export const isAppRoute = (pathname) => pathname === "/api/app" || pathname.startsWith(PREFIX);

/* Batches, so a shop with a busy morning is one request rather than four
   hundred. Both are well inside the 64 KB body cap. */
const MAX_INGEST_ORDERS = 50;
const MAX_INGEST_EVENTS = 200;

const ok = (body = {}) => jsonPrivate({ ok: true, ...body });
const fail = (error, status, extra = {}) => jsonPrivate({ error, ...extra }, status);

/* Who is asking. `admin` marks the studio's own accounts, listed in
   ADMIN_TELEGRAM_IDS — it grants creating a shop and nothing else. An admin
   who is not a member of a shop cannot read that shop: support access to a
   client's orders should be a deliberate membership, not a side effect of
   being staff. */
async function actorFor(request, env) {
  const user = await currentUser(request, env);
  if (!user?.id) return null;
  const admins = String(env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return { user, admin: admins.includes(String(user.id)) };
}

/* Resolves which shop this request is about, from the caller's own
   memberships. `?shop=` selects among them when somebody belongs to more than
   one; it can never introduce a shop they are not in. */
async function shopContext(db, actor, url, { role } = {}) {
  const memberships = await membershipsFor(db, actor.user.id);
  if (memberships.length === 0) return { error: "no_shop", status: 404, memberships };

  const wanted = url.searchParams.get("shop");
  const found = wanted ? memberships.find((m) => m.shopId === wanted) : memberships[0];
  if (!found) return { error: "forbidden", status: 403, memberships };
  if (role === "owner" && found.role !== "owner") return { error: "forbidden", status: 403, memberships };

  return { shopId: found.shopId, role: found.role, shop: found, memberships };
}

/* ---- signed-in routes ---- */

async function handleSession(request, env, db, actor) {
  /* The one place a member's own name can be learned: the studio adds them by
     id, and this is the first request that knows who that id is. */
  if (actor) await refreshMemberIdentity(db, actor.user);
  const memberships = actor ? await membershipsFor(db, actor.user.id) : [];
  return jsonPrivate({
    configured: isAuthConfigured(env),
    database: hasDb(env),
    user: actor?.user ?? null,
    admin: actor?.admin ?? false,
    shops: memberships,
  });
}

async function handleCreateShop(request, env, db, actor) {
  if (!actor.admin) return fail("forbidden", 403);
  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return fail("payload_too_large", 413);
  if (invalid) return fail("invalid_json", 400);
  if (!text(body?.name, LIMITS.shopName)) return fail("invalid", 422, { field: "name" });

  const shop = await createShop(db, body);
  /* Whoever creates it owns it, otherwise the shop would exist with nobody
     able to open it. */
  await addMember(db, shop.id, { ...actor.user, display: actor.user.firstName }, "owner");
  return ok({ shop });
}

async function handleOverview(db, context) {
  const [shop, counts, recent, report] = await Promise.all([
    getShop(db, context.shopId),
    orderCounts(db, context.shopId),
    listOrders(db, context.shopId, { limit: 8 }),
    weeklyReport(db, context.shopId),
  ]);
  return jsonPrivate({ shop, role: context.role, counts, recent: recent.orders, report });
}

async function handleOrders(url, db, context) {
  const page = await listOrders(db, context.shopId, {
    status: url.searchParams.get("status") ?? undefined,
    before: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? 30,
  });
  return jsonPrivate({ ...page, counts: await orderCounts(db, context.shopId) });
}

async function handleOrder(db, context, id) {
  const order = await getOrder(db, context.shopId, id);
  return order ? jsonPrivate({ order }) : fail("not_found", 404);
}

async function handleOrderStatus(request, db, context, id) {
  const { body, invalid } = await readBody(request);
  if (invalid) return fail("invalid_json", 400);
  if (statusId(body?.status) !== body?.status) return fail("invalid", 422, { field: "status" });

  const order = await setOrderStatus(db, context.shopId, id, body.status);
  return order ? ok({ order }) : fail("not_found", 404);
}

async function handleProductWrite(request, db, context, id) {
  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return fail("payload_too_large", 413);
  if (invalid) return fail("invalid_json", 400);

  const errors = validateProduct(body);
  if (Object.keys(errors).length) return fail("invalid_product", 422, { errors });

  const patch = {
    sku: text(body?.sku, LIMITS.sku),
    title: text(body?.title, LIMITS.title),
    priceCents: parseMoney(body?.price) ?? 0,
    stock: integer(parseMoney(body?.stock) === null ? 0 : Number(body?.stock ?? 0), { min: 0 }),
    active: body?.active !== false,
  };

  const product = id
    ? await updateProduct(db, context.shopId, id, patch)
    : await createProduct(db, context.shopId, patch);
  if (!product) return fail("not_found", 404);
  return ok({ product });
}

async function handleSettings(db, context) {
  const [shop, members, tokens] = await Promise.all([
    getShop(db, context.shopId),
    listMembers(db, context.shopId),
    listTokens(db, context.shopId),
  ]);
  return jsonPrivate({ shop, members, tokens, role: context.role });
}

async function handleMemberAdd(request, db, context) {
  const { body, invalid } = await readBody(request);
  if (invalid) return fail("invalid_json", 400);
  const id = text(body?.userId, 32).replace(/\D/g, "");
  if (!id) return fail("invalid", 422, { field: "userId" });

  await addMember(
    db,
    context.shopId,
    { id, username: text(body?.username, 64), display: text(body?.display, 80) },
    body?.role === "owner" ? "owner" : "staff"
  );
  return ok({ members: await listMembers(db, context.shopId) });
}

async function handleMemberRemove(request, db, context) {
  const { body, invalid } = await readBody(request);
  if (invalid) return fail("invalid_json", 400);
  const result = await removeMember(db, context.shopId, text(body?.userId, 32));
  if (!result.removed) return fail(result.reason, 422);
  return ok({ members: await listMembers(db, context.shopId) });
}

/* ---- the automation's way in ---- */

async function handleIngest(request, env, db) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const shopId = await shopForToken(db, token);
  /* Deliberately the same answer for a missing, malformed and wrong token:
     none of them should learn anything from the difference. */
  if (!shopId) return fail("unauthorized", 401);

  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return fail("payload_too_large", 413);
  if (invalid) return fail("invalid_json", 400);

  const shop = await getShop(db, shopId);
  const orders = Array.isArray(body?.orders) ? body.orders.slice(0, MAX_INGEST_ORDERS) : [];
  const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_INGEST_EVENTS) : [];

  const written = [];
  for (const raw of orders) {
    written.push(await upsertOrder(db, shopId, normalizeIngestOrder(raw), shop?.currency));
  }

  let recorded = 0;
  for (const raw of events) {
    if (!eventId(raw?.type)) continue;
    if (await recordEvent(db, shopId, raw)) recorded += 1;
  }

  return ok({
    orders: written.map(({ ref, id, created }) => ({ ref, id, created })),
    events: recorded,
    /* Says plainly when a batch was truncated, rather than silently dropping
       the tail and reporting success. */
    truncated:
      (Array.isArray(body?.orders) && body.orders.length > MAX_INGEST_ORDERS) ||
      (Array.isArray(body?.events) && body.events.length > MAX_INGEST_EVENTS),
  });
}

/* ---- sample data ----

   A dashboard with nothing in it cannot be evaluated, and the Instagram
   automation that will eventually fill this one does not exist yet. Refused
   once the shop has real orders, so it can never overwrite them. */

const DEMO_PRODUCTS = [
  { sku: "TEE-GRN", title: "Green tee", price: 4000, stock: 24 },
  { sku: "TEE-RST", title: "Rust tee", price: 4000, stock: 11 },
  { sku: "KNT-CRM", title: "Cream knit", price: 7500, stock: 6 },
  { sku: "SCF-IND", title: "Indigo scarf", price: 5500, stock: 18 },
  { sku: "CAP-BLK", title: "Black cap", price: 2500, stock: 32 },
  { sku: "BAG-TAN", title: "Tan tote", price: 6000, stock: 9 },
];

const DEMO_CUSTOMERS = ["@nadia.k", "@parisa.rt", "@davoud_h", "@sara.m", "@omid.p", "@leyla.z"];
const DEMO_POSTS = ["New season, six colours", "Restock: cream knit", "Behind the studio"];
const DEMO_STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"];

async function handleDemo(db, context) {
  const counts = await orderCounts(db, context.shopId);
  if (Object.values(counts).some((n) => n > 0)) return fail("shop_not_empty", 409);

  const shop = await getShop(db, context.shopId);
  const existing = await listProducts(db, context.shopId);
  if (existing.length === 0) {
    for (const p of DEMO_PRODUCTS) {
      await createProduct(db, context.shopId, {
        sku: p.sku,
        title: p.title,
        priceCents: p.price,
        stock: p.stock,
        active: true,
      });
    }
  }

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  let orders = 0;

  /* Fourteen days, so the report has a previous week to compare against, and
     deterministic rather than random: the same seed produces the same
     dashboard, which is what makes a screenshot reproducible. */
  for (let i = 0; i < 26; i += 1) {
    const at = now - Math.floor((i * 13 * day) / 26) - (i % 5) * 3600_000;
    const customer = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];
    const post = DEMO_POSTS[i % DEMO_POSTS.length];
    const first = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];
    const second = DEMO_PRODUCTS[(i * 3 + 1) % DEMO_PRODUCTS.length];
    const items = [{ sku: first.sku, title: first.title, qty: 1 + (i % 2), price: first.price / 100 }];
    if (i % 3 === 0) items.push({ sku: second.sku, title: second.title, qty: 1, price: second.price / 100 });

    await upsertOrder(
      db,
      context.shopId,
      normalizeIngestOrder({
        ref: `DEMO-${String(i + 1).padStart(3, "0")}`,
        customer,
        status: DEMO_STATUSES[i % DEMO_STATUSES.length],
        post,
        keyword: "CATALOG",
        items,
      }),
      shop?.currency
    );

    /* The conversation behind the order, so reply times are measured rather
       than invented: a message in, and an answer a few minutes later. */
    await recordEvent(db, context.shopId, {
      type: "comment",
      customer,
      post,
      keyword: "CATALOG",
      at: at - 9 * 60_000,
    });
    await recordEvent(db, context.shopId, { type: "dm_in", customer, post, at: at - 8 * 60_000 });
    await recordEvent(db, context.shopId, {
      type: "dm_out",
      customer,
      post,
      at: at - 8 * 60_000 + (2 + (i % 7)) * 60_000,
    });
    if (i % 6 === 0) {
      await recordEvent(db, context.shopId, { type: "handoff", customer, post, at: at - 60_000 });
    }
    orders += 1;
  }

  return ok({ orders });
}

/* ---- dispatch ---- */

export async function handleApp(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (!hasDb(env)) {
    return fail("database_not_configured", 503, {
      hint: "Create the D1 database and put its id in wrangler.jsonc — see the README.",
    });
  }

  const db = env.DB;
  const segments = url.pathname.slice(PREFIX.length).split("/").filter(Boolean);
  const [head, second, third] = segments;
  const post = request.method === "POST";

  /* The automation's endpoint authenticates with its own token and must be
     reachable before any of the session handling below. */
  if (head === "ingest") {
    if (!post) return fail("method_not_allowed", 405);
    if (await overLimit(env.APP_LIMIT, clientKey(request))) return fail("rate_limited", 429);
    return handleIngest(request, env, db);
  }

  if (await overLimit(env.APP_LIMIT, clientKey(request))) return fail("rate_limited", 429);

  const actor = await actorFor(request, env);

  /* The one route that answers without a session: the dashboard asks it on
     load to find out whether there is anyone to show. */
  if (head === "session") return handleSession(request, env, db, actor);
  if (!actor) return fail("unauthorized", 401);
  if (head === "shops" && post) return handleCreateShop(request, env, db, actor);

  const context = await shopContext(db, actor, url, {
    role: (head === "settings" && post) || head === "members" || head === "tokens" ? "owner" : undefined,
  });
  if (context.error) return fail(context.error, context.status, { shops: context.memberships });

  switch (head) {
    case "overview":
      return handleOverview(db, context);

    case "orders":
      if (!second) return handleOrders(url, db, context);
      if (third === "status" && post) return handleOrderStatus(request, db, context, second);
      if (!post) return handleOrder(db, context, second);
      return fail("not_found", 404);

    case "products":
      if (!second) {
        return post
          ? handleProductWrite(request, db, context, null)
          : jsonPrivate({ products: await listProducts(db, context.shopId) });
      }
      if (third === "delete" && post) {
        const result = await deleteProduct(db, context.shopId, second);
        return result.deleted ? ok() : fail(result.reason, result.reason === "not_found" ? 404 : 409);
      }
      if (post) return handleProductWrite(request, db, context, second);
      return fail("not_found", 404);

    case "report":
      return jsonPrivate({
        report: await weeklyReport(db, context.shopId, {
          days: integer(url.searchParams.get("days") ?? 7, { min: 1, max: 90 }),
        }),
      });

    case "events":
      return jsonPrivate({
        events: await listEvents(db, context.shopId, {
          before: url.searchParams.get("before") ?? undefined,
        }),
      });

    case "settings": {
      if (!post) return handleSettings(db, context);
      const { body, invalid } = await readBody(request);
      if (invalid) return fail("invalid_json", 400);
      const shop = await updateShop(db, context.shopId, body);
      return shop ? ok({ shop }) : fail("not_found", 404);
    }

    case "tokens": {
      if (!post) return fail("method_not_allowed", 405);
      if (second === "revoke") {
        const { body, invalid } = await readBody(request);
        if (invalid) return fail("invalid_json", 400);
        const result = await revokeToken(db, context.shopId, body?.hash);
        return result.revoked ? ok({ tokens: await listTokens(db, context.shopId) }) : fail("not_found", 404);
      }
      const { body } = await readBody(request);
      /* Returned once, in this response, and never retrievable again — only
         the hash is stored. */
      const token = await createToken(db, context.shopId, body?.label);
      return ok({ token, tokens: await listTokens(db, context.shopId) });
    }

    case "members":
      if (!post) return fail("method_not_allowed", 405);
      return second === "remove"
        ? handleMemberRemove(request, db, context)
        : handleMemberAdd(request, db, context);

    case "demo":
      if (!post) return fail("method_not_allowed", 405);
      if (context.role !== "owner") return fail("forbidden", 403);
      return handleDemo(db, context);

    default:
      return fail("not_found", 404);
  }
}

/* Exported for the tests, which check that a handle written by the automation
   and one typed into the dashboard normalise to the same customer. */
export const normalizeCustomer = handle;
