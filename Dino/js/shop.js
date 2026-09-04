/* ==========================================================================
   DinoMart — shop / catalogue with filters, sort, search, URL sync
   ========================================================================== */
(function () {
  const A = window.DinoApp, D = window.DINO;
  const $ = A.$, $$ = A.$$;
  const PAGE = 12;

  const params = new URLSearchParams(location.search);
  const state = {
    cats:   new Set(params.get("cat") ? params.get("cat").split(",") : []),
    subs:   new Set(params.get("sub") ? [params.get("sub")] : []),
    brands: new Set(),
    avail:  new Set(),
    min:    params.get("min") ? +params.get("min") : null,
    max:    params.get("max") ? +params.get("max") : null,
    q:      params.get("q") || "",
    sort:   params.get("sort") || (params.get("sale") ? "price-desc" : "best"),
    saleOnly: params.get("sale") === "1",
    shown:  PAGE
  };
  if (params.get("sort") === "new") state.sort = "new";

  /* ---- build filter UI ---- */
  const catBox = $("[data-f-cat]"), subBox = $("[data-f-sub]"), brandBox = $("[data-f-brand]");
  const allSubs = [...new Set(D.products.map(p => p.sub))].sort();
  const allBrands = [...new Set(D.products.map(p => p.brand))].sort();

  catBox.innerHTML = D.categories.map(c =>
    `<label class="check"><input type="checkbox" data-cat value="${c.id}" ${state.cats.has(c.id) ? "checked" : ""}> ${A.escapeHtml(c.label)}
      <span class="n">${D.products.filter(p => p.category === c.id).length}</span></label>`).join("");
  subBox.innerHTML = allSubs.map(s =>
    `<label class="check"><input type="checkbox" data-sub value="${A.escapeAttr(s)}" ${state.subs.has(s) ? "checked" : ""}> ${A.escapeHtml(s)}
      <span class="n">${D.products.filter(p => p.sub === s).length}</span></label>`).join("");
  brandBox.innerHTML = allBrands.map(b =>
    `<label class="check"><input type="checkbox" data-brand value="${A.escapeAttr(b)}"> ${A.escapeHtml(b)}
      <span class="n">${D.products.filter(p => p.brand === b).length}</span></label>`).join("");
  $("[data-n-in]").textContent = D.products.filter(p => p.inStock).length;
  $("[data-n-out]").textContent = D.products.filter(p => !p.inStock).length;
  $("[data-cur-code]") && ($("[data-cur-code]").textContent = A.currency());

  const searchEl = $("[data-search]"); searchEl.value = state.q;
  const sortEl = $("[data-sort]"); sortEl.value = state.sort;
  $("[data-f-min]").value = state.min ?? "";
  $("[data-f-max]").value = state.max ?? "";

  /* ---- page title from category ---- */
  if (state.cats.size === 1) {
    const c = D.categories.find(x => x.id === [...state.cats][0]);
    if (c) { $("[data-shop-title]").textContent = c.label; $("[data-shop-sub]").textContent = c.blurb; }
  }
  if (state.subs.size === 1) $("[data-shop-title]").textContent = [...state.subs][0];
  if (state.saleOnly) { $("[data-shop-title]").textContent = "On Sale"; $("[data-shop-sub]").textContent = "Marked-down figures, sets and shwag while stocks last."; }

  /* ---- filtering ---- */
  function filtered() {
    let list = D.products.slice();
    if (state.cats.size)   list = list.filter(p => state.cats.has(p.category));
    if (state.subs.size)   list = list.filter(p => state.subs.has(p.sub));
    if (state.brands.size) list = list.filter(p => state.brands.has(p.brand));
    if (state.avail.size)  list = list.filter(p => (state.avail.has("in") && p.inStock) || (state.avail.has("out") && !p.inStock));
    if (state.saleOnly)    list = list.filter(p => p.compareAt);
    if (state.min != null) list = list.filter(p => p.price >= state.min);
    if (state.max != null) list = list.filter(p => p.price <= state.max);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter(p => (p.name + " " + p.brand + " " + p.sub + " " + p.tags.join(" ") + " " + p.blurb).toLowerCase().includes(q));
    }
    const idx = id => D.products.findIndex(p => p.id === id);
    switch (state.sort) {
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "az": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "za": list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "new": list.sort((a, b) => idx(a.id) - idx(b.id)); break;
      case "old": list.sort((a, b) => idx(b.id) - idx(a.id)); break;
      default: list.sort((a, b) => (b.rating * b.reviews) - (a.rating * a.reviews));
    }
    return list;
  }

  /* ---- render ---- */
  function render() {
    const list = filtered();
    const slice = list.slice(0, state.shown);
    A.renderCards(slice, $("[data-results]"));
    $("[data-count-label]").textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
    $("[data-empty]").hidden = list.length !== 0;
    $("[data-results]").hidden = list.length === 0;
    $("[data-more-wrap]").hidden = list.length <= state.shown;
    renderChips();
    syncURL();
  }

  function renderChips() {
    const chips = [];
    state.cats.forEach(c => chips.push(["cat", c, (D.categories.find(x => x.id === c) || {}).label || c]));
    state.subs.forEach(s => chips.push(["sub", s, s]));
    state.brands.forEach(b => chips.push(["brand", b, b]));
    state.avail.forEach(a => chips.push(["avail", a, a === "in" ? "In stock" : "Waitlist"]));
    if (state.min != null) chips.push(["min", "", `Min ${A.money(state.min)}`]);
    if (state.max != null) chips.push(["max", "", `Max ${A.money(state.max)}`]);
    if (state.q) chips.push(["q", "", `“${state.q}”`]);
    if (state.saleOnly) chips.push(["sale", "", "On sale"]);
    const box = $("[data-chips]");
    box.innerHTML = chips.map(([k, v, label]) =>
      `<span class="chip">${A.escapeHtml(label)} <button data-chip-k="${k}" data-chip-v="${A.escapeAttr(v)}" aria-label="Remove filter">×</button></span>`).join("");
    $$("[data-chip-k]", box).forEach(b => b.onclick = () => removeChip(b.dataset.chipK, b.dataset.chipV));
  }
  function removeChip(k, v) {
    if (k === "cat") state.cats.delete(v);
    else if (k === "sub") state.subs.delete(v);
    else if (k === "brand") state.brands.delete(v);
    else if (k === "avail") state.avail.delete(v);
    else if (k === "min") { state.min = null; $("[data-f-min]").value = ""; }
    else if (k === "max") { state.max = null; $("[data-f-max]").value = ""; }
    else if (k === "q") { state.q = ""; searchEl.value = ""; }
    else if (k === "sale") state.saleOnly = false;
    syncInputs();
    state.shown = PAGE;
    render();
  }
  function syncInputs() {
    $$("[data-cat]").forEach(i => i.checked = state.cats.has(i.value));
    $$("[data-sub]").forEach(i => i.checked = state.subs.has(i.value));
    $$("[data-brand]").forEach(i => i.checked = state.brands.has(i.value));
    $$("[data-f-avail]").forEach(i => i.checked = state.avail.has(i.value));
  }

  function syncURL() {
    const p = new URLSearchParams();
    if (state.cats.size) p.set("cat", [...state.cats].join(","));
    if (state.subs.size) p.set("sub", [...state.subs][0]);
    if (state.q) p.set("q", state.q);
    if (state.sort !== "best") p.set("sort", state.sort);
    if (state.min != null) p.set("min", state.min);
    if (state.max != null) p.set("max", state.max);
    if (state.saleOnly) p.set("sale", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }

  /* ---- events ---- */
  let deb;
  searchEl.addEventListener("input", () => {
    clearTimeout(deb);
    deb = setTimeout(() => { state.q = searchEl.value.trim(); state.shown = PAGE; render(); }, 220);
  });
  sortEl.addEventListener("change", () => { state.sort = sortEl.value; render(); });
  catBox.addEventListener("change", e => { const i = e.target; i.checked ? state.cats.add(i.value) : state.cats.delete(i.value); state.shown = PAGE; render(); });
  subBox.addEventListener("change", e => { const i = e.target; i.checked ? state.subs.add(i.value) : state.subs.delete(i.value); state.shown = PAGE; render(); });
  brandBox.addEventListener("change", e => { const i = e.target; i.checked ? state.brands.add(i.value) : state.brands.delete(i.value); state.shown = PAGE; render(); });
  $$("[data-f-avail]").forEach(i => i.addEventListener("change", () => { i.checked ? state.avail.add(i.value) : state.avail.delete(i.value); state.shown = PAGE; render(); }));
  $("[data-f-min]").addEventListener("change", e => { state.min = e.target.value === "" ? null : Math.max(0, +e.target.value); state.shown = PAGE; render(); });
  $("[data-f-max]").addEventListener("change", e => { state.max = e.target.value === "" ? null : Math.max(0, +e.target.value); state.shown = PAGE; render(); });
  $$("[data-clear-filters]").forEach(b => b.addEventListener("click", () => {
    state.cats.clear(); state.subs.clear(); state.brands.clear(); state.avail.clear();
    state.min = state.max = null; state.q = ""; state.saleOnly = false; state.shown = PAGE;
    searchEl.value = ""; $("[data-f-min]").value = ""; $("[data-f-max]").value = "";
    syncInputs(); render();
  }));
  $("[data-more]").addEventListener("click", () => { state.shown += PAGE; render(); });

  /* mobile filter drawer */
  $("[data-open-filters]")?.addEventListener("click", () => { $("#filters").classList.add("open"); document.body.style.overflow = "hidden"; });
  $("[data-close-filters]")?.addEventListener("click", () => { $("#filters").classList.remove("open"); document.body.style.overflow = ""; });

  document.addEventListener("dino:currency", () => { $("[data-cur-code]").textContent = A.currency(); render(); });

  render();
})();
