/* ==========================================================================
   DinoMart — product detail page
   ========================================================================== */
(function () {
  const A = window.DinoApp, D = window.DINO;
  const $ = A.$, $$ = A.$$;

  const id = new URLSearchParams(location.search).get("id");
  const p = D.products.find(x => x.id === id);

  if (!p) {
    $("[data-pdp-missing]").hidden = false;
    return;
  }

  document.title = `${p.name} — DinoMart`;
  A.pushRecent(p.id);

  const pdp = $("[data-pdp]");
  pdp.hidden = false;

  $("[data-pdp-media]").innerHTML = A.productArt(p);
  const catLabel = (D.categories.find(c => c.id === p.category) || {}).label || "Shop";
  $("[data-pdp-crumbs]").innerHTML =
    `<a href="index.html">Home</a> / <a href="shop.html?cat=${p.category}">${A.escapeHtml(catLabel)}</a> /
     <a href="shop.html?cat=${p.category}&sub=${encodeURIComponent(p.sub)}">${A.escapeHtml(p.sub)}</a> /
     <span class="muted">${A.escapeHtml(p.name)}</span>`;
  $("[data-pdp-brand]").textContent = p.brand;
  $("[data-pdp-name]").textContent = p.name;
  $("[data-pdp-rating]").innerHTML = `${A.stars(p.rating)} ${p.rating.toFixed(1)} <span>· ${p.reviews} reviews</span>`;
  $("[data-pdp-blurb]").textContent = p.blurb;

  function renderPrice() {
    $("[data-pdp-price]").innerHTML =
      (p.compareAt ? `<s>${A.money(p.compareAt)}</s>` : "") + A.money(p.price) +
      (p.compareAt ? `<span class="save">Save ${A.money(p.compareAt - p.price)}</span>` : "");
  }
  renderPrice();

  const stock = $("[data-pdp-stock]");
  stock.className = "stock-pill" + (p.inStock ? "" : " out");
  stock.innerHTML = `<span class="dot"></span> ${p.inStock ? "In stock — ready to ship" : "Out of stock — join the waitlist"}`;

  /* quantity */
  const qtyEl = $("[data-qty]");
  const clampQty = () => { let v = parseInt(qtyEl.value, 10); if (isNaN(v) || v < 1) v = 1; if (v > 99) v = 99; qtyEl.value = v; return v; };
  $("[data-inc]").onclick = () => { qtyEl.value = Math.min(99, clampQty() + 1); };
  $("[data-dec]").onclick = () => { qtyEl.value = Math.max(1, clampQty() - 1); };
  qtyEl.onchange = clampQty;

  /* add to cart */
  const addBtn = $("[data-add-cart]");
  addBtn.textContent = p.inStock ? "Add to cart" : "Join waitlist";
  addBtn.onclick = () => {
    if (!p.inStock) { A.toast("Added to the waitlist — we'll email you on restock", "info"); return; }
    A.addToCart(p.id, clampQty());
  };

  /* wishlist */
  const favBtn = $("[data-fav-btn]");
  function syncFav() {
    const on = A.isFav(p.id);
    favBtn.setAttribute("aria-pressed", String(on));
    favBtn.style.borderColor = on ? "var(--ember)" : "";
    favBtn.style.color = on ? "var(--ember-gold)" : "";
    $("[data-fav-label]").textContent = on ? "Saved" : "Save";
  }
  favBtn.onclick = () => { A.toggleFav(p.id); syncFav(); };
  syncFav();

  /* tabs */
  $("[data-panel='desc']").innerHTML = `<p>${A.escapeHtml(p.description)}</p>
    <ul style="color:var(--text-dim);padding-left:1.1em;margin-top:1em">
      <li>Brand: ${A.escapeHtml(p.brand)}</li>
      <li>Category: ${A.escapeHtml(catLabel)} — ${A.escapeHtml(p.sub)}</li>
      <li>SKU: DM-${p.id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}</li>
    </ul>`;

  const revPanel = $("[data-panel='rev']");
  const sampleReviews = [
    { n: "Verified buyer", s: 5, txt: "Exactly as pictured, arrived quicker than the estimate. Packed with care." },
    { n: "DinoFam member", s: p.rating >= 4.6 ? 5 : 4, txt: "Great addition to the shelf. Would buy from DinoMart again." },
    { n: "Collector", s: 4, txt: "Solid quality for the price. Minor packaging wear but the item itself is mint." }
  ];
  revPanel.innerHTML = `
    <div style="display:flex;align-items:center;gap:1em;margin-bottom:1.4em">
      <span style="font-family:var(--display);font-size:2rem;font-weight:700">${p.rating.toFixed(1)}</span>
      <span>${A.stars(p.rating)}<br><span class="muted" style="font-size:.82rem">Based on ${p.reviews} reviews</span></span>
    </div>
    ${sampleReviews.map(r => `
      <div style="padding:14px 0;border-top:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:.9rem">${r.n}</strong>${A.stars(r.s)}
        </div>
        <p style="margin:.4em 0 0;font-size:.9rem">${r.txt}</p>
      </div>`).join("")}`;

  $$("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
    $$("[data-tab]").forEach(b => b.setAttribute("aria-selected", "false"));
    btn.setAttribute("aria-selected", "true");
    $$("[data-panel]").forEach(pl => pl.hidden = pl.dataset.panel !== btn.dataset.tab);
  }));

  /* related */
  const related = D.products
    .filter(x => x.id !== p.id && (x.sub === p.sub || x.category === p.category))
    .sort((a, b) => (a.sub === p.sub ? -1 : 1) - (b.sub === p.sub ? -1 : 1))
    .slice(0, 4);
  if (related.length) {
    $("[data-related-wrap]").hidden = false;
    A.renderCards(related, $("[data-related]"));
  }

  /* recently viewed */
  const recent = A.getRecent().filter(rid => rid !== p.id).map(rid => D.products.find(x => x.id === rid)).filter(Boolean).slice(0, 4);
  if (recent.length) {
    $("[data-recent-wrap]").hidden = false;
    A.renderCards(recent, $("[data-recent]"));
  }

  document.addEventListener("dino:currency", () => {
    renderPrice();
    if (related.length) A.renderCards(related, $("[data-related]"));
    if (recent.length) A.renderCards(recent, $("[data-recent]"));
  });
})();
