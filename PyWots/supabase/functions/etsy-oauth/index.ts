// Connects the Etsy shop once, and keeps it connected. Public (deploy with --no-verify-jwt);
// every action except Etsy's own callback needs ?secret=ETSY_OAUTH_SETUP_SECRET.
//
//   GET ?secret=…                  start: redirects to Etsy's consent screen (open it while
//                                  signed in as the shop owner)
//   GET ?code=…&state=…            Etsy's callback: stores the tokens
//   GET ?action=refresh&secret=…   rotates the tokens (the daily cron in supabase/README.md)
import { adminClient, clientId, CONNECT_URL, redirectUri, refreshTokens, requestTokens, saveTokens } from "../_shared/etsy.ts";

const STATE_TTL_MS = 15 * 60 * 1000;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const randomToken = (byteLength = 32) => base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
const text = (status: number, body: string) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

Deno.serve(async (request) => {
  const params = new URL(request.url).searchParams;
  const db = adminClient();

  try {
    // Etsy's redirect back after the shop owner approves (or declines).
    if (params.has("state") || params.has("error")) {
      const code = params.get("code");
      const state = params.get("state");
      if (!code || !state) return text(400, `Etsy authorization failed: ${params.get("error") ?? "missing code"}`);

      const { data: row } = await db.from("etsy_oauth_states").delete().eq("state", state).select().maybeSingle();
      if (!row || Date.now() - new Date(row.created_at).getTime() > STATE_TTL_MS) {
        return text(400, "Unknown or expired state. Start again.");
      }
      const tokens = await requestTokens({
        grant_type: "authorization_code",
        client_id: clientId(),
        redirect_uri: redirectUri(),
        code,
        code_verifier: row.code_verifier,
      });
      await saveTokens(db, tokens);
      return text(200, "Etsy connected. You can close this tab.");
    }

    const setupSecret = Deno.env.get("ETSY_OAUTH_SETUP_SECRET");
    if (!setupSecret || setupSecret.length < 16 || params.get("secret") !== setupSecret) return text(403, "Forbidden");

    if (params.get("action") === "refresh") {
      await refreshTokens(db);
      return text(200, "Etsy tokens refreshed.");
    }

    // Start: PKCE challenge, remember the verifier, send the owner to Etsy.
    const codeVerifier = randomToken(48);
    const state = randomToken(16);
    const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))));
    await db.from("etsy_oauth_states").delete().lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
    const { error } = await db.from("etsy_oauth_states").insert({ state, code_verifier: codeVerifier });
    if (error) throw new Error(`Saving OAuth state failed: ${error.message}`);

    const url = new URL(CONNECT_URL);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId(),
      redirect_uri: redirectUri(),
      scope: "transactions_r",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  } catch (error) {
    console.error("etsy-oauth failed", error);
    return text(500, `Etsy setup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});
