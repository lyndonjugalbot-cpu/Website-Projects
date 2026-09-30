import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PyWots, { ClaimPage } from "../PyWots.jsx";
import { isNative } from "./lib/platform.js";

/* Persistence, auth and paid access live in src/lib/. With no Supabase env
   vars the app runs open and local-only (per-device). With them, it needs a
   signed-in account with a redeemed access code, and progress syncs. */

/* Native-only wiring (status bar, OAuth deep-link) — never enters the web bundle. */
if (isNative) import("./lib/native-bridge.js");

/* /claim is the public Etsy-order → access-code page (web only; the native
   app links out to it). Everything else is the app. */
const isClaim = !isNative && /^\/claim\/?$/.test(window.location.pathname);
const Root = isClaim ? ClaimPage : PyWots;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
