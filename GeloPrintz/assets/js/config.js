/* AV Toys — public runtime config.

   The Supabase URL and publishable ("anon") key below are SAFE to ship in
   the browser. The publishable key can only do what the Row Level Security
   policies in supabase/schema.sql allow: submit a review as "pending", and
   read reviews that have been "approved". Nothing else.

   Secret keys (Resend, the webhook secret, any service_role key) live ONLY
   in Vercel environment variables and never in this repo.

   Handing the site to someone else? They swap these two values for their
   own Supabase project and redeploy — see HANDOFF.md. */
window.AV_CONFIG = {
  SUPABASE_URL: "https://ybidbolicepyatbtrozw.supabase.co",
  SUPABASE_KEY: "sb_publishable_mwy-353lnLIbu1-I_JMROg_Ow6vpPX-"
};
