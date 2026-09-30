import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { EtsyReceipt } from "./receipt.ts";

/* Etsy Open API v3 client for the shop's own orders. The OAuth tokens live in the one-row
   `etsy_auth` table (service role only). Ported from WotsBudgetTracker's convex/etsy.ts. */

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
export const CONNECT_URL = "https://www.etsy.com/oauth/connect";

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * The project's secret key. New projects only have the `sb_secret_…` keys, which Supabase
 * injects as the JSON dictionary SUPABASE_SECRET_KEYS; older ones have SUPABASE_SERVICE_ROLE_KEY.
 */
function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    const key = parsed.default ?? Object.values(parsed)[0];
    if (key) return key;
  }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

/** Service-role client: bypasses RLS, so it must only ever run server-side. */
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), secretKey(), { auth: { persistSession: false } });
}

/** The app keystring (OAuth client_id). ETSY_API_KEY may also be given as "keystring:secret". */
export function clientId(): string {
  return env("ETSY_API_KEY").split(":")[0];
}

/** Etsy's x-api-key header: "keystring:shared_secret" when the secret is configured. */
function apiKeyHeader(): string {
  const key = env("ETSY_API_KEY");
  const secret = Deno.env.get("ETSY_SHARED_SECRET");
  return secret && !key.includes(":") ? `${key}:${secret}` : key;
}

/** Must match a callback URL registered on the Etsy app. */
export function redirectUri(): string {
  return Deno.env.get("ETSY_REDIRECT_URI") ?? `${env("SUPABASE_URL")}/functions/v1/etsy-oauth`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function requestTokens(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) throw new Error(`Etsy token request failed (${response.status}): ${await response.text()}`);
  return (await response.json()) as TokenResponse;
}

export async function saveTokens(db: SupabaseClient, tokens: TokenResponse): Promise<string> {
  const { error } = await db.from("etsy_auth").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Saving Etsy tokens failed: ${error.message}`);
  return tokens.access_token;
}

/**
 * Swaps the refresh token for a new pair. Access tokens last an hour and refresh tokens about
 * 90 days, so a daily call (see supabase/README.md) keeps the shop connected through quiet spells.
 */
export async function refreshTokens(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from("etsy_auth").select("refresh_token").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Reading Etsy tokens failed: ${error.message}`);
  if (!data) throw new Error("Etsy is not connected. Run the OAuth setup (see supabase/README.md).");
  const tokens = await requestTokens({ grant_type: "refresh_token", client_id: clientId(), refresh_token: data.refresh_token });
  return await saveTokens(db, tokens);
}

/** A usable access token, refreshed first if it's about to expire. */
async function getAccessToken(db: SupabaseClient, forceRefresh = false): Promise<string> {
  const { data, error } = await db.from("etsy_auth").select("access_token, expires_at").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Reading Etsy tokens failed: ${error.message}`);
  if (!data) throw new Error("Etsy is not connected. Run the OAuth setup (see supabase/README.md).");
  if (!forceRefresh && new Date(data.expires_at).getTime() - Date.now() > 60_000) return data.access_token;
  return await refreshTokens(db);
}

export async function fetchReceipt(
  db: SupabaseClient,
  receiptId: string,
): Promise<{ status: "ok"; receipt: EtsyReceipt } | { status: "not_found" }> {
  const url = `${API_BASE}/shops/${encodeURIComponent(env("ETSY_SHOP_ID"))}/receipts/${encodeURIComponent(receiptId)}`;
  const attempt = async (token: string) =>
    await fetch(url, { headers: { "x-api-key": apiKeyHeader(), Authorization: `Bearer ${token}` } });

  let response = await attempt(await getAccessToken(db));
  if (response.status === 401) response = await attempt(await getAccessToken(db, true));

  if (response.status === 404 || response.status === 400) return { status: "not_found" };
  if (!response.ok) throw new Error(`Etsy receipt lookup failed (${response.status}): ${await response.text()}`);
  return { status: "ok", receipt: (await response.json()) as EtsyReceipt };
}
