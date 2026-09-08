/* Where are we running?

   Capacitor exposes a `window.Capacitor` global inside the native WebView and
   sets `isNativePlatform()` true there. We read the global directly so this
   file has no build-time dependency on @capacitor/core — the web bundle stays
   free of Capacitor, and the native build picks it up at runtime. */
function detectNative() {
  try {
    const c = typeof window !== "undefined" ? window.Capacitor : null;
    if (!c) return false;
    if (typeof c.isNativePlatform === "function") return c.isNativePlatform();
    return c.platform === "ios" || c.platform === "android";
  } catch {
    return false;
  }
}

export const isNative = detectNative();
export const platform =
  (typeof window !== "undefined" && window.Capacitor?.getPlatform?.()) || "web";
