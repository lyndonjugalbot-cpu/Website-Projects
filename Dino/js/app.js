/* ==========================================================================
   DinoMart — shared application layer
   Header/footer injection · cart · wishlist · currency · toasts · modals
   ========================================================================== */
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  const D = window.DINO || { products: [], categories: [], brands: [], testimonials: [], faq: [] };
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- currency ------------------------------------------------------ */
  const CURRENCIES = {
    USD: { symbol: "$",  rate: 1,     after: false },
    EUR: { symbol: "€",  rate: 0.92,  after: false },
    GBP: { symbol: "£",  rate: 0.79,  after: false },
    CAD: { symbol: "CA$", rate: 1.37, after: false },
    AUD: { symbol: "A$", rate: 1.53,  after: false },
    JPY: { symbol: "¥",  rate: 149,   after: false, whole: true }
  };
  let currency = store.get("dino_currency", "USD");
  if (!CURRENCIES[currency]) currency = "USD";

  function money(usd) {
    const c = CURRENCIES[currency];
    const v = usd * c.rate;
    const n = c.whole ? Math.round(v).toLocaleString() : v.toFixed(2);
    return c.after ? `${n} ${c.symbol}` : `${c.symbol}${n}`;
  }
  function setCurrency(code) {
    if (!CURRENCIES[code]) return;
    currency = code; store.set("dino_currency", code);
    document.dispatchEvent(new CustomEvent("dino:currency"));
    renderMoney();
    renderCart();
  }
  function renderMoney() {
    $$("[data-usd]").forEach(el => { el.textContent = money(parseFloat(el.dataset.usd)); });
  }

  /* ---------- i18n (EN / FR) --------------------------------------------- */
  const I18N = {
    en: {
      nav_toys: "Shop Toys", nav_shwag: "DinoFam Shwag", nav_about: "About Us",
      nav_shop: "Shop All", search_ph: "Search figures, boosters, shwag…",
      add_cart: "Add to cart", view: "Quick view", cart_title: "Your Cart",
      subtotal: "Subtotal", checkout: "Checkout", empty_cart: "Your cart is empty",
      free_ship_hit: "You've unlocked free shipping! 🎉",
      newsletter_t: "Never Miss A Drop Again", drop_t: "Next Drop"
    },
    fr: {
      nav_toys: "Jouets", nav_shwag: "Shwag DinoFam", nav_about: "À propos",
      nav_shop: "Tout voir", search_ph: "Rechercher figurines, boosters, shwag…",
      add_cart: "Ajouter au panier", view: "Aperçu rapide", cart_title: "Votre panier",
      subtotal: "Sous-total", checkout: "Paiement", empty_cart: "Votre panier est vide",
      free_ship_hit: "Livraison gratuite débloquée ! 🎉",
      newsletter_t: "Ne ratez plus aucun drop", drop_t: "Prochain drop"
    }
  };
  let lang = store.get("dino_lang", "en");
  if (!I18N[lang]) lang = "en";
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
  function setLang(code) {
    if (!I18N[code]) return;
    lang = code; store.set("dino_lang", code);
    applyI18n();
    document.dispatchEvent(new CustomEvent("dino:lang"));
  }
  function applyI18n() {
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = lang;
  }

  /* ---------- artwork generator ------------------------------------------ */
  function productArt(p, opts = {}) {
    const hue = p.hue ?? 140;
    const h2 = (hue + 40) % 360;
    const id = "g" + p.id.replace(/[^a-z0-9]/gi, "");
    const glyph = p.glyph || "🦖";
    return `
    <svg class="art" viewBox="0 0 400 400" role="img" aria-label="${escapeAttr(p.name)}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 68% 93%)"/>
          <stop offset="1" stop-color="hsl(${h2} 58% 84%)"/>
        </linearGradient>
        <radialGradient id="${id}b" cx="70%" cy="22%" r="70%">
          <stop offset="0" stop-color="hsl(28 95% 62% / .32)"/>
          <stop offset="1" stop-color="transparent"/>
        </radialGradient>
        <radialGradient id="${id}c" cx="20%" cy="88%" r="65%">
          <stop offset="0" stop-color="hsl(145 65% 48% / .28)"/>
          <stop offset="1" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#${id})"/>
      <rect width="400" height="400" fill="url(#${id}b)"/>
      <rect width="400" height="400" fill="url(#${id}c)"/>
      <g stroke="hsl(30 25% 25% / .07)" stroke-width="1">
        ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 66}" x2="400" y2="${i * 66 - 60}"/>`).join("")}
      </g>
      <circle cx="330" cy="80" r="52" fill="hsl(0 0% 100% / .35)"/>
      <text x="200" y="205" font-size="150" text-anchor="middle" dominant-baseline="central"
            style="filter:drop-shadow(0 12px 24px rgba(60,40,15,.28))">${glyph}</text>
      <text x="200" y="330" font-size="19" text-anchor="middle" fill="hsl(30 20% 20% / .4)"
            font-family="'Space Grotesk',sans-serif" font-weight="700" letter-spacing="2">
        ${escapeHtml((p.brand || "DINOMART").toUpperCase())}
      </text>
    </svg>`;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function escapeAttr(s) { return escapeHtml(s).replace(/\n/g, " "); }

  function stars(rating) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    return `<span class="stars" aria-hidden="true"><i style="--p:${pct}%"></i></span>`;
  }

  /* ---------- cart ------------------------------------------------------- */
  let cart = store.get("dino_cart", []); // [{id, qty}]
  const FREE_SHIP = 75;

  function saveCart() { store.set("dino_cart", cart); syncCartUI(); document.dispatchEvent(new CustomEvent("dino:cart")); }
  function cartCount() { return cart.reduce((n, l) => n + l.qty, 0); }
  function cartSubtotal() {
    return cart.reduce((s, l) => {
      const p = D.products.find(x => x.id === l.id);
      return s + (p ? p.price * l.qty : 0);
    }, 0);
  }
  function addToCart(id, qty = 1, opts = {}) {
    const p = D.products.find(x => x.id === id);
    if (!p) return;
    if (!p.inStock) { toast(`${p.name} is on the waitlist`, "info"); return; }
    const line = cart.find(l => l.id === id);
    if (line) line.qty += qty; else cart.push({ id, qty });
    saveCart();
    toast(`Added to cart — ${p.name}`, "ok");
    if (!opts.silent) openDrawer();
    bumpCartIcon();
  }
  function setQty(id, qty) {
    const line = cart.find(l => l.id === id);
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) cart = cart.filter(l => l.id !== id);
    saveCart();
  }
  function removeFromCart(id) { cart = cart.filter(l => l.id !== id); saveCart(); toast("Removed from cart", "info"); }
  function clearCart() { cart = []; saveCart(); }

  function bumpCartIcon() {
    const el = $(".nav-tools .icon-btn--cart");
    if (!el) return;
    el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }],
      { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" }
    );
  }

  function syncCartUI() {
    const n = cartCount();
    $$(".cart-count").forEach(c => { c.textContent = n; c.classList.toggle("show", n > 0); });
  }

  /* ---------- wishlist ------------------------------------------------- */
  let favs = new Set(store.get("dino_fav", []));
  function isFav(id) { return favs.has(id); }
  function toggleFav(id) {
    const p = D.products.find(x => x.id === id);
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set("dino_fav", [...favs]);
    document.dispatchEvent(new CustomEvent("dino:fav"));
    $$(`.pcard__fav[data-fav="${CSS.escape(id)}"]`).forEach(b => {
      b.classList.toggle("is-fav", favs.has(id));
      b.setAttribute("aria-pressed", String(favs.has(id)));
    });
    const favCount = $(".fav-count");
    if (favCount) { favCount.textContent = favs.size; favCount.classList.toggle("show", favs.size > 0); }
    if (p) toast(favs.has(id) ? `Saved ${p.name} to wishlist` : `Removed from wishlist`, favs.has(id) ? "ok" : "info");
  }

  /* ---------- recently viewed ---------------------------------------- */
  function pushRecent(id) {
    let r = store.get("dino_recent", []);
    r = [id, ...r.filter(x => x !== id)].slice(0, 8);
    store.set("dino_recent", r);
  }
  const getRecent = () => store.get("dino_recent", []);

  /* ---------- product card markup ----------------------------------- */
  function cardHTML(p) {
    const badge = p.badge
      ? `<span class="tag ${/sale/i.test(p.badge) ? "tag--sale" : /limited|numbered|chase|exclusive|new/i.test(p.badge) ? "tag--jungle" : "tag--fire"}">${escapeHtml(p.badge)}</span>`
      : "";
    const out = !p.inStock ? `<span class="tag tag--out">Waitlist</span>` : "";
    return `
    <article class="pcard ${p.inStock ? "" : "is-out"}" data-id="${p.id}">
      <div class="pcard__media">
        <a href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeAttr(p.name)}">${productArt(p)}</a>
        <div class="pcard__badges">${badge}${out}</div>
        <button class="pcard__fav ${isFav(p.id) ? "is-fav" : ""}" data-fav="${p.id}" aria-label="Toggle wishlist" aria-pressed="${isFav(p.id)}" title="Wishlist">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.6 2 5 5.5 5c2.1 0 3.6 1.2 4.5 2.6C10.9 6.2 12.4 5 14.5 5 18 5 19.6 8.6 22 11.8 19.5 16.4 12 21 12 21z"/></svg>
        </button>
        <div class="pcard__quick">
          <button class="btn btn--jungle btn--sm btn--block" data-quick="${p.id}" data-i18n="view">Quick view</button>
        </div>
      </div>
      <div class="pcard__body">
        <span class="pcard__brand">${escapeHtml(p.brand)}</span>
        <a class="pcard__title" href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
        <span class="pcard__rating">${stars(p.rating)} ${p.rating.toFixed(1)} <span>(${p.reviews})</span></span>
        <div class="pcard__foot">
          <span class="price">${p.compareAt ? `<s data-usd="${p.compareAt}">${money(p.compareAt)}</s>` : ""}<span data-usd="${p.price}">${money(p.price)}</span></span>
          <button class="pcard__add" data-add="${p.id}" aria-label="Add ${escapeAttr(p.name)} to cart" title="${t("add_cart")}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M6 6 5 2H2"/></svg>
          </button>
        </div>
      </div>
    </article>`;
  }
  function renderCards(list, mount) {
    mount.innerHTML = list.map(cardHTML).join("");
    applyI18n(); wireCards(mount);
  }
  function wireCards(root = document) {
    const once = (el) => { if (el.dataset.wired) return true; el.dataset.wired = "1"; return false; };
    $$("[data-add]", root).forEach(b => { if (!once(b)) b.addEventListener("click", e => { e.preventDefault(); addToCart(b.dataset.add); }); });
    $$("[data-fav]", root).forEach(b => { if (!once(b)) b.addEventListener("click", e => { e.preventDefault(); toggleFav(b.dataset.fav); }); });
    $$("[data-quick]", root).forEach(b => { if (!once(b)) b.addEventListener("click", e => { e.preventDefault(); openQuickView(b.dataset.quick); }); });
  }

  /* ---------- chrome: header + footer ------------------------------- */
  function headerHTML() {
    const toys = D.categories.find(c => c.id === "toys") || { subcategories: [] };
    const shwag = D.categories.find(c => c.id === "shwag") || { subcategories: [] };
    const megaLinks = (cat, list) => list.map(s =>
      `<a href="shop.html?cat=${cat}&sub=${encodeURIComponent(s)}">${escapeHtml(s)}</a>`).join("");
    return `
    <div class="topbar"><div class="wrap">
      <span>⚡ <strong>Free shipping</strong> over ${money(FREE_SHIP)} &nbsp;·&nbsp; Ships in 1–2 business days &nbsp;·&nbsp; #VibeJurassic</span>
    </div></div>
    <div class="wrap"><nav class="nav" aria-label="Primary">
      <a class="brand" href="index.html" aria-label="DinoMart home">
        ${brandMark()} Dino<span>Mart</span>
      </a>
      <div class="nav-links">
        <div class="nav-item">
          <button aria-haspopup="true"><span data-i18n="nav_toys">Shop Toys</span>
            <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="mega"><h4>Shop Toys</h4>${megaLinks("toys", toys.subcategories)}</div>
        </div>
        <div class="nav-item">
          <button aria-haspopup="true"><span data-i18n="nav_shwag">DinoFam Shwag</span>
            <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="mega"><h4>DinoFam Shwag</h4>${megaLinks("shwag", shwag.subcategories)}</div>
        </div>
        <a href="shop.html" data-i18n="nav_shop">Shop All</a>
        <a href="about.html" data-i18n="nav_about">About Us</a>
      </div>
      <div class="nav-tools">
        <select class="mini-select nav-tools__extra" aria-label="Language" id="langSel">
          <option value="en">EN</option><option value="fr">FR</option>
        </select>
        <select class="mini-select nav-tools__extra" aria-label="Currency" id="curSel">
          ${Object.keys(CURRENCIES).map(k => `<option value="${k}">${k}</option>`).join("")}
        </select>
        <button class="icon-btn" data-open-search aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <a class="icon-btn nav-tools__extra" href="wishlist.html" aria-label="Wishlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.6 2 5 5.5 5c2.1 0 3.6 1.2 4.5 2.6C10.9 6.2 12.4 5 14.5 5 18 5 19.6 8.6 22 11.8 19.5 16.4 12 21 12 21z"/></svg>
          <span class="fav-count">0</span>
        </a>
        <button class="icon-btn nav-tools__extra" data-open-auth aria-label="Account">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
        </button>
        <button class="icon-btn icon-btn--cart" data-open-cart aria-label="Cart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M6 6 5 2H2"/></svg>
          <span class="cart-count">0</span>
        </button>
        <button class="icon-btn burger" data-open-nav aria-label="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
    </nav></div>`;
  }

  function brandMark() {
    return `<svg class="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#33d17a"/><stop offset=".55" stop-color="#ffb43d"/><stop offset="1" stop-color="#ff3d2e"/>
      </linearGradient></defs>
      <path fill="url(#bm)" d="M8 30c0-11 9-20 21-20 3 0 5 .5 5 .5S31 13 31 16c4 0 9 3 9 9 0 2-1 4-1 4l3 2-4 1 1 4-5-3c-2 3-6 5-11 5-2 5-2 5-2 5l-3-5c-6-1-10-6-10-12l-3 1 3-4-3-3 4 1z"/>
      <circle cx="27" cy="19" r="2.4" fill="#0a0d0b"/>
    </svg>`;
  }

  function footerHTML() {
    return `<div class="wrap">
      <div class="footer-grid">
        <div class="footer-about">
          <a class="brand" href="index.html">${brandMark()} Dino<span>Mart</span></a>
          <p>Home of DinoFam, Lost Epoch &amp; pop-culture collectibles. Built by collectors, for collectors — a portion of every order funds community relief partners.</p>
          <div class="socials">
            <a href="https://youtube.com" aria-label="YouTube" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.5-.4-5.2a3 3 0 0 0-2.1-2.1C18.8 4.2 12 4.2 12 4.2s-6.8 0-8.5.5A3 3 0 0 0 1.4 6.8C1 8.5 1 12 1 12s0 3.5.4 5.2a3 3 0 0 0 2.1 2.1c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a3 3 0 0 0 2.1-2.1C23 15.5 23 12 23 12zM10 15.5v-7l6 3.5z"/></svg></a>
            <a href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a>
            <a href="https://tiktok.com" aria-label="TikTok" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2.3 1.7 4 4 4.2v3c-1.5.1-3-.3-4-1v6.3A6.5 6.5 0 1 1 9.5 9v3.1A3.4 3.4 0 1 0 13 15.5V3z"/></svg></a>
            <a href="https://x.com" aria-label="X" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 3h3l-7 8 8 10h-6l-5-6-5 6H3l7-9L2 3h6l4 5z"/></svg></a>
          </div>
        </div>
        <div>
          <h4>Shop</h4>
          <a href="shop.html?cat=toys">Shop Toys</a>
          <a href="shop.html?cat=shwag">DinoFam Shwag</a>
          <a href="shop.html?sort=new">New Arrivals</a>
          <a href="shop.html?sale=1">On Sale</a>
          <a href="wishlist.html">Wishlist</a>
        </div>
        <div>
          <h4>Support</h4>
          <a href="policies.html#shipping">Shipping Policy</a>
          <a href="policies.html#refund">Refund Policy</a>
          <a href="policies.html#contact">Contact Us</a>
          <a href="about.html#faq">FAQ</a>
          <a href="policies.html#track">Track Order</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="about.html">About Us</a>
          <a href="about.html#impact">Our Impact</a>
          <a href="policies.html#privacy">Privacy Policy</a>
          <a href="policies.html#terms">Terms of Service</a>
        </div>
      </div>
      <div class="footer-bar">
        <span>© ${new Date().getFullYear()} DinoMart · Home of DinoFam, Lost Epoch &amp; Pop-Culture Collectibles</span>
        <div class="pay"><span>VISA</span><span>MC</span><span>AMEX</span><span>PAYPAL</span><span>SHOP</span><span>G PAY</span></div>
      </div>
    </div>`;
  }

  /* ---------- drawer + overlays markup ------------------------------ */
  function overlaysHTML() {
    return `
    <div class="scrim" data-scrim></div>
    <aside class="drawer" role="dialog" aria-label="Shopping cart" aria-modal="true">
      <div class="drawer__head">
        <h3><span data-i18n="cart_title">Your Cart</span> <span class="muted" data-cart-n>(0)</span></h3>
        <button class="icon-btn" data-close-cart aria-label="Close cart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="drawer__ship" data-ship></div>
      <div class="drawer__items" data-cart-items></div>
      <div class="drawer__foot" data-cart-foot hidden>
        <div class="row"><span data-i18n="subtotal">Subtotal</span><span data-cart-subtotal>—</span></div>
        <p class="muted" style="font-size:.8rem;margin:0 0 12px">Shipping &amp; taxes calculated at checkout.</p>
        <a class="btn btn--fire btn--block" href="cart.html" data-i18n="checkout">Checkout</a>
      </div>
    </aside>

    <div class="modal-scrim" data-qv-scrim>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Quick view">
        <button class="modal__close" data-close-qv aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <div class="qv" data-qv-body></div>
      </div>
    </div>

    <div class="modal-scrim" data-auth-scrim>
      <div class="modal modal--sm" role="dialog" aria-modal="true" aria-label="Account">
        <button class="modal__close" data-close-auth aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <div class="modal__pad" data-auth-body></div>
      </div>
    </div>

    <div class="modal-scrim" data-search-scrim>
      <div class="modal modal--sm" role="dialog" aria-modal="true" aria-label="Search">
        <div class="modal__pad">
          <div class="shop-search" style="flex:1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" data-search-input placeholder="Search figures, boosters, shwag…" autocomplete="off">
          </div>
          <div data-search-results style="margin-top:14px;display:grid;gap:6px"></div>
        </div>
      </div>
    </div>

    <nav class="mobile-nav" aria-label="Mobile">
      <button class="icon-btn close" data-close-nav aria-label="Close menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <a href="index.html">Home</a>
      <a href="shop.html?cat=toys">Shop Toys</a>
      <a href="shop.html?cat=shwag">DinoFam Shwag</a>
      <a href="shop.html">Shop All</a>
      <a href="wishlist.html">Wishlist</a>
      <a href="about.html">About Us</a>
      <a href="policies.html#contact">Contact</a>
      <button class="mnav-account" data-open-auth style="text-align:left;padding:1em 0;font-family:var(--display);font-size:1.2rem;border-bottom:1px solid var(--line);width:100%">Account &amp; orders</button>
      <div style="display:flex;gap:10px;margin-top:20px">
        <select class="mini-select" aria-label="Language" id="langSelM" style="flex:1">
          <option value="en">English</option><option value="fr">Français</option>
        </select>
        <select class="mini-select" aria-label="Currency" id="curSelM" style="flex:1">
          ${Object.keys(CURRENCIES).map(k => `<option value="${k}">${k}</option>`).join("")}
        </select>
      </div>
    </nav>

    <button class="back-to-top" data-top aria-label="Back to top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>

    <div class="toaster" data-toaster aria-live="polite"></div>`;
  }

  /* ---------- drawer render --------------------------------------- */
  function renderCart() {
    const wrap = $("[data-cart-items]");
    if (!wrap) return;
    const n = cartCount();
    $("[data-cart-n]") && ($("[data-cart-n]").textContent = `(${n})`);
    const foot = $("[data-cart-foot]");
    if (!cart.length) {
      wrap.innerHTML = `<div class="drawer__empty"><div class="glyph">🥚</div><p>${t("empty_cart")}</p>
        <a class="btn btn--jungle btn--sm" href="shop.html">Start hunting</a></div>`;
      foot && (foot.hidden = true);
      renderShipBar();
      return;
    }
    wrap.innerHTML = cart.map(l => {
      const p = D.products.find(x => x.id === l.id); if (!p) return "";
      return `<div class="line" data-line="${p.id}">
        <a class="line__art" href="product.html?id=${encodeURIComponent(p.id)}">${productArt(p)}</a>
        <div>
          <span class="line__brand">${escapeHtml(p.brand)}</span>
          <a class="line__title" href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
          <div class="line__qty">
            <button data-dec="${p.id}" aria-label="Decrease">−</button>
            <span>${l.qty}</span>
            <button data-inc="${p.id}" aria-label="Increase">+</button>
          </div>
        </div>
        <div>
          <div class="line__price">${money(p.price * l.qty)}</div>
          <button class="line__rm" data-rm="${p.id}">Remove</button>
        </div>
      </div>`;
    }).join("");
    foot && (foot.hidden = false);
    $("[data-cart-subtotal]") && ($("[data-cart-subtotal]").textContent = money(cartSubtotal()));
    renderShipBar();
    $$("[data-inc]", wrap).forEach(b => b.onclick = () => setQty(b.dataset.inc, (cart.find(l => l.id === b.dataset.inc)?.qty || 0) + 1));
    $$("[data-dec]", wrap).forEach(b => b.onclick = () => setQty(b.dataset.dec, (cart.find(l => l.id === b.dataset.dec)?.qty || 0) - 1));
    $$("[data-rm]", wrap).forEach(b => b.onclick = () => removeFromCart(b.dataset.rm));
  }
  function renderShipBar() {
    const el = $("[data-ship]"); if (!el) return;
    const sub = cartSubtotal();
    const pct = Math.min(100, (sub / FREE_SHIP) * 100);
    const left = Math.max(0, FREE_SHIP - sub);
    el.innerHTML = left > 0
      ? `Add <strong style="color:var(--ember-gold)">${money(left)}</strong> for free shipping
         <div class="ship-bar"><i style="width:${pct}%"></i></div>`
      : `<strong style="color:var(--jungle-soft)">${t("free_ship_hit")}</strong>
         <div class="ship-bar"><i style="width:100%"></i></div>`;
  }

  /* ---------- drawer / modal open-close --------------------------- */
  const scrim = () => $("[data-scrim]");
  function openDrawer() { $(".drawer")?.classList.add("open"); scrim()?.classList.add("open"); lockScroll(true); renderCart(); }
  function closeDrawer() { $(".drawer")?.classList.remove("open"); scrim()?.classList.remove("open"); lockScroll(false); }
  function lockScroll(on) { document.body.style.overflow = on ? "hidden" : ""; }

  function openModal(sel) { $(sel)?.classList.add("open"); lockScroll(true); }
  function closeModal(sel) { $(sel)?.classList.remove("open"); if (!anyOpen()) lockScroll(false); }
  function anyOpen() { return $$(".modal-scrim.open, .drawer.open, .scrim.open").length > 0; }

  /* ---------- quick view ---------------------------------------- */
  function openQuickView(id) {
    const p = D.products.find(x => x.id === id); if (!p) return;
    const body = $("[data-qv-body]");
    body.innerHTML = `
      <div class="qv__media">${productArt(p)}</div>
      <div class="qv__body">
        <div class="pdp__brand">${escapeHtml(p.brand)}</div>
        <h3 style="font-size:1.35rem">${escapeHtml(p.name)}</h3>
        <span class="pcard__rating">${stars(p.rating)} ${p.rating.toFixed(1)} <span>(${p.reviews} reviews)</span></span>
        <div class="pdp__price" style="font-size:1.4rem;margin:1rem 0">
          ${p.compareAt ? `<s>${money(p.compareAt)}</s>` : ""}${money(p.price)}
        </div>
        <p class="muted">${escapeHtml(p.blurb)}</p>
        <div class="pdp__row">
          <div class="qty">
            <button data-qvdec aria-label="Decrease">−</button>
            <input data-qvqty value="1" inputmode="numeric" aria-label="Quantity">
            <button data-qvinc aria-label="Increase">+</button>
          </div>
          <button class="btn btn--fire" data-qvadd="${p.id}">${p.inStock ? t("add_cart") : "Join waitlist"}</button>
        </div>
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="badge-soft">View full details →</a>
      </div>`;
    const qtyEl = $("[data-qvqty]", body);
    $("[data-qvinc]", body).onclick = () => qtyEl.value = Math.max(1, (+qtyEl.value || 1) + 1);
    $("[data-qvdec]", body).onclick = () => qtyEl.value = Math.max(1, (+qtyEl.value || 1) - 1);
    $("[data-qvadd]", body).onclick = () => { addToCart(p.id, Math.max(1, +qtyEl.value || 1), { silent: true }); closeModal("[data-qv-scrim]"); };
    openModal("[data-qv-scrim]");
  }

  /* ---------- auth (mock) -------------------------------------- */
  let authMode = "login";
  function renderAuth() {
    const body = $("[data-auth-body]");
    const user = store.get("dino_user", null);
    if (user) {
      body.innerHTML = `
        <h3>Hey, ${escapeHtml(user.name || "DinoFam")} 👋</h3>
        <p class="muted">You're signed in as ${escapeHtml(user.email)}.</p>
        <div class="stack">
          <a class="btn btn--ghost btn--block" href="wishlist.html">View wishlist (${favs.size})</a>
          <a class="btn btn--ghost btn--block" href="cart.html">View cart (${cartCount()})</a>
          <button class="btn btn--jungle btn--block" data-logout>Sign out</button>
        </div>`;
      $("[data-logout]", body).onclick = () => { store.set("dino_user", null); renderAuth(); toast("Signed out", "info"); };
      return;
    }
    const isLogin = authMode === "login";
    body.innerHTML = `
      <h3>${isLogin ? "Welcome back" : "Join DinoFam"}</h3>
      <p class="muted">${isLogin ? "Sign in to track orders and drops." : "Create an account for faster checkout and early drop access."}</p>
      <form data-auth-form>
        ${isLogin ? "" : `<div class="field"><label>Name</label><input name="name" required></div>`}
        <div class="field"><label>Email</label><input type="email" name="email" required></div>
        <div class="field"><label>Password</label><input type="password" name="password" minlength="6" required></div>
        <button class="btn btn--fire btn--block" type="submit">${isLogin ? "Sign in" : "Create account"}</button>
      </form>
      <p class="auth-switch">${isLogin ? "New here?" : "Already have an account?"}
        <button data-auth-toggle>${isLogin ? "Create an account" : "Sign in"}</button></p>`;
    $("[data-auth-toggle]", body).onclick = () => { authMode = isLogin ? "signup" : "login"; renderAuth(); };
    $("[data-auth-form]", body).onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      store.set("dino_user", { name: fd.get("name") || "DinoFam", email: fd.get("email") });
      renderAuth();
      toast(isLogin ? "Signed in — welcome back!" : "Account created — welcome to the pack!", "ok");
    };
  }

  /* ---------- global search ---------------------------------- */
  function wireSearch() {
    const input = $("[data-search-input]");
    const results = $("[data-search-results]");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = `<p class="muted" style="font-size:.85rem">Try “raptor”, “funko”, “hoodie”, “booster”…</p>`; return; }
      const hits = D.products.filter(p =>
        (p.name + " " + p.brand + " " + p.sub + " " + p.tags.join(" ")).toLowerCase().includes(q)
      ).slice(0, 6);
      results.innerHTML = hits.length ? hits.map(p => `
        <a href="product.html?id=${encodeURIComponent(p.id)}" style="display:flex;gap:10px;align-items:center;padding:8px;border-radius:10px;border:1px solid var(--line)">
          <span style="width:44px;height:44px;border-radius:8px;overflow:hidden;flex:none">${productArt(p)}</span>
          <span style="flex:1">
            <span style="display:block;font-size:.85rem;font-weight:600">${escapeHtml(p.name)}</span>
            <span class="muted" style="font-size:.78rem">${escapeHtml(p.brand)} · ${money(p.price)}</span>
          </span>
        </a>`).join("") : `<p class="muted" style="font-size:.85rem">No matches for “${escapeHtml(q)}”.</p>`;
    });
  }

  /* ---------- toast ----------------------------------------- */
  function toast(msg, kind = "ok") {
    const host = $("[data-toaster]"); if (!host) return;
    const el = document.createElement("div");
    el.className = "toast";
    const icons = {
      ok: `<path d="M20 6 9 17l-5-5"/>`,
      info: `<path d="M12 8h.01M11 12h1v5h1"/>`
    };
    el.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${icons[kind] || icons.ok}</svg></span><span>${escapeHtml(msg)}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 3200);
  }

  /* ---------- reveal on scroll ---------------------------- */
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add("in");
        if (el.hasAttribute("data-stagger")) {
          $$(":scope > *", el).forEach((c, i) => { c.style.transitionDelay = `${i * 70}ms`; });
        }
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$("[data-reveal], [data-stagger]").forEach(el => io.observe(el));
    // failsafe: never leave content hidden if the observer misfires
    setTimeout(() => $$("[data-reveal], [data-stagger]").forEach(el => el.classList.add("in")), 2600);
  }

  /* ---------- counters ---------------------------------- */
  function initCounters() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const target = parseFloat(el.dataset.count);
        const dur = 1400, start = performance.now();
        const suffix = el.dataset.suffix || "";
        const prefix = el.dataset.prefix || "";
        function tick(now) {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = target * eased;
          el.textContent = prefix + (Number.isInteger(target) ? Math.round(val).toLocaleString() : val.toFixed(1)) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    $$("[data-count]").forEach(el => io.observe(el));
  }

  /* ---------- countdowns ------------------------------ */
  function initCountdowns() {
    const els = $$("[data-countdown]");
    if (!els.length) return;
    function upd() {
      const now = Date.now();
      els.forEach(el => {
        let diff = new Date(el.dataset.countdown).getTime() - now;
        if (isNaN(diff)) return;
        if (diff < 0) diff = 0;
        const d = Math.floor(diff / 864e5);
        const h = Math.floor(diff % 864e5 / 36e5);
        const m = Math.floor(diff % 36e5 / 6e4);
        const s = Math.floor(diff % 6e4 / 1e3);
        el.innerHTML = [["Days", d], ["Hrs", h], ["Min", m], ["Sec", s]]
          .map(([k, v]) => `<div class="cd-unit"><b>${String(v).padStart(2, "0")}</b><span>${k}</span></div>`).join("");
      });
    }
    upd(); setInterval(upd, 1000);
  }

  /* ---------- embers in hero ------------------------- */
  function initEmbers() {
    const host = $("[data-embers]"); if (!host) return;
    const N = window.innerWidth < 640 ? 14 : 26;
    for (let i = 0; i < N; i++) {
      const e = document.createElement("span");
      e.className = "ember";
      e.style.left = Math.random() * 100 + "%";
      e.style.animationDuration = 6 + Math.random() * 8 + "s";
      e.style.animationDelay = -Math.random() * 12 + "s";
      const g = Math.random();
      e.style.background = g > .5 ? "var(--ember-gold)" : g > .2 ? "var(--ember)" : "var(--jungle)";
      e.style.width = e.style.height = 3 + Math.random() * 5 + "px";
      host.appendChild(e);
    }
  }

  /* ---------- header scroll state + back to top ----- */
  function initScroll() {
    const header = $(".site-header");
    const top = $("[data-top]");
    const onScroll = () => {
      const y = window.scrollY;
      header && header.classList.toggle("is-stuck", y > 8);
      top && top.classList.toggle("show", y > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    top && (top.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------- wire chrome events ------------------- */
  function wireChrome() {
    $("[data-open-cart]")?.addEventListener("click", openDrawer);
    $("[data-close-cart]")?.addEventListener("click", closeDrawer);
    $("[data-scrim]")?.addEventListener("click", closeDrawer);

    $$("[data-open-auth]").forEach(b => b.addEventListener("click", () => {
      $(".mobile-nav")?.classList.remove("open");
      renderAuth(); openModal("[data-auth-scrim]");
    }));
    $("[data-close-auth]")?.addEventListener("click", () => closeModal("[data-auth-scrim]"));
    $("[data-auth-scrim]")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeModal("[data-auth-scrim]"); });

    $("[data-close-qv]")?.addEventListener("click", () => closeModal("[data-qv-scrim]"));
    $("[data-qv-scrim]")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeModal("[data-qv-scrim]"); });

    $("[data-open-search]")?.addEventListener("click", () => { openModal("[data-search-scrim]"); setTimeout(() => $("[data-search-input]")?.focus(), 120); });
    $("[data-search-scrim]")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeModal("[data-search-scrim]"); });

    $("[data-open-nav]")?.addEventListener("click", () => { $(".mobile-nav")?.classList.add("open"); lockScroll(true); });
    $("[data-close-nav]")?.addEventListener("click", () => { $(".mobile-nav")?.classList.remove("open"); lockScroll(false); });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeDrawer();
        ["[data-qv-scrim]", "[data-auth-scrim]", "[data-search-scrim]"].forEach(closeModal);
        $(".mobile-nav")?.classList.remove("open");
      }
    });

    $$("#curSel, #curSelM").forEach(cs => { cs.value = currency; cs.addEventListener("change", () => setCurrency(cs.value)); });
    $$("#langSel, #langSelM").forEach(ls => { ls.value = lang; ls.addEventListener("change", () => setLang(ls.value)); });
    document.addEventListener("dino:currency", () => $$("#curSel, #curSelM").forEach(s => s.value = currency));
    document.addEventListener("dino:lang", () => $$("#langSel, #langSelM").forEach(s => s.value = lang));

    // active nav link
    const path = location.pathname.split("/").pop() || "index.html";
    $$(".nav-links a").forEach(a => {
      if (a.getAttribute("href")?.startsWith(path.replace(".html", "")) && path !== "index.html") a.classList.add("is-active");
    });
  }

  /* ---------- mount ------------------------------- */
  function mount() {
    const h = $("#site-header"); if (h) { h.className = "site-header"; h.innerHTML = headerHTML(); }
    const f = $("#site-footer"); if (f) { f.className = "site-footer"; f.innerHTML = footerHTML(); }
    document.body.insertAdjacentHTML("beforeend", overlaysHTML());

    syncCartUI();
    const fc = $(".fav-count"); if (fc) { fc.textContent = favs.size; fc.classList.toggle("show", favs.size > 0); }

    wireChrome();
    wireSearch();
    wireCards(document);
    applyI18n();
    renderMoney();
    renderCart();
    initReveal();
    initCounters();
    initCountdowns();
    initEmbers();
    initScroll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  /* ---------- public API ------------------------- */
  window.DinoApp = {
    D, $, $$, money, stars, productArt, cardHTML, renderCards, wireCards,
    addToCart, removeFromCart, setQty, clearCart, cart: () => cart, cartCount, cartSubtotal,
    isFav, toggleFav, favs: () => favs, pushRecent, getRecent,
    toast, openQuickView, openDrawer, escapeHtml, escapeAttr,
    currency: () => currency, setCurrency, FREE_SHIP, t, lang: () => lang, applyI18n
  };
})();
