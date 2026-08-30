/* ============================================================
   AV Toys — customer reviews (Supabase-backed)
   - Displays APPROVED reviews on /review and the homepage teaser
   - Submits new reviews (order # + photo + 1–5 stars required) to Supabase
     as "pending"; a photo goes to the "review-photos" storage bucket
   Loaded on index.html and review.html, after supabase-js + config.js + main.js.
   Moderation happens on /admin. Schema + policies: supabase/schema.sql
   ============================================================ */
(function () {
  "use strict";

  var cfg = window.AV_CONFIG || {};
  var sb = (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_KEY)
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY)
    : null;
  var BUCKET = "review-photos";
  var MAILTO = "avtoys26@gmail.com";

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function clampRating(n) {
    n = parseInt(n, 10);
    return isNaN(n) ? 0 : Math.max(0, Math.min(5, n));
  }
  function starsHTML(n) {
    n = clampRating(n);
    var out = "";
    for (var i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? "on" : "") + '">★</i>';
    return out;
  }
  function maskOrder(o) {
    o = String(o || "").trim().replace(/\s+/g, "");
    return o ? "Order #…" + esc(o.slice(-4)) : "";
  }
  function fmtDate(d) {
    var t = Date.parse(d);
    if (isNaN(t)) return "";
    try { return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }
  function photoUrl(path) {
    if (!sb || !path) return "";
    try { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }
    catch (e) { return ""; }
  }
  function averageOf(list) {
    if (!list.length) return 0;
    var s = list.reduce(function (a, r) { return a + clampRating(r.rating); }, 0);
    return Math.round((s / list.length) * 10) / 10;
  }

  /* ---------- card ---------- */
  function cardHTML(r) {
    var url = photoUrl(r.photo_path);
    var photo = url
      ? '<div class="review-card__photo" data-full="' + esc(url) + '">' +
          '<img src="' + esc(url) + '" alt="Customer photo of their AV Toys order" loading="lazy" />' +
        "</div>"
      : "";
    return '' +
      '<article class="review-card">' +
        photo +
        '<div class="review-card__body">' +
          '<div class="review-card__top">' +
            '<span class="review-card__name">' + esc(r.name || "Anonymous") + "</span>" +
            '<span class="review-card__date">' + fmtDate(r.created_at) + "</span>" +
          "</div>" +
          '<div class="stars" aria-label="' + clampRating(r.rating) + ' out of 5 stars">' + starsHTML(r.rating) + "</div>" +
          (r.title ? '<p class="review-card__title">' + esc(r.title) + "</p>" : "") +
          (r.body ? '<p class="review-card__text">' + esc(r.body) + "</p>" : "") +
          '<div class="review-card__foot">' +
            '<span class="badge badge--verified">Verified purchase</span>' +
            (r.order_number ? '<span class="review-card__order">' + maskOrder(r.order_number) + "</span>" : "") +
          "</div>" +
        "</div>" +
      "</article>";
  }

  /* ---------- load approved reviews ---------- */
  var _cache = null;
  function fetchApproved() {
    if (_cache) return Promise.resolve(_cache);
    if (!sb) return Promise.resolve([]);
    return sb.from("reviews")
      .select("id,created_at,name,order_number,rating,title,body,photo_path")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { console.warn("reviews load:", res.error.message); return []; }
        _cache = res.data || [];
        return _cache;
      })
      .catch(function (e) { console.warn("reviews load:", e); return []; });
  }

  /* ---------- homepage teaser ---------- */
  function renderTeaser() {
    var wrap = $("#reviewsTeaser");
    if (!wrap) return;
    var grid = $("#reviewsTeaserGrid", wrap);
    var summary = $("#reviewsTeaserSummary", wrap);
    fetchApproved().then(function (rows) {
      if (!rows.length) {
        if (summary) summary.textContent = "Be the first to review your AV Toys order.";
        if (grid) grid.innerHTML = "";
        return;
      }
      var avg = averageOf(rows);
      if (summary) {
        summary.innerHTML =
          '<span class="stars stars--lg" aria-hidden="true">' + starsHTML(Math.round(avg)) + "</span> " +
          "<strong>" + avg.toFixed(1) + "</strong> / 5 from " + rows.length +
          " verified " + (rows.length === 1 ? "review" : "reviews");
      }
      if (grid) grid.innerHTML = rows.slice(0, 3).map(cardHTML).join("");
    });
  }

  /* ---------- /review list + rating summary ---------- */
  function renderList() {
    var list = $("#reviewsList");
    if (!list) return;
    fetchApproved().then(function (rows) {
      var ratebar = $("#ratebar");
      if (ratebar) {
        if (rows.length) {
          var avg = averageOf(rows);
          ratebar.hidden = false;
          ratebar.innerHTML =
            '<span class="ratebar__score">' + avg.toFixed(1) + "</span>" +
            '<div class="ratebar__meta">' +
              '<span class="stars stars--lg" aria-hidden="true" style="color:var(--red-bright)">' + starsHTML(Math.round(avg)) + "</span>" +
              "<span>" + rows.length + " verified " + (rows.length === 1 ? "review" : "reviews") + "</span>" +
            "</div>";
        } else {
          ratebar.hidden = true;
        }
      }
      list.innerHTML = rows.length
        ? rows.map(cardHTML).join("")
        : '<div class="reviews-empty">No reviews published yet — be the first to leave one below.</div>';
    });
  }

  /* ---------- lightbox for review photos ---------- */
  function initLightbox() {
    var lb = $("#revLightbox");
    if (!lb) return;
    var img = $("#revLbImg", lb);
    var close = $("#revLbClose", lb);
    var lastFocus = null;
    function open(src) {
      lastFocus = document.activeElement;
      img.src = src;
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      close.focus();
    }
    function shut() {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      img.src = "";
      if (lastFocus) lastFocus.focus();
    }
    document.addEventListener("click", function (e) {
      var ph = e.target.closest && e.target.closest(".review-card__photo");
      if (ph && ph.dataset.full) open(ph.dataset.full);
    });
    close.addEventListener("click", shut);
    lb.addEventListener("click", function (e) { if (e.target === lb) shut(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lb.classList.contains("is-open")) shut();
    });
  }

  /* ---------- submission form ---------- */
  function initForm() {
    var form = $("#reviewForm");
    if (!form) return;

    var note = $("#reviewNote");
    var submitBtn = $("#reviewSubmit");
    var orderInput = $('[name="order"]', form);
    var nameInput = $('[name="name"]', form);
    var titleInput = $('[name="title"]', form);
    var textInput = $('[name="text"]', form);
    var photoInput = $("#reviewPhoto", form);
    var drop = $("#reviewDrop", form);
    var preview = $("#reviewPreview", form);
    var previewImg = $("img", preview);
    var clearBtn = $("#reviewPhotoClear", form);
    var errOrder = $("#errOrder", form);
    var errRating = $("#errRating", form);
    var errPhoto = $("#errPhoto", form);
    var errName = $("#errName", form);

    var state = { blob: null, name: "" };

    function rating() {
      var c = $('input[name="rating"]:checked', form);
      return c ? clampRating(c.value) : 0;
    }
    function valid() {
      return rating() >= 1 && orderInput.value.trim() && state.blob && nameInput.value.trim();
    }
    function refresh() {
      if (submitBtn) submitBtn.setAttribute("aria-disabled", valid() ? "false" : "true");
    }
    function showErrors() {
      errRating.textContent = rating() >= 1 ? "" : "Please pick a star rating.";
      errOrder.textContent = orderInput.value.trim() ? "" : "Order number is required.";
      errPhoto.textContent = state.blob ? "" : "A photo of your item is required.";
      errName.textContent = nameInput.value.trim() ? "" : "Please add your name.";
    }

    // downscale to a JPEG blob for upload
    function compress(file) {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var im = new Image();
        im.onload = function () {
          var scale = Math.min(1, 1400 / im.width);
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(im.width * scale));
          c.height = Math.max(1, Math.round(im.height * scale));
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { resolve(b); }, "image/jpeg", 0.82);
        };
        im.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        im.src = url;
      });
    }

    function handleFile(file) {
      if (!file || !/^image\//.test(file.type)) {
        errPhoto.textContent = "That file isn't an image — please choose a photo.";
        return;
      }
      state.name = file.name || "photo.jpg";
      compress(file).then(function (blob) {
        state.blob = blob || null;
        if (blob) {
          previewImg.src = URL.createObjectURL(blob);
          preview.classList.add("is-shown");
          errPhoto.textContent = "";
        }
        refresh();
      });
    }

    photoInput.addEventListener("change", function () {
      if (photoInput.files && photoInput.files[0]) handleFile(photoInput.files[0]);
    });
    clearBtn.addEventListener("click", function () {
      state.blob = null; state.name = "";
      photoInput.value = "";
      previewImg.src = "";
      preview.classList.remove("is-shown");
      refresh();
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    $$('input[name="rating"]', form).forEach(function (r) {
      r.addEventListener("change", function () { errRating.textContent = ""; refresh(); });
    });
    refresh();

    function mailtoFallback(r) {
      var body = [
        "New customer review for AV Toys", "",
        "Rating: " + r.rating + " / 5",
        "Name: " + r.name,
        "Order number: " + r.order,
        r.title ? "Title: " + r.title : null, "",
        "Review:", r.text || "(no written review)", "",
        '⚠ Photo "' + state.name + '" — please attach it to this email before sending.'
      ].filter(function (l) { return l !== null; }).join("\n");
      window.location.href = "mailto:" + MAILTO +
        "?subject=" + encodeURIComponent("New review — " + r.rating + "★ — Order " + r.order) +
        "&body=" + encodeURIComponent(body);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      showErrors();
      if (!valid()) {
        note.textContent = "Please add a star rating, your order number, your name and a photo of your item.";
        note.className = "cform__note is-err";
        var fe = $(".field-error:not(:empty)", form);
        if (fe) fe.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      var r = {
        name: nameInput.value.trim(),
        order: orderInput.value.trim(),
        rating: rating(),
        title: titleInput.value.trim(),
        text: textInput.value.trim()
      };

      // No backend reachable → fall back to the old email flow so nothing is lost
      if (!sb) { mailtoFallback(r); note.textContent = "Opening your email app…"; note.className = "cform__note is-ok"; return; }

      note.textContent = "Sending your review…";
      note.className = "cform__note";
      if (submitBtn) submitBtn.setAttribute("aria-disabled", "true");

      var path = "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + ".jpg";

      sb.storage.from(BUCKET).upload(path, state.blob, { contentType: "image/jpeg", upsert: false })
        .then(function (up) {
          if (up.error) throw up.error;
          // NOTE: no .select() here — RLS hides the pending row from the anon key,
          // and chaining .select() would surface a false error.
          return sb.from("reviews").insert({
            name: r.name,
            order_number: r.order,
            rating: r.rating,
            title: r.title || null,
            body: r.text || null,
            photo_path: path
          });
        })
        .then(function (ins) {
          if (ins.error) throw ins.error;
          note.innerHTML = "Thanks, " + esc(r.name) + "! Your review has been submitted and will appear here once the AV Toys team verifies your order number and photo.";
          note.className = "cform__note is-ok";
          form.reset();
          state.blob = null; state.name = "";
          preview.classList.remove("is-shown");
          previewImg.src = "";
          refresh();
        })
        .catch(function (err) {
          console.warn("review submit:", err);
          note.textContent = "Sorry — that didn't send. Please try again, or email " + MAILTO + " with your order number and photo.";
          note.className = "cform__note is-err";
          refresh();
        });
    });
  }

  /* ---------- go ---------- */
  function init() {
    renderTeaser();
    renderList();
    initLightbox();
    initForm();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
