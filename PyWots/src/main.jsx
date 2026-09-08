import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PyWots from "../PyWots.jsx";

/* The component ships with its own storage layer (artifact API -> localStorage ->
   memory), so it runs with zero configuration and stores progress per-device.
   For accounts / cross-device sync, swap the inline `store` in PyWots.jsx for a
   Supabase or Convex-backed store. */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PyWots />
  </StrictMode>
);
