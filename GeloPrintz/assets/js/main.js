/* ============================================================
   Gelo Printz — interactions
   ============================================================ */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Preloader ---------- */
  const dismissPreloader = () => {
    const pre = $("#preloader");
    if (pre) pre.classList.add("is-done");
  };
  window.addEventListener("load", () => setTimeout(dismissPreloader, 450));
  // Fallback: never trap the page behind the loader
  setTimeout(dismissPreloader, 2600);

  /* ---------- Year ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header stuck + scroll progress + to-top ---------- */
  const header = $("#siteHeader");
  const progress = $("#scrollProgress");
  const toTop = $("#toTop");

  const onScroll = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle("is-stuck", y > 40);
    if (toTop) toTop.classList.toggle("is-shown", y > 700);
    if (progress) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toTop) {
    toTop.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
    );
  }

  /* ---------- Mobile nav ---------- */
  const navToggle = $("#navToggle");
  const nav = $("#primaryNav");
  const closeNav = () => {
    if (!nav) return;
    nav.classList.remove("is-open");
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };
  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") closeNav();
    });
  }

  /* ---------- Smooth anchor scroll with header offset ---------- */
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$(".reveal");
  const revealAll = () => revealEls.forEach((el) => el.classList.add("is-visible"));
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));

    // Reveal anything already in or above the viewport on first paint
    // (covers deep links like /#contact and pre-JS hash jumps)
    const revealInView = () => {
      const vh = window.innerHeight;
      revealEls.forEach((el) => {
        if (el.getBoundingClientRect().top < vh * 0.92) {
          el.classList.add("is-visible");
          io.unobserve(el);
        }
      });
    };
    revealInView();
    requestAnimationFrame(() => requestAnimationFrame(revealInView));
    window.addEventListener("load", revealInView);
    window.addEventListener("hashchange", () => setTimeout(revealInView, 60));
    window.addEventListener("scroll", revealInView, { passive: true });
    // Final safety net — never leave content invisible
    setTimeout(revealAll, 1500);
  } else {
    revealAll();
  }

  /* ---------- Count-up stats ---------- */
  const counters = $$("[data-count]");
  const runCount = (el) => {
    const end = parseInt(el.dataset.count, 10) || 0;
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased) + (p === 1 && end >= 45 ? "+" : "");
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window && !reduceMotion) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    counters.forEach((el) => cio.observe(el));
    // Safety: settle any counter still at 0 that's already on screen
    setTimeout(() => {
      counters.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (el.textContent === "0" && r.top < window.innerHeight && r.bottom > 0) {
          runCount(el);
          cio.unobserve(el);
        }
      });
    }, 1800);
  } else {
    counters.forEach((el) => (el.textContent = el.dataset.count + (parseInt(el.dataset.count, 10) >= 45 ? "+" : "")));
  }

  /* ---------- Active nav link via section observer ---------- */
  const navLinks = $$('.nav > a[href^="#"]');
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const sio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = "#" + entry.target.id;
            navLinks.forEach((a) =>
              a.classList.toggle("is-active", a.getAttribute("href") === id)
            );
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => sio.observe(s));
  }

  /* ---------- Tilt effect ---------- */
  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    $$("[data-tilt]").forEach((el) => {
      const strength = 8;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          `perspective(900px) rotateX(${(-py * strength).toFixed(2)}deg) ` +
          `rotateY(${(px * strength).toFixed(2)}deg) translateY(-4px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ---------- Hero parallax ---------- */
  const heroFrame = $(".hero__frame");
  if (heroFrame && !reduceMotion) {
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          heroFrame.style.translate = "0 " + (y * 0.04).toFixed(1) + "px";
        }
      },
      { passive: true }
    );
  }

  /* ---------- Lightbox ---------- */
  const cards = $$("#gallery .card");
  const lb = $("#lightbox");
  const lbImg = $("#lbImg");
  const lbTitle = $("#lbTitle");
  const lbCaption = $("#lbCaption");
  let current = 0;
  let lastFocused = null;

  const items = cards.map((c) => ({
    full: c.dataset.full,
    title: c.dataset.title,
    caption: c.dataset.caption,
  }));

  const showItem = (i) => {
    current = (i + items.length) % items.length;
    const it = items[current];
    lbImg.src = it.full;
    lbImg.alt = it.title;
    lbTitle.textContent = it.title;
    lbCaption.textContent = it.caption;
  };

  const openLb = (i) => {
    lastFocused = document.activeElement;
    showItem(i);
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#lbClose").focus();
  };
  const closeLb = () => {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  };

  cards.forEach((c, i) => {
    c.addEventListener("click", () => openLb(i));
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLb(i);
      }
    });
  });

  if (lb) {
    $("#lbClose").addEventListener("click", closeLb);
    $("#lbPrev").addEventListener("click", () => showItem(current - 1));
    $("#lbNext").addEventListener("click", () => showItem(current + 1));
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closeLb();
    });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") showItem(current - 1);
      if (e.key === "ArrowRight") showItem(current + 1);
    });
  }

  /* ---------- Quote form → mailto ---------- */
  const form = $("#quoteForm");
  const note = $("#formNote");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const g = (k) => (data.get(k) || "").toString().trim();

      if (!g("name") || !g("email") || !g("subject")) {
        note.textContent = "Please add your name, email and the character you'd like.";
        note.classList.remove("is-ok");
        return;
      }

      const lines = [
        `Name: ${g("name")}`,
        `Email: ${g("email")}`,
        `Character / subject: ${g("subject")}`,
        `Scale / size: ${g("scale") || "—"}`,
        `Budget: ${g("budget") || "—"}`,
        `Deadline: ${g("deadline") || "—"}`,
        "",
        "Project details:",
        g("details") || "—",
      ];
      const subject = `Custom figure enquiry — ${g("subject")}`;
      const href =
        "mailto:avtoys26@gmail.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(lines.join("\n"));

      window.location.href = href;
      note.textContent = "Opening your email app… if nothing happens, email avtoys26@gmail.com directly.";
      note.classList.add("is-ok");
    });
  }
})();

