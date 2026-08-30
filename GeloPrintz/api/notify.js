/* ============================================================
   AV Toys — "new review" email notification
   Vercel serverless function. Called by a Supabase Database Webhook
   when a row is INSERTed into public.reviews. Sends an email via Resend.

   Required Vercel environment variables:
     RESEND_API_KEY   – from https://resend.com (free tier is enough)
     WEBHOOK_SECRET   – any long random string; also set as an
                        "x-webhook-secret" header on the Supabase webhook
     SUPABASE_URL     – the project URL (to build the photo link)
   Optional:
     NOTIFY_TO        – recipient (default avtoys26@gmail.com)
     NOTIFY_FROM      – sender  (default "AV Toys <onboarding@resend.dev>")
   ============================================================ */
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
  }
  const r = (payload && payload.record) || {};

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: true, skipped: "RESEND_API_KEY not set" });
    return;
  }

  const base = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const photo = r.photo_path && base
    ? base + "/storage/v1/object/public/review-photos/" + r.photo_path
    : "(no photo)";

  const html =
    '<h2 style="font-family:sans-serif">New review — ' + escapeHtml(r.rating) + "&#9733;</h2>" +
    '<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">' +
      "<tr><td><b>Name</b></td><td>" + escapeHtml(r.name) + "</td></tr>" +
      "<tr><td><b>Order</b></td><td>" + escapeHtml(r.order_number) + "</td></tr>" +
      "<tr><td><b>Rating</b></td><td>" + escapeHtml(r.rating) + " / 5</td></tr>" +
      (r.title ? "<tr><td><b>Title</b></td><td>" + escapeHtml(r.title) + "</td></tr>" : "") +
    "</table>" +
    (r.body ? "<p style='font-family:sans-serif;font-size:14px'>" + escapeHtml(r.body).replace(/\n/g, "<br>") + "</p>" : "") +
    '<p style="font-family:sans-serif;font-size:14px"><b>Photo:</b> <a href="' + photo + '">' + photo + "</a></p>" +
    '<p style="font-family:sans-serif;font-size:13px;color:#666">Approve or reject it on the admin page.</p>';

  try {
    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || "AV Toys <onboarding@resend.dev>",
        to: process.env.NOTIFY_TO || "avtoys26@gmail.com",
        subject: "New review — " + (r.rating || "?") + "★ — Order " + (r.order_number || "?"),
        html: html
      })
    });
    const out = await send.json().catch(function () { return {}; });
    res.status(send.ok ? 200 : 502).json({ ok: send.ok, resend: out });
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) });
  }
};
