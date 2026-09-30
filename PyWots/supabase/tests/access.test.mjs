// Runs supabase/schema.sql in PGlite (real Postgres, in-process) and checks the paid-access
// functions and row-level security the way a Supabase client would hit them.
//
//   npm test
//
// A small stand-in for Supabase's `auth` schema, roles and default grants is created first,
// so the REVOKE/GRANT and RLS statements in schema.sql are exercised for real.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "..", "schema.sql"), "utf8");

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const GHOST = "00000000-0000-4000-8000-00000000000c"; // anonymous user

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
`;

let db;

/** Runs `fn` as a Supabase client role, like a request carrying that user's JWT. */
async function as(role, uid, fn, { anonymous = false } = {}) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [
      uid ?? "",
      uid ? JSON.stringify({ sub: uid, role, is_anonymous: anonymous }) : "",
    ]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}
const redeem = (uid, code, opts) =>
  as("authenticated", uid, async (tx) => (await tx.query("select public.redeem_access_code($1) as r", [code])).rows[0].r, opts);
const issue = async (count, receipt = null) =>
  (await db.query("select public.issue_access_codes($1, $2, $3) as codes", [count, receipt ? "etsy" : "admin", receipt])).rows[0].codes;
const expiryOf = async (uid) =>
  (await db.query("select access_expires_at from public.entitlements where user_id = $1", [uid])).rows[0]?.access_expires_at;
const DAY = 86_400_000;

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  await db.exec(schema);
  await db.exec(schema); // schema.sql promises to be safe to re-run
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [ALICE, BOB, GHOST]);
});

test("signup trigger creates a profile row", async () => {
  const { rows } = await db.query("select count(*)::int as n from public.profiles where id in ($1, $2)", [ALICE, BOB]);
  assert.equal(rows[0].n, 2);
});

test("codes look like PY12-XXXX-XXXX and avoid confusable characters", async () => {
  const codes = await issue(50);
  assert.equal(codes.length, 50);
  assert.equal(new Set(codes).size, 50);
  for (const c of codes) assert.match(c, /^PY12-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  const { rows } = await db.query("select * from public.access_codes where code = $1", [codes[0]]);
  assert.equal(rows[0].duration_days, 365);
  assert.equal(rows[0].source, "admin");
  assert.ok(Math.abs(new Date(rows[0].redeem_by) - Date.now() - 365 * DAY) < 60_000);
});

test("normalize_access_code accepts sloppy input and rejects non-codes", async () => {
  const norm = async (s) => (await db.query("select public.normalize_access_code($1) as n", [s])).rows[0].n;
  assert.equal(await norm(" py12 7kqm x2pd "), "PY12-7KQM-X2PD");
  assert.equal(await norm("PY127KQMX2PD"), "PY12-7KQM-X2PD");
  assert.equal(await norm("py12-7kqm-x2pd"), "PY12-7KQM-X2PD");
  assert.equal(await norm("FT12-7KQM-X2PD"), null); // WotsBudgetTracker's prefix
  assert.equal(await norm("PY12-7KQM-X2P0"), null); // 0 isn't in the alphabet
  assert.equal(await norm("PY12-7KQM-X2P"), null);
  assert.equal(await norm(null), null);
});

test("redeeming grants 365 days, once", async () => {
  const [code] = await issue(1);
  const r = await redeem(ALICE, code.toLowerCase().replaceAll("-", " "));
  assert.equal(r.ok, true, r.error);
  assert.equal(r.duration_days, 365);
  assert.ok(Math.abs(new Date(r.access_expires_at) - Date.now() - 365 * DAY) < 60_000);

  const again = await redeem(BOB, code);
  assert.deepEqual(again, { ok: false, error: "That code has already been redeemed." });
  assert.equal(await expiryOf(BOB), undefined);

  const { rows } = await db.query("select redeemed_by, redeemed_at from public.access_codes where code = $1", [code]);
  assert.equal(rows[0].redeemed_by, ALICE);
  assert.ok(rows[0].redeemed_at);
});

test("a second code stacks onto the remaining time", async () => {
  const before = new Date(await expiryOf(ALICE));
  const [code] = await issue(1);
  const r = await redeem(ALICE, code);
  assert.equal(r.ok, true, r.error);
  assert.equal(new Date(r.access_expires_at) - before, 365 * DAY);
});

test("an expired entitlement restarts from today, not from the old end date", async () => {
  await db.query("insert into public.entitlements (user_id, access_expires_at, plan) values ($1, now() - interval '30 days', '12m')", [BOB]);
  const [code] = await issue(1);
  const r = await redeem(BOB, code);
  assert.equal(r.ok, true, r.error);
  assert.ok(Math.abs(new Date(r.access_expires_at) - Date.now() - 365 * DAY) < 60_000);
});

test("unknown, revoked and out-of-window codes are refused", async () => {
  assert.equal((await redeem(ALICE, "PY12-AAAA-AAAA")).error, "That code doesn't exist. Check it and try again.");
  assert.equal((await redeem(ALICE, "not a code")).error, "That code doesn't exist. Check it and try again.");

  const [revoked, stale] = await issue(2);
  await db.query("update public.access_codes set revoked = true where code = $1", [revoked]);
  assert.match((await redeem(ALICE, revoked)).error, /cancelled/);

  await db.query("update public.access_codes set redeem_by = now() - interval '1 day' where code = $1", [stale]);
  assert.match((await redeem(ALICE, stale)).error, /expired/);
});

test("signed-out and anonymous callers can't redeem", async () => {
  const [code] = await issue(1);
  await assert.rejects(
    as("anon", null, (tx) => tx.query("select public.redeem_access_code($1)", [code])),
    /permission denied/,
  );
  const r = await redeem(GHOST, code, { anonymous: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /Create an account/);
  assert.equal(await expiryOf(GHOST), undefined);
});

test("redeeming is limited to 10 attempts an hour per user, and failures count", async () => {
  const carol = "00000000-0000-4000-8000-0000000000cc";
  await db.query("insert into auth.users (id) values ($1)", [carol]);
  for (let i = 0; i < 10; i++) assert.match((await redeem(carol, "PY12-AAAA-AAAA")).error, /doesn't exist/);
  const [code] = await issue(1);
  assert.match((await redeem(carol, code)).error, /Too many attempts/);
  assert.equal(await expiryOf(carol), undefined);

  await db.query("update public.rate_limits set window_start = now() - interval '61 minutes' where key = $1", [`redeem:${carol}`]);
  assert.equal((await redeem(carol, code)).ok, true);
});

test("an Etsy order can be claimed once, and its codes are recorded against it", async () => {
  const codes = await issue(3, "3141592653");
  assert.equal(codes.length, 3);
  assert.equal(await issue(1, "3141592653"), null);

  const { rows } = await db.query("select codes from public.etsy_claims where receipt_id = '3141592653'");
  assert.deepEqual(rows[0].codes, codes);
  const tagged = await db.query("select count(*)::int as n from public.access_codes where etsy_receipt_id = '3141592653' and source = 'etsy'");
  assert.equal(tagged.rows[0].n, 3);
});

test("issue_access_codes rejects silly counts", async () => {
  await assert.rejects(issue(0), /between 1 and 50/);
  await assert.rejects(issue(51), /between 1 and 50/);
});

test("clients can read their own entitlement and nothing else", async () => {
  const mine = await as("authenticated", ALICE, (tx) => tx.query("select user_id from public.entitlements"));
  assert.deepEqual(mine.rows.map((r) => r.user_id), [ALICE]);

  for (const table of ["access_codes", "etsy_claims", "rate_limits", "etsy_auth", "etsy_oauth_states"]) {
    const { rows } = await as("authenticated", ALICE, (tx) => tx.query(`select * from public.${table}`));
    assert.equal(rows.length, 0, `${table} should be invisible`);
  }
  const anonView = await as("anon", null, (tx) => tx.query("select * from public.entitlements"));
  assert.equal(anonView.rows.length, 0);
});

test("clients can't grant themselves access or mint codes", async () => {
  const before = await expiryOf(ALICE);
  const upd = await as("authenticated", ALICE, (tx) =>
    tx.query("update public.entitlements set access_expires_at = now() + interval '100 years' where user_id = $1", [ALICE]));
  assert.equal(upd.affectedRows, 0);
  assert.deepEqual(await expiryOf(ALICE), before);

  await assert.rejects(
    as("authenticated", BOB, (tx) => tx.query("insert into public.entitlements (user_id, access_expires_at, plan) values ($1, now() + interval '9 years', '12m')", [BOB])),
    /row-level security/,
  );
  await assert.rejects(
    as("authenticated", BOB, (tx) => tx.query("insert into public.access_codes (code, duration_days, source, redeem_by) values ('PY12-HACK-HACK', 365, 'admin', now() + interval '1 year')")),
    /row-level security/,
  );
  for (const call of ["select public.issue_access_codes(1)", "select public.consume_rate_limit('x', 1, 60)", "select public.generate_access_code()"]) {
    await assert.rejects(as("authenticated", BOB, (tx) => tx.query(call)), /permission denied/, call);
    await assert.rejects(as("anon", null, (tx) => tx.query(call)), /permission denied/, call);
  }
});

test("the service role (edge functions) can issue codes and use the rate limiter", async () => {
  const codes = await as("service_role", null, async (tx) => (await tx.query("select public.issue_access_codes(2, 'etsy', '999') as c")).rows[0].c);
  assert.equal(codes.length, 2);
  const ok = await as("service_role", null, async (tx) => (await tx.query("select public.consume_rate_limit('claim:ip:1.2.3.4', 5, 900) as ok")).rows[0].ok);
  assert.equal(ok, true);
});

test("deleting a user removes their entitlement but keeps the code history", async () => {
  const dave = "00000000-0000-4000-8000-0000000000dd";
  await db.query("insert into auth.users (id) values ($1)", [dave]);
  const [code] = await issue(1);
  assert.equal((await redeem(dave, code)).ok, true);
  await db.query("delete from auth.users where id = $1", [dave]);
  assert.equal(await expiryOf(dave), undefined);
  const { rows } = await db.query("select redeemed_by, redeemed_at from public.access_codes where code = $1", [code]);
  assert.equal(rows[0].redeemed_by, null);
  assert.ok(rows[0].redeemed_at, "still marked used, so it can't be redeemed again");
});
