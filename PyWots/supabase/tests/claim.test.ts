// The claim flow and Etsy receipt rules, with Etsy and the database faked out.
// Node runs this TypeScript directly (type stripping); `npm test` runs it with the SQL tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleClaim, type ClaimDeps } from "../functions/_shared/claim-handler.ts";
import { evaluateReceipt, parseListingIds, MAX_CODES_PER_ORDER, type EtsyReceipt } from "../functions/_shared/receipt.ts";

const SHOP = "68256965";
const PYWOTS = "1111111111";
const PYWOTS_RELIST = "2222222222";
const BUDGET = "9999999999"; // a WotsBudgetTracker listing in the same shop

const receipt = (over: Partial<EtsyReceipt> = {}): EtsyReceipt => ({
  receipt_id: 3141592653,
  shop_id: Number(SHOP),
  buyer_email: "Buyer@Example.com",
  status: "paid",
  is_paid: true,
  transactions: [{ listing_id: Number(PYWOTS), quantity: 1 }],
  refunds: [],
  ...over,
});

function fakeDeps(over: Partial<ClaimDeps> & { receipt?: EtsyReceipt | null } = {}) {
  const calls = { rateKeys: [] as string[], issued: [] as [number, string][] };
  const deps: ClaimDeps = {
    env: (name) => ({ ETSY_SHOP_ID: SHOP, ETSY_LISTING_IDS: `${PYWOTS}, ${PYWOTS_RELIST}` } as Record<string, string>)[name],
    consumeRateLimit: async (key) => { calls.rateKeys.push(key); return true; },
    claimExists: async () => false,
    fetchReceipt: async () => (over.receipt === null ? { status: "not_found" } : { status: "ok", receipt: over.receipt ?? receipt() }),
    issueCodes: async (count, receiptId) => {
      calls.issued.push([count, receiptId]);
      return Array.from({ length: count }, (_, i) => `PY12-TEST-000${i + 2}`);
    },
    log: () => {},
    ...over,
  };
  return { deps, calls };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://x.supabase.co/functions/v1/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function call(request: Request, deps: ClaimDeps) {
  const response = await handleClaim(request, deps);
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
}

// ---------------------------------------------------------------- receipt rules

test("parseListingIds splits and trims", () => {
  assert.deepEqual(parseListingIds(" 1, 2 ,,3 "), ["1", "2", "3"]);
  assert.deepEqual(parseListingIds(undefined), []);
});

test("one code per PyWots item, across listings; other shop items are ignored", () => {
  const r = evaluateReceipt(
    receipt({ transactions: [
      { listing_id: Number(PYWOTS), quantity: 2 },
      { listing_id: Number(BUDGET), quantity: 5 },
      { listing_id: Number(PYWOTS_RELIST), quantity: 1 },
    ] }),
    { shopId: SHOP, listingIds: [PYWOTS, PYWOTS_RELIST] },
  );
  assert.deepEqual(r, { ok: true, quantity: 3, buyerEmail: "buyer@example.com" });
});

test("refused receipts", () => {
  const cfg = { shopId: SHOP, listingIds: [PYWOTS] };
  assert.equal(evaluateReceipt(receipt({ shop_id: 1 }), cfg).ok, false);
  assert.match((evaluateReceipt(receipt({ status: "Fully Refunded" }), cfg) as { error: string }).error, /refunded/);
  assert.match((evaluateReceipt(receipt({ refunds: [{}] }), cfg) as { error: string }).error, /refunded/);
  assert.match((evaluateReceipt(receipt({ is_paid: false }), cfg) as { error: string }).error, /paid/);
  assert.match((evaluateReceipt(receipt({ transactions: [{ listing_id: Number(BUDGET), quantity: 1 }] }), cfg) as { error: string }).error, /doesn't include PyWots/);
  const huge = receipt({ transactions: [{ listing_id: Number(PYWOTS), quantity: MAX_CODES_PER_ORDER + 1 }] });
  assert.match((evaluateReceipt(huge, cfg) as { error: string }).error, /too large/);
});

// ---------------------------------------------------------------- request handling

test("CORS preflight and wrong methods", async () => {
  const { deps } = fakeDeps();
  const pre = await handleClaim(new Request("https://x/claim", { method: "OPTIONS" }), deps);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(pre.headers.get("Access-Control-Allow-Headers") ?? "", /apikey/);
  assert.equal((await call(new Request("https://x/claim"), deps)).status, 405);
  assert.equal((await call(post("{nope"), deps)).status, 400);
});

test("a good claim returns one code per item and records it against the order", async () => {
  const { deps, calls } = fakeDeps({ receipt: receipt({ transactions: [{ listing_id: Number(PYWOTS), quantity: 2 }] }) });
  const res = await call(post({ receiptId: " #3141 592653 ", email: "  BUYER@example.com " }, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), deps);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { codes: [{ code: "PY12-TEST-0002", plan: "12m" }, { code: "PY12-TEST-0003", plan: "12m" }] });
  assert.deepEqual(calls.issued, [[2, "3141592653"]]);
  assert.deepEqual(calls.rateKeys, ["claim:ip:1.2.3.4", "claim:receipt:3141592653"]);
});

test("the buyer email is required and must match when Etsy provides it", async () => {
  const { deps } = fakeDeps();
  const missing = await call(post({ receiptId: "3141592653" }), deps);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.needsEmail, true);
  const wrong = await call(post({ receiptId: "3141592653", email: "someone@else.com" }), deps);
  assert.equal(wrong.status, 403);
});

test("without a buyer email on the receipt, the order number alone is enough", async () => {
  const { deps } = fakeDeps({ receipt: receipt({ buyer_email: null }) });
  assert.equal((await call(post({ receiptId: "3141592653" }), deps)).status, 200);
});

test("bad order numbers, rate limits and repeat claims", async () => {
  assert.equal((await call(post({ receiptId: "abc" }), fakeDeps().deps)).status, 400);

  const ipLimited = fakeDeps({ consumeRateLimit: async (key) => !key.startsWith("claim:ip:") });
  assert.equal((await call(post({ receiptId: "1" }, { "x-real-ip": "5.6.7.8" }), ipLimited.deps)).status, 429);

  const noIp = fakeDeps();
  await call(post({ receiptId: "1", email: "buyer@example.com" }), noIp.deps);
  assert.equal(noIp.calls.rateKeys[0], "claim:global");

  const receiptLimited = fakeDeps({ consumeRateLimit: async (key) => !key.startsWith("claim:receipt:") });
  assert.match((await call(post({ receiptId: "1" }), receiptLimited.deps)).body.error, /for this order/);

  assert.equal((await call(post({ receiptId: "1" }), fakeDeps({ claimExists: async () => true }).deps)).status, 409);
  const raced = fakeDeps({ issueCodes: async () => null });
  assert.equal((await call(post({ receiptId: "1", email: "buyer@example.com" }), raced.deps)).status, 409);
});

test("Etsy and configuration failures", async () => {
  assert.equal((await call(post({ receiptId: "1" }), fakeDeps({ receipt: null }).deps)).status, 404);
  const down = fakeDeps({ fetchReceipt: async () => { throw new Error("ECONNRESET"); } });
  assert.equal((await call(post({ receiptId: "1" }), down.deps)).status, 502);
  const unconfigured = fakeDeps({ env: () => undefined });
  assert.equal((await call(post({ receiptId: "1" }), unconfigured.deps)).status, 503);
  const dbDown = fakeDeps({ issueCodes: async () => { throw new Error("db"); } });
  const res = await call(post({ receiptId: "1", email: "buyer@example.com" }), dbDown.deps);
  assert.equal(res.status, 500);
  assert.match(res.body.error, /message us on Etsy/);
});
