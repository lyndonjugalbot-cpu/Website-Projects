/* ==========================================================================
   DinoMart — cart & checkout page
   ========================================================================== */
(function () {
  const A = window.DinoApp, D = window.DINO;
  const $ = A.$, $$ = A.$$;
  const FREE = A.FREE_SHIP;
  const TAX_RATE = 0.08;
  let discount = 0; // fraction

  function lines() {
    return A.cart().map(l => ({ ...l, p: D.products.find(x => x.id === l.id) })).filter(x => x.p);
  }

  function renderItems() {
    const wrap = $("[data-cart-full]");
    const ls = lines();
    if (!ls.length) {
      wrap.innerHTML = `<div class="card" style="text-align:center;padding:56px 24px">
        <div style="font-size:3rem">🥚</div>
        <h2 style="font-size:1.3rem">Your cart is empty</h2>
        <p class="muted">Nothing hatching in here yet. Go find something worth roaring about.</p>
        <a class="btn btn--fire" href="shop.html">Start hunting</a>
      </div>`;
      $("[data-checkout]").hidden = true;
      $("[data-summary]").style.display = "none";
      return;
    }
    $("[data-summary]").style.display = "";
    wrap.innerHTML = `<div class="card" style="padding:0">
      ${ls.map(({ p, qty }) => `
        <div class="line" style="padding:18px;margin:0" data-row="${p.id}">
          <a class="line__art" href="product.html?id=${encodeURIComponent(p.id)}">${A.productArt(p)}</a>
          <div>
            <span class="line__brand">${A.escapeHtml(p.brand)}</span>
            <a class="line__title" href="product.html?id=${encodeURIComponent(p.id)}">${A.escapeHtml(p.name)}</a>
            <div class="muted" style="font-size:.8rem;margin-top:2px">${A.money(p.price)} each</div>
            <div class="line__qty">
              <button data-dec="${p.id}" aria-label="Decrease">−</button>
              <span>${qty}</span>
              <button data-inc="${p.id}" aria-label="Increase">+</button>
              <button class="line__rm" data-rm="${p.id}" style="margin:0 0 0 10px">Remove</button>
            </div>
          </div>
          <div class="line__price">${A.money(p.price * qty)}</div>
        </div>`).join("")}
    </div>`;
    $$("[data-inc]", wrap).forEach(b => b.onclick = () => { A.setQty(b.dataset.inc, (A.cart().find(l => l.id === b.dataset.inc)?.qty || 0) + 1); refresh(); });
    $$("[data-dec]", wrap).forEach(b => b.onclick = () => { A.setQty(b.dataset.dec, (A.cart().find(l => l.id === b.dataset.dec)?.qty || 0) - 1); refresh(); });
    $$("[data-rm]", wrap).forEach(b => b.onclick = () => { A.removeFromCart(b.dataset.rm); refresh(); });
  }

  function totals() {
    const sub = A.cartSubtotal();
    const ship = sub === 0 ? 0 : sub >= FREE ? 0 : 6.95;
    const disc = sub * discount;
    const tax = Math.max(0, (sub - disc)) * TAX_RATE;
    const total = Math.max(0, sub - disc) + ship + tax;
    return { sub, ship, disc, tax, total };
  }

  function renderSummary() {
    const { sub, ship, disc, tax, total } = totals();
    $("[data-sum-sub]").textContent = A.money(sub);
    $("[data-sum-ship]").textContent = ship === 0 ? (sub === 0 ? "—" : "Free") : A.money(ship);
    $("[data-sum-tax]").textContent = A.money(tax);
    $("[data-sum-total]").textContent = A.money(total);
    $("[data-pay-total]") && ($("[data-pay-total]").textContent = A.money(total));
    $("[data-sum-disc-row]").hidden = disc <= 0;
    if (disc > 0) $("[data-sum-disc]").textContent = "−" + A.money(disc);

    const el = $("[data-ship]");
    const left = Math.max(0, FREE - sub);
    const pct = Math.min(100, (sub / FREE) * 100);
    el.innerHTML = sub === 0 ? "" : left > 0
      ? `Add <strong style="color:var(--ember-gold)">${A.money(left)}</strong> for free shipping<div class="ship-bar"><i style="width:${pct}%"></i></div>`
      : `<strong style="color:var(--jungle-soft)">Free shipping unlocked 🎉</strong><div class="ship-bar"><i style="width:100%"></i></div>`;
  }

  function renderRecommend() {
    const inCart = new Set(A.cart().map(l => l.id));
    const recs = [...D.products].filter(p => !inCart.has(p.id) && p.inStock)
      .sort((a, b) => (b.rating * b.reviews) - (a.rating * a.reviews)).slice(0, 4);
    if (recs.length && lines().length) {
      $("[data-cart-recommend-wrap]").hidden = false;
      A.renderCards(recs, $("[data-cart-recommend]"));
    } else {
      $("[data-cart-recommend-wrap]").hidden = true;
    }
  }

  function refresh() { renderItems(); renderSummary(); renderRecommend(); }
  refresh();

  /* promo */
  $("[data-apply-promo]").onclick = () => {
    const code = ($("[data-promo]").value || "").trim().toUpperCase();
    if (code === "DINOFAM10") { discount = 0.10; A.toast("Promo applied — 10% off", "ok"); }
    else if (code === "") { A.toast("Enter a code first", "info"); }
    else { discount = 0; A.toast(`“${code}” isn't a valid code`, "info"); }
    renderSummary();
  };

  /* checkout flow */
  $("[data-goto-checkout]").onclick = () => {
    if (!lines().length) { A.toast("Your cart is empty", "info"); return; }
    const form = $("[data-checkout]");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  $("[data-checkout]").addEventListener("submit", e => {
    e.preventDefault();
    const oid = "DM-" + Date.now().toString(36).toUpperCase().slice(-7);
    $("[data-order-id]").textContent = oid;
    $("[data-checkout]").hidden = true;
    $("[data-cart-full]").innerHTML = "";
    $("[data-summary]").style.display = "none";
    $("[data-confirmation]").hidden = false;
    $("[data-cart-recommend-wrap]").hidden = true;
    A.clearCart();
    A.toast("Payment successful — order placed!", "ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("dino:cart", () => { renderSummary(); });
  document.addEventListener("dino:currency", refresh);
})();
