/* The one localStorage / profiles.state key the whole save lives under.
   Shared so PyWots.jsx and the auth helpers agree. Bump the suffix only
   for a breaking save-shape change (and write a migration). */
export const SAVE_KEY = "pywots:save:v1";
