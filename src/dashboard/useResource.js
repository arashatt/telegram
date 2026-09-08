import { useEffect, useState } from "react";
import { get } from "./api.js";

/* One GET, kept in step with whatever it depends on.

   The loading flag is derived from a key mismatch rather than set at the top
   of the effect: a synchronous setState there would be a cascading render, and
   comparing keys has the better property anyway — a slow answer to a question
   nobody is asking any more can never overwrite the current one. */
export function useResource(path, shop, reloads = 0) {
  const key = `${path}|${shop ?? ""}|${reloads}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let live = true;
    get(path, shop)
      .then((data) => {
        if (live) setResult({ key, data, error: null });
      })
      .catch((err) => {
        if (live) setResult({ key, data: null, error: err.code });
      });
    return () => {
      live = false;
    };
  }, [key, path, shop]);

  return { loading: result.key !== key, data: result.data, error: result.error };
}
