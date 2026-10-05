/* PCMOTOH Computer Trading — site interactions */
(() => {
  const PHONE = '+639913143133';
  // EDIT: swap for the client's Messenger link (m.me/…) if they have one
  const FACEBOOK_URL = 'https://www.facebook.com/p/PCmoToh-Cebu-100077209550892/';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav: scrolled state ---------- */
  const nav = $('#nav');
  const actionBar = $('#actionBar');
  const hero = $('.hero');
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 12);
    if (actionBar && hero) actionBar.classList.toggle('is-visible', y > hero.offsetHeight * 0.6);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const toggle = $('#navToggle');
  const menu = $('#mobileMenu');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Active nav link ---------- */
  const navLinks = $$('.nav-links a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = '#' + entry.target.id;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Card spotlight (follows the pointer) ---------- */
  if (window.matchMedia('(hover: hover)').matches) {
    $$('.spot').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Build filters ---------- */
  const filters = $$('.filter');
  const buildCards = $$('.build-grid > article');
  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filters.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      buildCards.forEach((card) => {
        const cats = (card.dataset.cat || '').split(' ');
        const show = f === 'all' || cats.includes(f);
        card.classList.toggle('is-hidden', !show);
        if (show) card.classList.add('is-in');
      });
    });
  });

  /* ---------- Quote form ---------- */
  const form = $('#quoteForm');
  const nameInput = $('#name');
  const nameError = $('#nameError');
  const selectedBox = $('#selectedBuild');
  const selectedName = $('#selectedBuildName');
  let selectedBuild = '';

  const setBuild = (label) => {
    selectedBuild = label;
    selectedName.textContent = label;
    selectedBox.hidden = !label;
  };
  $('#clearBuild').addEventListener('click', () => setBuild(''));

  $$('[data-quote-build]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setBuild(btn.dataset.quoteBuild);
      $('#quote').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      setTimeout(() => nameInput.focus({ preventScroll: true }), reduceMotion ? 0 : 700);
    });
  });

  const buildMessage = () => {
    const data = new FormData(form);
    const uses = data.getAll('use');
    const budget = data.get('budget');
    const name = (data.get('name') || '').trim();
    const extra = (data.get('message') || '').trim();
    const lines = [`Hi PCMOTOH! This is ${name}.`];
    if (selectedBuild) lines.push(`I'm interested in the ${selectedBuild} build.`);
    if (uses.length) lines.push(`It's for: ${uses.join(', ')}.`);
    if (budget) lines.push(`Budget: ${budget}.`);
    if (extra) lines.push('', extra);
    return lines.join('\n');
  };

  const validate = () => {
    const ok = nameInput.value.trim().length > 0;
    nameInput.setAttribute('aria-invalid', String(!ok));
    nameError.hidden = ok;
    if (!ok) nameInput.focus();
    return ok;
  };
  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim()) { nameInput.removeAttribute('aria-invalid'); nameError.hidden = true; }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    // "?&body=" is understood by both iOS and Android messaging apps
    window.location.href = `sms:${PHONE}?&body=${encodeURIComponent(buildMessage())}`;
  });

  $('[data-send="facebook"]').addEventListener('click', async () => {
    if (!validate()) return;
    // Start the copy while this tab still has focus, then open Facebook
    const copying = navigator.clipboard ? navigator.clipboard.writeText(buildMessage()) : Promise.reject();
    const fbWindow = window.open(FACEBOOK_URL, '_blank');
    if (fbWindow) fbWindow.opener = null;
    let copied = false;
    try { await copying; copied = true; } catch { /* clipboard unavailable */ }
    toast(copied ? 'Message copied — paste it into Messenger.' : 'Opening Facebook — send us your build details there.');
    if (!fbWindow) window.location.href = FACEBOOK_URL;
  });

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 4200);
  }

  /* ---------- Open / closed status (shop time, Asia/Manila) ---------- */
  // Hours: Mon–Sat 10:00–21:00. Sunday afternoons by appointment.
  const statusEls = $$('[data-open-status]');
  const updateStatus = () => {
    let day, mins;
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
          .formatToParts(new Date()).map((p) => [p.type, p.value])
      );
      day = parts.weekday;
      mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
    } catch { return; } // leave the static hours text in place

    const OPEN = 10 * 60, CLOSE = 21 * 60;
    let text, open = false;
    if (day === 'Sun') {
      text = 'Sunday · afternoons by appointment';
    } else if (mins >= OPEN && mins < CLOSE) {
      open = true;
      text = 'Open now · until 9 PM';
    } else if (mins < OPEN) {
      text = 'Closed · opens 10 AM';
    } else {
      text = day === 'Sat' ? 'Closed · Sunday by appointment' : 'Closed · opens 10 AM tomorrow';
    }
    statusEls.forEach((el) => {
      el.textContent = text;
      const wrap = el.parentElement;
      wrap.classList.toggle('is-open', open);
      wrap.classList.toggle('is-closed', !open);
    });
  };
  updateStatus();
  setInterval(updateStatus, 60 * 1000);

  /* ---------- Footer year ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
