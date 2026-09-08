/* Every call the dashboard makes.

   Same-origin and cookie-authenticated, so there is no token to hold in the
   browser and nothing to leak from it. The shop id travels in the query
   string on every request: the Worker checks it against the caller's own
   membership, so sending it is a selection among the shops they already have,
   never a claim to one they do not. */

const asJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

/* Thrown for anything that is not a 2xx, carrying the Worker's own error code
   so a caller can tell "has_orders" from "forbidden" without parsing prose. */
export class ApiError extends Error {
  constructor(code, status, body) {
    super(code);
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

async function request(path, { shop, method = "GET", body } = {}) {
  const url = new URL(path, window.location.origin);
  if (shop) url.searchParams.set("shop", shop);

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    /* A dropped connection and a 500 are different problems and the dashboard
       says so differently. */
    throw new ApiError("network", 0, null);
  }

  const data = await asJson(res);
  if (!res.ok) throw new ApiError(data.error ?? "server_error", res.status, data);
  return data;
}

export const get = (path, shop) => request(path, { shop });
export const post = (path, shop, body) => request(path, { shop, method: "POST", body });
