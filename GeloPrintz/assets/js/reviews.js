/* ============================================================
   AV Toys — customer reviews
   - Displays published reviews on /review and the homepage teaser
   - Handles the submission form (order # + photo + star rating required)
   Loaded on index.html and review.html, after main.js.
   ============================================================ */
(function () {
  "use strict";

  /* -----------------------------------------------------------------
     PUBLISHED REVIEWS  —  this list is what shows publicly.
     To publish a customer's review: check their order number and the
     photo they sent, drop their photo into assets/img/reviews/, add an
     entry below (newest first), then commit + push. It goes live on the
     next deploy.

       name     – display name, e.g. "Marco D."
       order    – their order number (shown on the card as the last 4)
       rating   – whole number, 1 to 5
       date     – "YYYY-MM-DD"
       title    – short headline (optional)
       text     – the review body
       photo    – path to their photo, e.g. "assets/img/reviews/av1043.jpg"
       verified – true once you've matched the order number + photo
     ----------------------------------------------------------------- */
  var PUBLISHED = [
    // {
    //   name: "Marco D.",
    //   order: "AV1043",
    //   rating: 5,
    //   date: "2026-07-14",
    //   title: "Better than the promo photos",
    //   text: "The paint blending on the face is unreal and the base survived shipping without a scratch. Packaging was heavy-duty.",
    //   photo: "assets/img/reviews/av1043.jpg",
    //   verified: true
    // }
  ];

  window.AV_REVIEWS = (window.AV_REVIEWS || []).concat(PUBLISHED);

  var PENDING_KEY = "av_pending_reviews";
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
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(5, n));
  }
  function starsHTML(n) {
    n = clampRating(n);
    var out = "";
    for (var i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? "on" : "") + '">★</i>';
    return out;
  }
  function maskOrder(o) {
    o = String(o || "").trim();
    if (!o) return "";
    var tail = o.replace(/\s+/g, "").slice(-4);
    return "Order #…" + esc(tail);
  }
  function fmtDate(d) {
    var t = Date.parse(d);
    if (isNaN(t)) return esc(d || "");
    try {
      return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return esc(d); }
  }
  function getPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; }
    catch (e) { return []; }
  }
  function setPending(list) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-5))); }
    catch (e) { /* quota / disabled — pending just won't persist */ }
  }

  /* ---------- card rendering ---------- */
  function cardHTML(r, opts) {
    opts = opts || {};
    var badge = r.pending
      ? '<span class="badge badge--pending">Pending approval</span>'
      : (r.verified ? '<span class="badge badge--verified">Verified purchase</span>' : "");
    var photo = r.photo
      ? '<div class="review-card__photo" data-full="' + esc(r.photo) + '">' +
          '<img src="' + esc(r.photo) + '" alt="Customer photo of their AV Toys order" loading="lazy" />' +
        "</div>"
      : "";
    var title = r.title ? '<p class="review-card__title">' + esc(r.title) + "</p>" : "";
    var text = r.text ? '<p class="review-card__text">' + esc(r.text) + "</p>" : "";
    return '' +
      '<article class="review-card">' +
        photo +
        '<div class="review-card__body">' +
          '<div class="review-card__top">' +
            '<span class="review-card__name">' + esc(r.name || "Anonymous") + "</span>" +
            '<span class="review-card__date">' + fmtDate(r.date) + "</span>" +
          "</div>" +
          '<div class="stars" aria-label="' + clampRating(r.rating) + ' out of 5 stars">' + starsHTML(r.rating) + "</div>" +
          title + text +
          '<div class="review-card__foot">' +
            badge +
            (r.order ? '<span class="review-card__order">' + maskOrder(r.order) + "</span>" : "") +
          "</div>" +
        "</div>" +
      "</article>";
  }

  function averageOf(list) {
    if (!list.length) return 0;
    var sum = list.reduce(function (a, r) { return a + clampRating(r.rating); }, 0);
    return Math.round((sum / list.length) * 10) / 10;
  }

  /* ---------- homepage teaser ---------- */
  function renderTeaser() {
    var wrap = $("#reviewsTeaser");
    if (!wrap) return;
    var approved = window.AV_REVIEWS.slice();
    var grid = $("#reviewsTeaserGrid", wrap);
    var summary = $("#reviewsTeaserSummary", wrap);

    if (!approved.length) {
      if (summary) summary.textContent = "Be the first to review your AV Toys order.";
      if (grid) grid.innerHTML = "";
      return;
    }
    var avg = averageOf(approved);
    if (summary) {
      summary.innerHTML =
        '<span class="stars stars--lg" aria-hidden="true">' + starsHTML(Math.round(avg)) + "</span> " +
        "<strong>" + avg.toFixed(1) + "</strong> / 5 from " + approved.length +
        " verified " + (approved.length === 1 ? "review" : "reviews");
    }
    if (grid) grid.innerHTML = approved.slice(0, 3).map(function (r) { return cardHTML(r); }).join("");
  }

  /* ---------- /review list ---------- */
  function renderList() {
    var list = $("#reviewsList");
    if (!list) return;
    var approved = window.AV_REVIEWS.slice();
    var pending = getPending();

    var ratebar = $("#ratebar");
    if (ratebar) {
      if (approved.length) {
        var avg = averageOf(approved);
        ratebar.hidden = false;
        ratebar.innerHTML =
          '<span class="ratebar__score">' + avg.toFixed(1) + "</span>" +
          '<div class="ratebar__meta">' +
            '<span class="stars stars--lg" aria-hidden="true" style="color:var(--red-bright)">' + starsHTML(Math.round(avg)) + "</span>" +
            "<span>" + approved.length + " verified " + (approved.length === 1 ? "review" : "reviews") + "</span>" +
          "</div>";
      } else {
        ratebar.hidden = true;
      }
    }

    var html = "";
    if (pending.length) {
      html += pending.slice().reverse().map(function (r) { return cardHTML(r, { pending: true }); }).join("");
    }
    if (approved.length) {
      html += approved.map(function (r) { return cardHTML(r); }).join("");
    }
    if (!html) {
      html = '<div class="reviews-empty">No reviews published yet — be the first to leave one below.</div>';
    }
    list.className = "reviews-grid" + ((approved.length + pending.length) ? "" : "");
    list.innerHTML = html;

    var pn = $("#pendingNote");
    if (pn) pn.hidden = !pending.length;
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

    var state = { photoDataUrl: "", photoName: "" };

    function rating() {
      var checked = $('input[name="rating"]:checked', form);
      return checked ? clampRating(checked.value) : 0;
    }
    function valid() {
      return rating() >= 1 && orderInput.value.trim() !== "" && !!state.photoDataUrl && nameInput.value.trim() !== "";
    }
    // The submit button stays enabled (so screen readers can reach it and the
    // on-submit errors can fire); requirements are enforced in the submit handler.
    function refresh() {
      if (submitBtn) submitBtn.setAttribute("aria-disabled", valid() ? "false" : "true");
    }
    function showErrors() {
      errRating.textContent = rating() >= 1 ? "" : "Please pick a star rating.";
      errOrder.textContent = orderInput.value.trim() ? "" : "Order number is required.";
      errPhoto.textContent = state.photoDataUrl ? "" : "A photo of your item is required.";
      errName.textContent = nameInput.value.trim() ? "" : "Please add your name.";
    }

    // downscale the chosen image so previews / pending storage stay small
    function compress(file, maxW, quality) {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var image = new Image();
        image.onload = function () {
          var scale = Math.min(1, maxW / image.width);
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          try { resolve(canvas.toDataURL("image/jpeg", quality)); }
          catch (e) { resolve(""); }
        };
        image.onerror = function () { URL.revokeObjectURL(url); resolve(""); };
        image.src = url;
      });
    }

    function handleFile(file) {
      if (!file || !/^image\//.test(file.type)) {
        errPhoto.textContent = "That file isn't an image — please choose a photo.";
        return;
      }
      state.photoName = file.name || "photo.jpg";
      compress(file, 1200, 0.82).then(function (dataUrl) {
        state.photoDataUrl = dataUrl || "";
        if (dataUrl) {
          previewImg.src = dataUrl;
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
      state.photoDataUrl = ""; state.photoName = "";
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

    form.addEventListener("change", refresh);
    form.addEventListener("input", refresh);
    $$('input[name="rating"]', form).forEach(function (r) {
      r.addEventListener("change", function () { errRating.textContent = ""; refresh(); });
    });
    refresh();

    function buildMailto(r) {
      var body = [
        "New customer review for AV Toys",
        "",
        "Rating: " + r.rating + " / 5",
        "Name: " + r.name,
        "Order number: " + r.order,
        r.title ? "Title: " + r.title : null,
        "",
        "Review:",
        r.text || "(no written review)",
        "",
        '⚠ Photo: "' + state.photoName + '" — please attach this photo to the email before sending.',
        "It can't be attached automatically from the website."
      ].filter(function (l) { return l !== null; }).join("\n");
      return "mailto:" + MAILTO +
        "?subject=" + encodeURIComponent("New review — " + r.rating + "★ — Order " + r.order) +
        "&body=" + encodeURIComponent(body);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      showErrors();
      if (!valid()) {
        note.textContent = "Please add a star rating, your order number, your name and a photo of your item.";
        note.className = "cform__note is-err";
        var firstErr = $(".field-error:not(:empty)", form);
        if (firstErr) firstErr.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      var review = {
        name: nameInput.value.trim(),
        order: orderInput.value.trim(),
        rating: rating(),
        date: new Date().toISOString().slice(0, 10),
        title: titleInput.value.trim(),
        text: textInput.value.trim(),
        photo: state.photoDataUrl,
        pending: true,
        submittedAt: Date.now()
      };

      // show it to the customer straight away, marked pending
      var list = getPending();
      list.push(review);
      setPending(list);
      renderList();

      // send it to AV Toys — native share (carries the photo) or email
      var sent = false;
      try {
        var file = photoInput.files && photoInput.files[0];
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: "AV Toys review — Order " + review.order,
            text: review.rating + "/5 from " + review.name +
                  " (Order " + review.order + ")\n\n" + (review.text || "")
          }).then(function () { sent = true; }).catch(function () {
            window.location.href = buildMailto(review);
          });
          sent = true;
        }
      } catch (err) { /* fall through to mailto */ }
      if (!sent) window.location.href = buildMailto(review);

      note.innerHTML =
        "Thanks! Your review is shown below marked <b>pending</b> and has been sent to the AV Toys team. " +
        "It appears publicly once they verify your order number and photo.";
      note.className = "cform__note is-ok";

      form.reset();
      state.photoDataUrl = ""; state.photoName = "";
      preview.classList.remove("is-shown");
      previewImg.src = "";
      refresh();
      $("#reviewsList").scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  /* ---------- go ---------- */
  function init() {
    renderTeaser();
    renderList();
    initLightbox();
    initForm();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
