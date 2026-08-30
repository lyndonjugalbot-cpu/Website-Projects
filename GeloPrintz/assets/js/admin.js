/* ============================================================
   AV Toys — review moderation (admin.html)
   Signs in with Supabase Auth; RLS lets an authenticated user read
   every review and change its status. Not linked from the public site.
   ============================================================ */
(function () {
  "use strict";

  var cfg = window.AV_CONFIG || {};
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  var BUCKET = "review-photos";

  var $ = function (s) { return document.querySelector(s); };
  var loginForm = $("#loginForm");
  var loginNote = $("#loginNote");
  var app = $("#app");
  var logout = $("#logout");
  var listEl = $("#adminList");
  var noteEl = $("#adminNote");
  var tabs = $("#tabs");
  var current = "pending";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function stars(n) {
    n = Math.max(0, Math.min(5, parseInt(n, 10) || 0));
    var o = "";
    for (var i = 1; i <= 5; i++) o += '<i class="' + (i <= n ? "on" : "") + '">★</i>';
    return o;
  }
  function photoUrl(path) {
    try { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }
    catch (e) { return ""; }
  }

  function showApp(signedIn) {
    app.hidden = !signedIn;
    loginForm.hidden = signedIn;
    logout.hidden = !signedIn;
  }

  function rowHTML(r) {
    var url = photoUrl(r.photo_path);
    var actions = [];
    if (r.status !== "approved") actions.push('<button class="btn btn--sm btn--red" data-act="approve" data-id="' + r.id + '">Approve</button>');
    if (r.status !== "rejected") actions.push('<button class="btn btn--sm btn--ghost" data-act="reject" data-id="' + r.id + '">Reject</button>');
    actions.push('<button class="btn btn--sm btn--ghost" data-act="delete" data-id="' + r.id + '" data-path="' + esc(r.photo_path) + '">Delete</button>');
    return '' +
      '<article class="admin-card">' +
        (url ? '<a class="admin-card__photo" href="' + esc(url) + '" target="_blank" rel="noopener"><img src="' + esc(url) + '" alt="" loading="lazy" /></a>' : '<div class="admin-card__photo admin-card__photo--none">no photo</div>') +
        '<div class="admin-card__body">' +
          '<div class="stars">' + stars(r.rating) + '</div>' +
          '<p><b>' + esc(r.name) + '</b> &nbsp;·&nbsp; <span style="color:var(--muted)">Order ' + esc(r.order_number) + '</span> &nbsp;·&nbsp; <span style="color:var(--muted-2)">' + esc((r.created_at || "").slice(0, 10)) + '</span></p>' +
          (r.title ? '<p><b>' + esc(r.title) + '</b></p>' : '') +
          (r.body ? '<p style="color:var(--muted)">' + esc(r.body) + '</p>' : '') +
          '<p class="admin-card__status">status: <b>' + esc(r.status) + '</b></p>' +
          '<div class="admin-card__actions">' + actions.join("") + '</div>' +
        '</div>' +
      '</article>';
  }

  function load(status) {
    current = status;
    noteEl.textContent = "Loading…";
    listEl.innerHTML = "";
    sb.from("reviews").select("*").eq("status", status).order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { noteEl.textContent = "Error: " + res.error.message; return; }
        var rows = res.data || [];
        noteEl.textContent = rows.length + " " + status + " review" + (rows.length === 1 ? "" : "s");
        listEl.innerHTML = rows.map(rowHTML).join("") || '<p style="color:var(--muted-2)">Nothing here.</p>';
      });
  }

  function setStatus(id, status) {
    return sb.from("reviews").update({ status: status }).eq("id", id).then(function (res) {
      if (res.error) alert("Failed: " + res.error.message);
      load(current);
    });
  }
  function removeReview(id, path) {
    if (!confirm("Delete this review permanently?")) return;
    sb.from("reviews").delete().eq("id", id).then(function (res) {
      if (res.error) { alert("Failed: " + res.error.message); return; }
      if (path) sb.storage.from(BUCKET).remove([path]);
      load(current);
    });
  }

  listEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var id = b.dataset.id;
    if (b.dataset.act === "approve") setStatus(id, "approved");
    else if (b.dataset.act === "reject") setStatus(id, "rejected");
    else if (b.dataset.act === "delete") removeReview(id, b.dataset.path);
  });

  tabs.addEventListener("click", function (e) {
    var t = e.target.closest(".admin-tab");
    if (!t) return;
    if (t.id === "refresh") { load(current); return; }
    Array.prototype.forEach.call(tabs.querySelectorAll(".admin-tab"), function (x) { x.classList.remove("is-active"); });
    t.classList.add("is-active");
    load(t.dataset.status);
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginNote.textContent = "Signing in…";
    var fd = new FormData(loginForm);
    sb.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") }).then(function (res) {
      if (res.error) { loginNote.textContent = res.error.message; return; }
      loginNote.textContent = "";
      showApp(true);
      load("pending");
    });
  });

  logout.addEventListener("click", function () {
    sb.auth.signOut().then(function () { showApp(false); });
  });

  sb.auth.getSession().then(function (res) {
    var signedIn = !!(res.data && res.data.session);
    showApp(signedIn);
    if (signedIn) load("pending");
  });
})();
