import React from "react";
import ReactDOM from "react-dom/client";
import Account from "./Account.jsx";
import "../index.css";
import { registerServiceWorker } from "../pwa.js";

/* A customer's own page, at /account. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Account />
  </React.StrictMode>
);

registerServiceWorker();
