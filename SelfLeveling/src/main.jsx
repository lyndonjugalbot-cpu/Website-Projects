import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SelfLeveling from "../SelfLeveling.jsx";

/* The component ships with its own storage layer (artifact API → localStorage →
   memory), so it runs with zero configuration. To follow progress across devices,
   wire up Supabase per PERSISTENCE.md and swap the inline `store` for
   `import { store } from "./persistence"`. */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SelfLeveling />
  </StrictMode>
);
