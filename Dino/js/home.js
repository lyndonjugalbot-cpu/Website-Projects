/* ==========================================================================
   DinoMart — homepage
   ========================================================================== */
(function () {
  const A = window.DinoApp, D = window.DINO;
  const $ = A.$, $$ = A.$$;

  /* marquee */
  const track = $("[data-marquee]");
  if (track) {
    const items = D.brands.map(b => `<span class="marquee__item">${A.escapeHtml(b)}</span>`).join("");
    track.innerHTML = items + items; // duplicate for seamless loop
  }

  /* categories */
  const cats = $("[data-cats]");
  if (cats) {
    const glyphs = { toys: "🦖", shwag: "👕" };
    const rows = [];
    D.categories.forEach(c => {
      rows.push(`<a class="cat-card" href="shop.html?cat=${c.id}">
        <span class="glyph">${glyphs[c.id] || "✦"}</span>
        <b>${A.escapeHtml(c.label)}</b><span>${A.escapeHtml(c.blurb)}</span></a>`);
    });
    // plus a few highlighted subcategories
    [
      ["toys", "Funko Pop!", "🧸"], ["toys", "Magic: The Gathering", "🃏"],
      ["toys", "Dinosaurs!", "🦕"], ["shwag", "Limited Editions", "🗿"]
    ].forEach(([cat, sub, g]) => {
      rows.push(`<a class="cat-card" href="shop.html?cat=${cat}&sub=${encodeURIComponent(sub)}">
        <span class="glyph">${g}</span><b>${A.escapeHtml(sub)}</b><span>Shop the category</span></a>`);
    });
    cats.innerHTML = rows.join("");
  }

  /* product sections */
  const featured = D.products.filter(p => p.featured);
  A.renderCards(featured.slice(0, 8), $("[data-featured]"));

  const best = [...D.products].sort((a, b) => (b.rating * b.reviews) - (a.rating * a.reviews)).slice(0, 8);
  A.renderCards(best, $("[data-bestsellers]"));

  /* drop card */
  const dropCard = $("[data-drop-card]");
  const drop = D.products.find(p => p.drop) || D.products[0];
  if (dropCard && drop) {
    dropCard.innerHTML = `
      <article class="pcard" style="max-width:420px;margin-inline:auto">
        <div class="pcard__media">${A.productArt(drop)}
          <div class="pcard__badges"><span class="tag tag--fire">Next Drop</span></div>
        </div>
        <div class="pcard__body">
          <span class="pcard__brand">${A.escapeHtml(drop.brand)}</span>
          <a class="pcard__title" href="product.html?id=${encodeURIComponent(drop.id)}">${A.escapeHtml(drop.name)}</a>
          <p class="muted" style="font-size:.86rem;margin:.4rem 0 0">${A.escapeHtml(drop.blurb)}</p>
          <div class="pcard__foot">
            <span class="price">${A.money(drop.price)}</span>
            <a class="btn btn--jungle btn--sm" href="product.html?id=${encodeURIComponent(drop.id)}">Preview</a>
          </div>
        </div>
      </article>`;
  }

  /* testimonials */
  const tw = $("[data-testimonials]");
  if (tw) {
    tw.innerHTML = D.testimonials.map(t => `
      <div class="tcard">
        <span class="pcard__rating">${A.stars(t.stars)}</span>
        <p>“${A.escapeHtml(t.quote)}”</p>
        <div class="who">
          <span class="av">${A.escapeHtml(t.name[0])}</span>
          <span><b>${A.escapeHtml(t.name)}</b><span>${A.escapeHtml(t.role)}</span></span>
        </div>
      </div>`).join("");
  }

  /* newsletter */
  const nf = $("[data-newsletter]");
  if (nf) nf.addEventListener("submit", e => {
    e.preventDefault();
    const email = new FormData(nf).get("email");
    nf.innerHTML = `<p style="margin:0;color:var(--jungle-soft);font-weight:600">🦖 You're on the list, ${A.escapeHtml(String(email).split("@")[0])}! Watch your inbox for the next drop.</p>`;
    A.toast("Subscribed — welcome to the pack!", "ok");
  });

  /* keep money fresh on currency change */
  document.addEventListener("dino:currency", () => {
    A.renderCards(featured.slice(0, 8), $("[data-featured]"));
    A.renderCards(best, $("[data-bestsellers]"));
  });
})();
