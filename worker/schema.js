/* The dashboard's schema, and the code that applies it.

   It lives here as a string rather than in a migrations/ directory because
   the Worker applies it itself, on the first request that needs a table. That
   is not a shortcut around `wrangler d1 migrations apply` — it is the only
   route that exists for somebody administering this from a browser, with no
   terminal to run wrangler in. One source, applied the same way everywhere.

   To add a migration: append to MIGRATIONS with a new id. Never edit one that
   has shipped — a database that already applied it will not run it again.

   Money is always integer minor units (cents) with the currency alongside it.
   Floats do not add up, and a total that is a cent out is a support ticket.
   Timestamps are epoch milliseconds, so ordering, ranges and arithmetic are
   integer comparisons and no timezone is stored anywhere. */

const DASHBOARD_0001 = `
CREATE TABLE IF NOT EXISTS shops (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  ig_handle   TEXT NOT NULL DEFAULT '',
  currency    TEXT NOT NULL DEFAULT 'USD',
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  INTEGER NOT NULL
);

-- Who may see a shop. The identity is the Telegram sub from the existing
-- sign-in, so the dashboard adds no second account system.
CREATE TABLE IF NOT EXISTS shop_members (
  shop_id     TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'staff',
  username    TEXT NOT NULL DEFAULT '',
  display     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON shop_members (user_id);

-- What the automation authenticates with. Only the hash is stored: a leaked
-- database row must not be usable as a credential, and nobody — including the
-- studio — can read a token back out after it is shown once.
CREATE TABLE IF NOT EXISTS shop_tokens (
  token_hash   TEXT PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tokens_shop ON shop_tokens (shop_id);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL,
  price_cents  INTEGER NOT NULL DEFAULT 0,
  stock        INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products (shop_id, active, title);
-- A SKU is the shop's own identifier for a line, and the ingest endpoint uses
-- it to attach an order to a product without knowing our ids.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products (shop_id, sku) WHERE sku <> '';

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  shop_id       TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ref           TEXT NOT NULL,
  customer      TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new',
  total_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  source_post   TEXT NOT NULL DEFAULT '',
  keyword       TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders (shop_id, status, created_at DESC);
-- The automation retries; the same order must not land twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_ref ON orders (shop_id, ref);

-- The title and unit price are copied onto the line rather than joined at read
-- time: an order is a record of what was sold at the price it was sold for,
-- and editing a product later must not rewrite last month's revenue.
CREATE TABLE IF NOT EXISTS order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       TEXT,
  title            TEXT NOT NULL,
  qty              INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_items_product ON order_items (product_id);

-- The events store. Every inbound and outbound message the automation handles,
-- which is what makes a reply time measurable at all.
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  customer    TEXT NOT NULL DEFAULT '',
  order_id    TEXT,
  source_post TEXT NOT NULL DEFAULT '',
  keyword     TEXT NOT NULL DEFAULT '',
  at          INTEGER NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_events_shop_at ON events (shop_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_events_thread ON events (shop_id, customer, at);
`;

export const MIGRATIONS = [{ id: "0001_dashboard", sql: DASHBOARD_0001 }];

/* Comments go first, including trailing ones: the file is split on semicolons,
   and a `--` left in place would swallow the start of the next statement. No
   string literal here contains either character, which is what makes splitting
   this way safe. */
export function statementsOf(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/* Checked once per isolate. The first request into a cold isolate pays one
   SELECT; every request after it pays nothing. */
let verified = false;

/* Applying twice is harmless — every statement is IF NOT EXISTS and the
   bookkeeping insert is OR IGNORE — so two isolates racing on a brand new
   database is not a case that needs locking. */
export async function ensureSchema(db) {
  if (verified) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id TEXT PRIMARY KEY,
         applied_at INTEGER NOT NULL
       )`
    )
    .run();

  const { results } = await db.prepare(`SELECT id FROM schema_migrations`).all();
  const applied = new Set((results ?? []).map((row) => row.id));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const statements = statementsOf(migration.sql).map((sql) => db.prepare(sql));
    statements.push(
      db
        .prepare(`INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)`)
        .bind(migration.id, Date.now())
    );
    /* One batch, so a half-created schema is not a state this database can be
       left in. */
    await db.batch(statements);
  }

  verified = true;
}
