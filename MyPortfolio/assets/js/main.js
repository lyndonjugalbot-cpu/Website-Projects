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
   * live   — public URL, or null
   * source — repo/subfolder URL, or null
   */
  const PROJECTS = [
    {
      name: "Wots TCG Vault NZ",
      type: "app",
      category: "Marketplace",
      blurb:
        "A black-and-gold marketplace for buying and selling Pokémon cards, sealed product, and graded slabs across New Zealand — listings, orders, marketplace payments and seller payouts, disputes, and a buyer-protection inspection window.",
      meta: "Solo build · data model → payouts → admin tooling",
      tags: ["Next.js 15", "TypeScript", "Prisma", "PostgreSQL", "Stripe Connect", "NextAuth", "S3 / R2", "Resend"],
      live: "https://wots-tcg-vault-nz.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/WotsTCGVaultNZ",
    },
    {
      name: "Seoul Stop Kmart",
      type: "app",
      category: "E-commerce",
      blurb:
        "A Korean grocery storefront for Cebu, Philippines: product catalog, cart, and checkout with GCash / Maya / card via PayMongo, plus cash-on-delivery and bank transfer. Role-based admin dashboard with an in-store POS terminal, inventory ledger, and profit/loss reports.",
      meta: "Client project · storefront + staff back office",
      tags: ["Next.js 14", "TypeScript", "Tailwind", "Prisma", "PostgreSQL", "PayMongo", "Vercel Blob"],
      live: "https://website-projects-nine.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/Website1",
    },
    {
      name: "NZ Finance Tracker",
      type: "app",
      category: "Web + mobile app",
      blurb:
        "A responsive personal spending and budget tracker for New Zealand. Log daily purchases, browse three months of history, and generate weekly or monthly reports with charts — synced in real time across every device via Convex, no login. The same build ships as native iOS and Android apps through Capacitor.",
      meta: "Personal product · real-time sync, native wrappers",
      tags: ["React 19", "TypeScript", "Tailwind v4", "Convex", "Recharts", "Capacitor", "date-fns"],
      live: "https://nz-finance-tracker.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/NZFinanceTracker",
    },
    {
      name: "Virtual Bridge PH",
      type: "site",
      category: "Agency site + portal",
      blurb:
        "Marketing site for an offshore staffing agency placing Filipino talent with growing businesses — six service lines, a four-step hiring flow, and headline stats. Wired to an email enquiry form, an Upwork agency profile, plus a separate client portal with a payment page and a downloadable time tracker.",
      meta: "Client project · public site + client portal",
      tags: ["HTML / CSS / JS", "Responsive", "Email form", "Vercel"],
      live: "https://virtual-bridge-ph.vercel.app",
      source: null,
    },
    {
      name: "SSKTool — Purchase Forecast",
      type: "tool",
      category: "Forecasting tool",
      blurb:
        "Turns a POS \"Sales by Product\" export into a demand forecast and a supplier order recommendation for the coming month. Average daily demand with growth and seasonality factors, periodic-review reordering (reorder point, order-up-to level, pack rounding, MOQ), and ABC analysis. One engine behind two front ends: a 100%-in-browser web app and a stdlib-only Python CLI.",
      meta: "Internal tool · JS port kept line-for-line with the Python model",
      tags: ["Vanilla JS", "Python 3", "SpreadsheetML parsing", "CSV", "Vercel"],
      live: "https://ssktoolv10.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/SSKTool",
    },
    {
      name: "SSK Receipt Tracker",
      type: "tool",
      category: "Expense dashboard",
      blurb:
        "A small Flask app for logging store receipts and turning them into a monthly expense picture: three-field entry, date-range filters, spend-by-area rollups, spend-over-time buckets, headline stats with period-over-period change, edit / delete / undo, and CSV export. Light and dark, keyboard-navigable charts.",
      meta: "Internal tool · deployed as a Python function on Vercel",
      tags: ["Python", "Flask", "SQLite", "Chart rendering", "Vercel"],
      live: "https://ssk-receipt-tracker.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/SSKReceiptTracker",
    },
    {
      name: "AV Toys",
      type: "site",
      category: "Marketing site",
      blurb:
        "A bold one-page site for a custom 3D-printed, hand-painted anime-figure maker. Hand-built static HTML/CSS/JS with a Supabase-backed customer reviews system — photo upload, a moderation admin, and email notifications fired from a Supabase database webhook through a Vercel function.",
      meta: "Client project · site + moderated reviews + handover docs",
      tags: ["HTML / CSS / JS", "Supabase", "Storage + Auth", "Vercel Functions", "Resend"],
      live: "https://gelo-printz.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/GeloPrintz",
    },
    {
      name: "Smart Buzz Barbershop",
      type: "site",
      category: "Marketing site",
      blurb:
        "A static one-pager for a real barbershop in Onehunga, Auckland. Black-and-gold theme, scroll-reveal, count-up stats, a gallery lightbox, and a mobile slide-in nav. Real service prices transcribed from the shop's printed board; address, phone, and map pin wired to the real location.",
      meta: "Client project · logo + photos in, deployable site out",
      tags: ["HTML / CSS / JS", "IntersectionObserver", "Google Fonts", "Vercel"],
      live: "https://smart-buzz-barber.vercel.app",
      source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/SmartBuzzBarber",
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
      const a = el("a", "card__link card__link--live", "Live ↗");
      a.href = p.live;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", "Open " + p.name + " (live site)");
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
