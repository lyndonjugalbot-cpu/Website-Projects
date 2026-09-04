/* ==========================================================================
   DinoMart — wishlist page
   ========================================================================== */
(function () {
  const A = window.DinoApp, D = window.DINO;
  const $ = A.$;

  function items() {
    return [...A.favs()].map(id => D.products.find(p => p.id === id)).filter(Boolean);
  }

  function render() {
    const list = items();
    $("[data-wish-count]").textContent = list.length ? `${list.length} item${list.length === 1 ? "" : "s"} saved.` : "";
    $("[data-wish-empty]").hidden = list.length !== 0;
    $("[data-wishlist]").hidden = list.length === 0;
    $("[data-wish-actions]").hidden = list.length === 0;
    if (list.length) A.renderCards(list, $("[data-wishlist]"));
  }

  $("[data-add-all]").onclick = () => {
    const inStock = items().filter(p => p.inStock);
    if (!inStock.length) { A.toast("Nothing in stock to add", "info"); return; }
    inStock.forEach(p => A.addToCart(p.id, 1, { silent: true }));
    A.toast(`Added ${inStock.length} item${inStock.length === 1 ? "" : "s"} to cart`, "ok");
    A.openDrawer();
  };
  $("[data-clear-wish]").onclick = () => {
    items().forEach(p => A.toggleFav(p.id));
    render();
  };

  document.addEventListener("dino:fav", render);
  document.addEventListener("dino:currency", render);
  render();
})();
