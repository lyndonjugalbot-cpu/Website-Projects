/* DinoMart — about page: render FAQ accordion */
(function () {
  const A = window.DinoApp, D = window.DINO;
  const box = A.$("[data-faq]");
  if (box) {
    box.innerHTML = D.faq.map(f => `
      <details>
        <summary>${A.escapeHtml(f.q)}</summary>
        <div class="acc__body">${A.escapeHtml(f.a)}</div>
      </details>`).join("");
  }
  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  }
})();
