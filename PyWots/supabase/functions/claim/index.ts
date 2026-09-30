// POST /functions/v1/claim — Etsy order number → PyWots access codes.
// Public (deploy with --no-verify-jwt); all the logic is in ../_shared/claim-handler.ts.
import { adminClient, fetchReceipt } from "../_shared/etsy.ts";
import { handleClaim } from "../_shared/claim-handler.ts";

const db = adminClient();

Deno.serve((request) =>
  handleClaim(request, {
    env: (name) => Deno.env.get(name),

    consumeRateLimit: async (key, limit, windowSeconds) => {
      const { data, error } = await db.rpc("consume_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
      if (error) throw new Error(`consume_rate_limit failed: ${error.message}`);
      return data === true;
    },

    claimExists: async (receiptId) => {
      const { data, error } = await db.from("etsy_claims").select("receipt_id").eq("receipt_id", receiptId).maybeSingle();
      if (error) throw new Error(`etsy_claims lookup failed: ${error.message}`);
      return data !== null;
    },

    fetchReceipt: (receiptId) => fetchReceipt(db, receiptId),

    issueCodes: async (count, receiptId) => {
      const { data, error } = await db.rpc("issue_access_codes", { p_count: count, p_source: "etsy", p_receipt_id: receiptId });
      if (error) throw new Error(`issue_access_codes failed: ${error.message}`);
      return (data as string[] | null) ?? null;
    },
  })
);
