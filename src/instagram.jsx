import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { PlatformContext } from "./platform.js";
import "./index.css";

/* The Instagram site's own entry.

   A second HTML file rather than a client route, so the page carries its own
   title, description and robots rule instead of inheriting the Telegram
   page's. No router: this page has no sub-paths, and it is meant to be
   liftable to its own domain, where it would simply be the root. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PlatformContext.Provider value="instagram">
      <App />
    </PlatformContext.Provider>
  </React.StrictMode>
);
