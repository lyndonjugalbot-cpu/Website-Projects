/* =========================================================================
   Lyndon Jugalbot — portfolio
   Renders the project grid, filtering, scroll-reveal, count-up, mobile nav.
   Add a project by dropping an object into PROJECTS below.
   ========================================================================= */

(function () {
  "use strict";

  /** @typedef {"app"|"site"|"tool"} Category */

  /**
   * type   — one of: "app" (full-stack), "site" (marketing), "tool" (utility/data)
   * thumb  — screenshot in assets/img/thumbs/, or null
   * live   — public URL, or null
   * source — repo/subfolder URL, or null
   */
  const PROJECTS = [
    {
      name: "Wots Diagram Generator",
      type: "tool",
      category: "Diagramming tool",
      blurb:
        "A form-to-diagram generator for developers: describe entities, use cases, classes, or activity flows as plain lines of text and get a diagram back. Auto-laid-out with dagre, then fully reworkable on a React Flow canvas — drag nodes, redraw connections — and exportable straight to PNG or SVG.",
      meta: "Personal tool · text in, editable diagram out",
      tags: ["React", "Vite", "React Flow", "dagre", "Firebase Hosting"],
      thumb: "assets/img/thumbs/diagrammaker.webp",
      live: "https://wots-diagram-generator.web.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/DiagramMaker",
    },
    {
      name: "Coaching Log & Metric Tracker",
      type: "app",
      category: "Coaching platform",
      blurb:
        "A coaching and metrics platform for tracking client sessions and health data over time — session logs, per-client metric history, and an agent self-service layer with profiles, passwords, and stats, all synced in real time.",
      meta: "Client project · coaching workflow + live metrics",
      tags: ["React", "Convex", "Real-time sync", "Firebase Hosting"],
      thumb: "assets/img/thumbs/hrvtools.webp",
      live: "https://hrvtools-app-28b2b.web.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/HRVTools",
    },
    {
      name: "NZ Finance Tracker",
      type: "app",
      category: "Web + mobile app",
      blurb:
        "A responsive personal spending and budget tracker for New Zealand. Log daily purchases, browse months of history, and generate weekly or monthly reports with charts — synced in real time across every device via Convex. The same build ships as native iOS and Android apps through Capacitor.",
      meta: "Personal product · real-time sync, native wrappers",
      tags: ["React 19", "TypeScript", "Tailwind v4", "Convex", "Recharts", "Capacitor"],
      thumb: "assets/img/thumbs/financetracker.webp",
      live: "https://nz-finance-tracker.web.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/NZFinanceTracker",
    },
    {
      name: "Wots TCG Vault NZ",
      type: "app",
      category: "Marketplace",
      blurb:
        "A black-and-gold marketplace for buying and selling Pokémon cards, sealed product, and graded slabs across New Zealand — listings, orders, marketplace payments and seller payouts, disputes, and a buyer-protection inspection window.",
      meta: "Solo build · data model → payouts → admin tooling",
      tags: ["Next.js 15", "TypeScript", "Prisma", "PostgreSQL", "Stripe Connect", "NextAuth", "S3 / R2", "Resend"],
      thumb: "assets/img/thumbs/tcgvault.webp",
      live: "https://wots-tcg-vault-nz.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/WotsTCGVaultNZ",
    },
    {
      name: "Self Leveling",
      type: "app",
      category: "Training program",
      blurb:
        "A 66-day training program framed as \"the System\" from Solo Leveling — a Daily Quest to clear for XP, stat growth across six tracks, rank-ups from E to S, and a Penalty Quest if you miss a day. Full dungeon/HUD theme, native iOS and Android wrappers, and optional cloud sync.",
      meta: "Personal product · gamified habit engine",
      tags: ["React", "Vite", "Capacitor", "Supabase", "Firebase Hosting"],
      thumb: "assets/img/thumbs/selfleveling.webp",
      live: "https://wots-selfleveling.web.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/SelfLeveling",
    },
    {
      name: "PyWots — Master Python",
      type: "app",
      category: "Learning platform",
      blurb:
        "A 100-day gamified course that teaches Python the same \"System\" way — daily lessons with real code graded in-browser via Pyodide, XP and rank-ups, a daily quest reminder, and progress synced to an account. Ships as a web app and native iOS/Android builds from the same codebase.",
      meta: "Personal product · 100 days, real graded code",
      tags: ["React", "Vite", "Pyodide", "Capacitor", "Supabase"],
      thumb: "assets/img/thumbs/pywots.webp",
      live: "https://pywots.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/PyWots",
    },
    {
      name: "WOTS Creative Studio",
      type: "site",
      category: "Marketing site",
      blurb:
        "A portfolio site for a hand-drawn illustration and packaging design studio — original character art, mythology-grade series, and shelf-ready product packaging, built to make the point up front: every line sketched, inked, and colored by a real artist, no AI.",
      meta: "Personal brand · static site, no build step",
      tags: ["HTML / CSS / JS", "Responsive", "Vercel"],
      thumb: "assets/img/thumbs/artstudio.webp",
      live: "https://wots-creative-studio.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/WCS",
    },
    {
      name: "Virtual Bridge PH",
      type: "site",
      category: "Agency site + portal",
      blurb:
        "Marketing site for an offshore staffing agency placing Filipino talent with growing businesses — six service lines, a four-step hiring flow, and headline stats. Wired to an email enquiry form, an Upwork agency profile, plus a separate client portal with a payment page and a downloadable time tracker.",
      meta: "Client project · public site + client portal",
      tags: ["HTML / CSS / JS", "Responsive", "Email form", "Vercel"],
      thumb: "assets/img/thumbs/vaagency.webp",
      live: "https://virtual-bridge-ph.vercel.app",
      source: null,
    },
    {
      name: "Web App Timer",
      type: "tool",
      category: "Time tracker",
      blurb:
        "A no-account browser time tracker: start a live timer per task or log entries by hand, with totals rolled up by day, week, and project — everything stored locally in the browser. Optional opt-in screenshot capture gives a visual log of a work session without any of it leaving the device.",
      meta: "Personal tool · local-only, zero backend",
      tags: ["Vanilla JS", "localStorage", "IndexedDB", "Firebase Hosting"],
      thumb: "assets/img/thumbs/webapptimer.webp",
      live: "https://wots-webapptimer.web.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/WebAppTimer",
    },
  ];

  /* ---------- Render cards ------------------------------------------------- */

  const grid = document.getElementById("project-grid");

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildCard(p) {
    const li = el("li", "card reveal");
    li.dataset.type = p.type;

    if (p.thumb) {
      const thumb = el("div", "card__thumb");
      const img = document.createElement("img");
      img.src = p.thumb;
      img.alt = p.name + " — screenshot";
      img.loading = "lazy";
      img.width = 640;
      img.height = 400;
      thumb.append(img);
      li.append(thumb);
    }

    const top = el("div", "card__top");
    top.append(el("span", "card__cat", p.category));
    li.append(top);

    li.append(el("h3", "card__title", p.name));
    li.append(el("p", "card__blurb", p.blurb));

    const meta = el("p", "card__meta");
    meta.innerHTML = "<strong>" + p.meta.split(" · ")[0] + "</strong> · " +
      p.meta.split(" · ").slice(1).join(" · ");
    li.append(meta);

    const tags = el("ul", "card__tags");
    tags.setAttribute("aria-label", "Tech used");
    p.tags.forEach((t) => {
      const tag = el("li", "card__tag", t);
      tags.append(tag);
    });
    li.append(tags);

    const links = el("div", "card__links");
    if (p.live) {
      const a = el("a", "card__link card__link--live", "Access ↗");
      a.href = p.live;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", "Open " + p.name + " — opens in a new tab, switch back any time");
      links.append(a);
    }
    if (p.source) {
      const a = el("a", "card__link", "Source ↗");
      a.href = p.source;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", p.name + " source code");
      links.append(a);
    }
    li.append(links);

    return li;
  }

  if (grid) {
    const frag = document.createDocumentFragment();
    PROJECTS.forEach((p) => frag.append(buildCard(p)));
    grid.append(frag);
  }

  /* ---------- Filtering -------------------------------------------------- */

  const chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  const cards = Array.prototype.slice.call(document.querySelectorAll(".card"));

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter;

      chips.forEach((c) => {
        const active = c === chip;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", String(active));
      });

      cards.forEach((card) => {
        const show = filter === "all" || card.dataset.type === filter;
        card.classList.toggle("is-hidden", !show);
      });
    });
  });

  /* ---------- Scroll reveal -------------------------------------------------- */

  const reveals = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((r) => r.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach((r) => io.observe(r));
  }

  /* ---------- Count-up stats --------------------------------------------- */

  const counters = document.querySelectorAll("[data-count]");
  if (!reduceMotion && "IntersectionObserver" in window && counters.length) {
    const countIO = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          const target = parseInt(node.dataset.count, 10) || 0;
          const start = performance.now();
          const dur = 900;

          function tick(now) {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            node.textContent = String(Math.round(eased * target));
            if (t < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          obs.unobserve(node);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => countIO.observe(c));
  }

  /* ---------- Header shadow on scroll ------------------------------------ */

  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile nav ------------------------------------------------- */

  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("nav-menu");

  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", (e) => {
      if (e.target.tagName === "A") setOpen(false);
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ---------- Copy-to-clipboard (email) -------------------------------- */

  document.querySelectorAll(".contact__copy").forEach((btn) => {
    const value = btn.dataset.copy || "";
    const label = btn.textContent;
    btn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          const ta = document.createElement("textarea");
          ta.value = value;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
      } catch (e) {
        btn.textContent = "Press ⌘/Ctrl+C";
      }
      window.setTimeout(() => {
        btn.textContent = label;
        btn.classList.remove("is-copied");
      }, 2000);
    });
  });

  /* ---------- Footer year ---------------------------------------------- */

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
