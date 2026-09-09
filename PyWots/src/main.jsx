import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PyWots from "../PyWots.jsx";
import { isNative } from "./lib/platform.js";

/* Persistence and auth live in src/lib/. The app is local-first: it runs
   with zero configuration (per-device), and when Supabase env vars are
   present it syncs to an account across web + iOS. */

/* Native-only wiring (status bar, OAuth deep-link) — never enters the web bundle. */
if (isNative) import("./lib/native-bridge.js");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PyWots />
  </StrictMode>
);
