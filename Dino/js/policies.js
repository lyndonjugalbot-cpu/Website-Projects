/* ==========================================================================
   DinoMart — policies / support page
   ========================================================================== */
(function () {
  const A = window.DinoApp;
  const $ = A.$, $$ = A.$$;

  /* scroll-spy on the policy nav */
  const nav = $("[data-policy-nav]");
  const links = $$("a", nav);
  const targets = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(l => l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-20% 0px -70% 0px" });
  targets.forEach(t => spy.observe(t));

  links.forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    document.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", a.getAttribute("href"));
  }));

  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  }

  /* track order (mock) */
  const tf = $("[data-track-form]");
  tf?.addEventListener("submit", e => {
    e.preventDefault();
    const order = new FormData(tf).get("order");
    const stages = ["Order received", "Packed", "Shipped", "Out for delivery"];
    const at = 2;
    $("[data-track-result]").hidden = false;
    $("[data-track-result]").innerHTML = `
      <div class="card">
        <strong>${A.escapeHtml(String(order))}</strong> — estimated delivery in 3–5 business days
        <div style="display:flex;gap:6px;margin-top:14px">
          ${stages.map((s, i) => `
            <div style="flex:1;text-align:center">
              <div style="height:6px;border-radius:99px;background:${i <= at ? "var(--grad-fire)" : "var(--surface-2)"}"></div>
              <span style="font-size:.72rem;color:${i <= at ? "var(--text)" : "var(--text-mute)"};display:block;margin-top:6px">${s}</span>
            </div>`).join("")}
        </div>
        <p class="muted" style="font-size:.82rem;margin:12px 0 0">Carrier: DinoFreight · Last scan: regional facility, in transit.</p>
      </div>`;
    A.toast("Tracking loaded (demo data)", "info");
  });

  /* contact form (mock) */
  const cf = $("[data-contact-form]");
  cf?.addEventListener("submit", e => {
    e.preventDefault();
    const name = new FormData(cf).get("name");
    cf.reset();
    const r = $("[data-contact-result]");
    r.hidden = false;
    r.textContent = `Thanks ${String(name).split(" ")[0]} — your message is in. We'll reply within one business day. 🦖`;
    A.toast("Message sent", "ok");
  });
})();
