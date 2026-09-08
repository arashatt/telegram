import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./dashboard/Dashboard.jsx";
import "./index.css";
import { registerServiceWorker } from "./pwa.js";

/* The shop owner's dashboard, at /app.

   A third HTML entry rather than a route on either marketing page: it is
   noindex, it needs none of their copy, and a shop owner opening it from their
   home screen should get the app rather than a landing page that then
   navigates. It installs as its own app for the same reason. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>
);

/* After the render call, so the first paint is never waiting on it. */
registerServiceWorker();
