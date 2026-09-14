import React from "react";
import ReactDOM from "react-dom/client";
import Pay from "./Pay.jsx";
import "../index.css";

/* The payment page, at /pay?t=<token>.

   Deliberately no service worker. Every other page here benefits from an
   offline shell; this one must never be answered from a cache, because a
   cached copy could tell somebody an invoice is unpaid after they have paid it
   — or worse, still show a pay button. Always the network, every time. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Pay />
  </React.StrictMode>
);
