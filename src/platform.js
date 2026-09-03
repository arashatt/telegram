import { createContext, useContext } from "react";
import { DEFAULT_PLATFORM, platformId } from "../shared/platforms.js";

/* Which site this tree is. Set once at the entry point — src/main.jsx for the
   Telegram site, src/instagram.jsx for the Instagram one — and read by the
   copy, the form options, the accent tokens and the demo's chrome.

   Deliberately not derived from the URL: the Instagram page is meant to be
   liftable to its own domain, where its path would be "/" like any other. */
export const PlatformContext = createContext(DEFAULT_PLATFORM);

export function usePlatform() {
  return platformId(useContext(PlatformContext));
}
