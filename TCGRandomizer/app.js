(function () {
  'use strict';

  var STORAGE_KEY = 'tcgRandomizerState_v1';
  var MAX_HISTORY = 50;
  var MAX_RECENT_SHOWN = 8;
  var SPIN_MS = 1300;
  var BURST_MS = 320;

  var RARITY_META = {
    common: { label: 'Common' },
    rare: { label: 'Rare' },
    epic: { label: 'Epic' },
    legendary: { label: 'Legendary' }
  };

  var state = null;
  var pinBuffer = '';
  var editingCardId = null;

  // ---------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function isSafeImageUrl(url) {
    if (!url) return false;
    return /^https:\/\//i.test(url) || /^data:image\//i.test(url);
  }

  function rarityGradient(rarity) {
    switch (rarity) {
      case 'legendary': return 'linear-gradient(150deg,#7c5b06,#fbbf24)';
      case 'epic': return 'linear-gradient(150deg,#4c1d78,#a855f7)';
      case 'rare': return 'linear-gradient(150deg,#0c4a6e,#38bdf8)';
      default: return 'linear-gradient(150deg,#3f3f46,#9ca3af)';
    }
  }

  function cardArtStyle(card) {
    if (card.image && isSafeImageUrl(card.image)) {
      return 'background-image:url("' + card.image.replace(/["\\]/g, '') + '")';
    }
    return 'background:' + rarityGradient(card.rarity);
  }

  function formatTime(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function totalRemaining(data) {
    return data.cards.reduce(function (sum, c) { return sum + Math.max(0, c.remaining); }, 0);
  }

  function totalQuantity(data) {
    return data.cards.reduce(function (sum, c) { return sum + Math.max(0, c.quantity); }, 0);
  }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  function seedCards() {
    return [
      { id: uid(), name: 'Rookie Trainer', rarity: 'common', image: '', quantity: 20, remaining: 20 },
      { id: uid(), name: 'Forest Scout', rarity: 'common', image: '', quantity: 15, remaining: 15 },
      { id: uid(), name: 'Storm Caller', rarity: 'rare', image: '', quantity: 8, remaining: 8 },
      { id: uid(), name: 'Shadow Duelist', rarity: 'epic', image: '', quantity: 3, remaining: 3 },
      { id: uid(), name: 'Ancient Dragon King', rarity: 'legendary', image: '', quantity: 1, remaining: 1 }
    ];
  }

  function defaultModeData(eventName) {
    return { eventName: eventName, cards: seedCards(), pulls: [], sold: 0, cardBackImage: '' };
  }

  function defaultState() {
    return {
      pin: '1234',
      activeMode: 'free',
      free: defaultModeData('Free Demo Event'),
      paid: (function () {
        var d = defaultModeData('Paid Demo Event');
        d.price = 100;
        d.currency = '\u20B1';
        return d;
      })()
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.free || !parsed.paid || !parsed.pin) return defaultState();
      [parsed.free, parsed.paid].forEach(function (d) {
        if (typeof d.cardBackImage !== 'string') d.cardBackImage = '';
        if (typeof d.sold !== 'number') d.sold = 0;
      });
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('TCG Randomizer: could not save state (storage full or unavailable)', e);
    }
  }

  function currentModeData() {
    return state[state.activeMode];
  }

  // ---------------------------------------------------------------------
  // Screen switching
  // ---------------------------------------------------------------------

  function showScreen(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].hidden = screens[i].id !== id;
    }
  }

  // ---------------------------------------------------------------------
  // Launcher rendering
  // ---------------------------------------------------------------------

  function applyPackArt(containerEl, data) {
    var face = containerEl.querySelector('.pack-face');
    if (data.cardBackImage && isSafeImageUrl(data.cardBackImage)) {
      face.style.backgroundImage = 'url("' + data.cardBackImage.replace(/["\\]/g, '') + '")';
      face.classList.add('has-custom-art');
    } else {
      face.style.backgroundImage = '';
      face.classList.remove('has-custom-art');
    }
  }

  function renderLauncher() {
    var mode = state.activeMode;
    var data = currentModeData();

    applyPackArt(document.getElementById('pack'), data);

    var badge = document.getElementById('mode-badge');
    badge.textContent = mode === 'paid' ? 'PAID MODE' : 'FREE MODE';
    badge.classList.toggle('paid', mode === 'paid');

    document.getElementById('event-name').textContent = data.eventName || 'Untitled Event';

    var remaining = totalRemaining(data);
    var total = totalQuantity(data);
    document.getElementById('remaining-count').textContent = remaining + ' / ' + total + ' packs left';

    var soldOut = remaining <= 0;
    document.getElementById('soldout-banner').hidden = !soldOut;
    document.getElementById('pack').classList.toggle('sold-out', soldOut);

    var openBtn = document.getElementById('btn-open');
    openBtn.disabled = soldOut;
    if (soldOut) {
      openBtn.textContent = 'Sold Out';
    } else if (mode === 'paid') {
      openBtn.textContent = 'Open Pack \u2014 ' + (data.currency || '') + (data.price || 0);
    } else {
      openBtn.textContent = 'Open Pack \u2014 Free';
    }

    renderRecentStrip(data);
  }

  function renderRecentStrip(data) {
    var el = document.getElementById('recent-strip');
    var pulls = data.pulls.slice(0, MAX_RECENT_SHOWN);
    if (!pulls.length) {
      el.innerHTML = '<span class="hint">No pulls yet</span>';
      return;
    }
    el.innerHTML = pulls.map(function (p) {
      return '<span class="recent-chip"><span class="swatch" style="' + cardArtStyle(p) + '"></span>' + escapeHtml(p.name) + '</span>';
    }).join('');
  }

  // ---------------------------------------------------------------------
  // Pack opening flow
  // ---------------------------------------------------------------------

  function handleOpenClick() {
    var data = currentModeData();
    if (totalRemaining(data) <= 0) return;
    if (state.activeMode === 'paid') {
      document.getElementById('pay-amount').textContent = (data.currency || '') + (data.price || 0);
      document.getElementById('modal-payment').hidden = false;
    } else {
      openPackFlow();
    }
  }

  function drawCard() {
    var data = currentModeData();
    var pool = [];
    data.cards.forEach(function (c) {
      for (var i = 0; i < c.remaining; i++) pool.push(c.id);
    });
    if (!pool.length) return null;
    var pickId = pool[Math.floor(Math.random() * pool.length)];
    var card = null;
    for (var j = 0; j < data.cards.length; j++) {
      if (data.cards[j].id === pickId) { card = data.cards[j]; break; }
    }
    card.remaining -= 1;
    data.pulls.unshift({ name: card.name, rarity: card.rarity, image: card.image, ts: Date.now() });
    if (data.pulls.length > MAX_HISTORY) data.pulls.length = MAX_HISTORY;
    data.sold = (data.sold || 0) + 1;
    return card;
  }

  function flashScreen() {
    var el = document.getElementById('screen-reveal');
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 260);
  }

  function openPackFlow() {
    var screen = document.getElementById('screen-reveal');
    var pack = document.getElementById('reveal-pack');
    var cardEl = document.getElementById('reveal-card');
    var nextBtn = document.getElementById('btn-reveal-next');

    applyPackArt(pack, currentModeData());
    screen.hidden = false;
    pack.hidden = false;
    cardEl.hidden = true;
    nextBtn.hidden = true;
    pack.classList.remove('bursting', 'spinning');
    void pack.offsetWidth;
    pack.classList.add('spinning');

    setTimeout(function () {
      pack.classList.remove('spinning');
      pack.classList.add('bursting');
      flashScreen();
      setTimeout(function () {
        var drawn = drawCard();
        pack.hidden = true;
        pack.classList.remove('bursting');
        if (!drawn) {
          screen.hidden = true;
          renderLauncher();
          return;
        }
        showRevealedCard(drawn);
        saveState();
        renderLauncher();
      }, BURST_MS);
    }, SPIN_MS);
  }

  function showRevealedCard(card) {
    var cardEl = document.getElementById('reveal-card');
    var art = document.getElementById('reveal-card-art');
    var nameEl = document.getElementById('reveal-card-name');
    var rarityEl = document.getElementById('reveal-card-rarity');
    var nextBtn = document.getElementById('btn-reveal-next');

    art.className = 'reveal-card-art rarity-' + card.rarity;
    art.setAttribute('style', cardArtStyle(card));
    art.textContent = (card.image && isSafeImageUrl(card.image)) ? '' : '\u25C6';

    nameEl.textContent = card.name;
    rarityEl.textContent = (RARITY_META[card.rarity] || RARITY_META.common).label;
    rarityEl.className = 'rarity-chip rarity-' + card.rarity;

    nextBtn.hidden = true;
    cardEl.hidden = false;

    var inner = cardEl.querySelector('.reveal-card-inner');
    inner.addEventListener('animationend', function onEnd(e) {
      if (e.target !== inner) return;
      inner.removeEventListener('animationend', onEnd);
      nextBtn.hidden = false;
      if (card.rarity === 'legendary') fireConfetti(140);
      else if (card.rarity === 'epic') fireConfetti(70);
      else if (card.rarity === 'rare') fireConfetti(30);
    });
  }

  function closeReveal() {
    document.getElementById('screen-reveal').hidden = true;
  }

  // ---------------------------------------------------------------------
  // Confetti (self-contained, no external libs)
  // ---------------------------------------------------------------------

  var confettiCtx = null;
  var confettiParticles = [];
  var confettiRAF = null;
  var CONFETTI_COLORS = ['#fbbf24', '#38bdf8', '#a855f7', '#fb7185', '#f4f4f7'];

  function ensureConfettiCanvas() {
    var canvas = document.getElementById('confetti-canvas');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    confettiCtx = canvas.getContext('2d');
    confettiCtx.setTransform(1, 0, 0, 1, 0, 0);
    confettiCtx.scale(dpr, dpr);
    return { canvas: canvas, w: w, h: h };
  }

  function fireConfetti(count) {
    var dims = ensureConfettiCanvas();
    for (var i = 0; i < count; i++) {
      confettiParticles.push({
        x: dims.w / 2 + (Math.random() - 0.5) * 60,
        y: dims.h * 0.32,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -9 - 3,
        size: 4 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 70 + Math.random() * 40
      });
    }
    if (!confettiRAF) confettiLoop();
  }

  function confettiLoop() {
    var canvas = document.getElementById('confetti-canvas');
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    confettiCtx.clearRect(0, 0, w, h);
    confettiParticles = confettiParticles.filter(function (p) {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.rotation += p.vr;
      var alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) return false;
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(alpha, 0);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rotation);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
      return true;
    });
    if (confettiParticles.length) {
      confettiRAF = requestAnimationFrame(confettiLoop);
    } else {
      confettiRAF = null;
    }
  }

  // ---------------------------------------------------------------------
  // Admin: PIN lock
  // ---------------------------------------------------------------------

  function openAdminLock() {
    pinBuffer = '';
    updatePinDots();
    document.getElementById('pin-error').hidden = true;
    showScreen('screen-admin-lock');
  }

  function updatePinDots() {
    var dots = document.querySelectorAll('.pin-dot');
    dots.forEach(function (dot, i) {
      dot.classList.toggle('filled', i < pinBuffer.length);
    });
  }

  function handleKeypad(key) {
    if (key === 'cancel') {
      showScreen('screen-launcher');
      return;
    }
    if (key === 'del') {
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinDots();
      document.getElementById('pin-error').hidden = true;
      return;
    }
    if (pinBuffer.length >= 4) return;
    pinBuffer += key;
    updatePinDots();
    if (pinBuffer.length === 4) {
      if (pinBuffer === state.pin) {
        openAdminDashboard();
      } else {
        document.getElementById('pin-error').hidden = false;
        setTimeout(function () {
          pinBuffer = '';
          updatePinDots();
        }, 350);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Admin: dashboard
  // ---------------------------------------------------------------------

  function openAdminDashboard() {
    renderAdminSettings();
    renderCardList();
    renderHistory();
    showScreen('screen-admin');
  }

  function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.admin-tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'tab-' + tab);
    });
  }

  function renderAdminSettings() {
    var mode = state.activeMode;
    var data = currentModeData();

    document.getElementById('mode-free-btn').classList.toggle('active', mode === 'free');
    document.getElementById('mode-paid-btn').classList.toggle('active', mode === 'paid');
    document.getElementById('paid-fields').style.display = mode === 'paid' ? 'flex' : 'none';

    document.getElementById('input-event-name').value = data.eventName || '';
    document.getElementById('input-currency').value = state.paid.currency || '\u20B1';
    document.getElementById('input-price').value = state.paid.price || 0;

    document.getElementById('input-back-image-url').value = data.cardBackImage || '';
    var preview = document.getElementById('back-art-preview');
    preview.style.backgroundImage = data.cardBackImage ? 'url("' + data.cardBackImage.replace(/["\\]/g, '') + '")' : '';

    document.getElementById('stat-remaining').textContent = totalRemaining(data);
    document.getElementById('stat-total').textContent = totalQuantity(data);
    document.getElementById('stat-sold').textContent = data.sold || 0;
  }

  function renderCardList() {
    var data = currentModeData();
    var el = document.getElementById('card-list');

    if (!data.cards.length) {
      el.innerHTML = '<div class="empty-state">No cards yet. Add your first card above.</div>';
      return;
    }

    el.innerHTML = data.cards.map(function (c) {
      if (c.id === editingCardId) return renderCardEditRow(c);
      return '' +
        '<div class="card-row" data-id="' + c.id + '">' +
        '  <div class="thumb" style="' + cardArtStyle(c) + '"></div>' +
        '  <div class="meta">' +
        '    <div class="name">' + escapeHtml(c.name) + '</div>' +
        '    <div class="sub"><span class="dot rarity-' + c.rarity + '"></span>' + RARITY_META[c.rarity].label + ' \u00b7 ' + c.remaining + ' / ' + c.quantity + ' left</div>' +
        '  </div>' +
        '  <div class="row-actions">' +
        '    <button class="icon-mini" data-action="restock" data-id="' + c.id + '" title="Restock this card">\u21bb</button>' +
        '    <button class="icon-mini" data-action="edit" data-id="' + c.id + '" title="Edit">\u270E</button>' +
        '    <button class="icon-mini" data-action="delete" data-id="' + c.id + '" title="Delete">\u2715</button>' +
        '  </div>' +
        '</div>';
    }).join('');
  }

  function renderCardEditRow(c) {
    return '' +
      '<div class="card-row" data-id="' + c.id + '" style="flex-wrap:wrap;">' +
      '  <div class="card-form-row" style="width:100%;">' +
      '    <input type="text" class="edit-name" value="' + escapeHtml(c.name) + '" placeholder="Card name" />' +
      '    <select class="edit-rarity">' +
      Object.keys(RARITY_META).map(function (r) {
        return '<option value="' + r + '"' + (r === c.rarity ? ' selected' : '') + '>' + RARITY_META[r].label + '</option>';
      }).join('') +
      '    </select>' +
      '  </div>' +
      '  <div class="card-form-row" style="width:100%;">' +
      '    <input type="url" class="edit-image" value="' + escapeHtml(c.image || '') + '" placeholder="Image URL (optional)" />' +
      '    <label class="file-btn">Upload<input type="file" class="edit-image-file" accept="image/*" hidden /></label>' +
      '    <input type="number" class="edit-qty" min="0" value="' + c.quantity + '" style="max-width:76px;" />' +
      '  </div>' +
      '  <div class="row-actions" style="width:100%; justify-content:flex-end;">' +
      '    <button class="btn btn-ghost" data-action="cancel-edit" data-id="' + c.id + '">Cancel</button>' +
      '    <button class="btn btn-primary" data-action="save-edit" data-id="' + c.id + '">Save</button>' +
      '  </div>' +
      '</div>';
  }

  function findCard(id) {
    var data = currentModeData();
    for (var i = 0; i < data.cards.length; i++) {
      if (data.cards[i].id === id) return data.cards[i];
    }
    return null;
  }

  function handleCardListClick(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;
    var card = findCard(id);

    if (action === 'delete') {
      if (!confirm('Delete this card?')) return;
      var data = currentModeData();
      data.cards = data.cards.filter(function (c) { return c.id !== id; });
      saveState();
      renderCardList();
      renderAdminSettings();
    } else if (action === 'restock') {
      if (!card) return;
      card.remaining = card.quantity;
      saveState();
      renderCardList();
      renderAdminSettings();
    } else if (action === 'edit') {
      editingCardId = id;
      renderCardList();
    } else if (action === 'cancel-edit') {
      editingCardId = null;
      renderCardList();
    } else if (action === 'save-edit') {
      if (!card) return;
      var row = btn.closest('.card-row');
      var name = row.querySelector('.edit-name').value.trim();
      var rarity = row.querySelector('.edit-rarity').value;
      var imageUrl = row.querySelector('.edit-image').value.trim();
      var imageFile = row.querySelector('.edit-image-file').files[0];
      var qty = Math.max(0, parseInt(row.querySelector('.edit-qty').value, 10) || 0);

      if (!name) { alert('Card name is required.'); return; }

      function commitEdit(image) {
        var diff = qty - card.quantity;
        card.name = name;
        card.rarity = rarity;
        card.image = image;
        card.quantity = qty;
        card.remaining = Math.max(0, Math.min(qty, card.remaining + (diff > 0 ? diff : 0)));

        editingCardId = null;
        saveState();
        renderCardList();
        renderAdminSettings();
      }

      if (imageFile) {
        resizeImageFile(imageFile, commitEdit);
      } else {
        commitEdit(isSafeImageUrl(imageUrl) ? imageUrl : (imageUrl ? card.image : ''));
      }
    }
  }

  function resizeImageFile(file, callback, maxW, maxH) {
    maxW = maxW || 320;
    maxH = maxH || 448;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        var w = Math.round(img.width * ratio);
        var h = Math.round(img.height * ratio);
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { callback(''); };
      img.src = reader.result;
    };
    reader.onerror = function () { callback(''); };
    reader.readAsDataURL(file);
  }

  function handleAddCardSubmit(e) {
    e.preventDefault();
    var name = document.getElementById('input-card-name').value.trim();
    var rarity = document.getElementById('input-card-rarity').value;
    var qty = Math.max(1, parseInt(document.getElementById('input-card-qty').value, 10) || 1);
    var urlInput = document.getElementById('input-card-image-url').value.trim();
    var fileInput = document.getElementById('input-card-image-file');

    if (!name) return;

    function commit(image) {
      var data = currentModeData();
      data.cards.push({ id: uid(), name: name, rarity: rarity, image: image || '', quantity: qty, remaining: qty });
      saveState();
      renderCardList();
      renderAdminSettings();
      document.getElementById('form-add-card').reset();
    }

    if (fileInput.files && fileInput.files[0]) {
      resizeImageFile(fileInput.files[0], commit);
    } else {
      commit(isSafeImageUrl(urlInput) ? urlInput : '');
    }
  }

  function renderHistory() {
    var data = currentModeData();
    document.getElementById('history-count').textContent = data.pulls.length + ' pulls';
    var el = document.getElementById('history-list');
    if (!data.pulls.length) {
      el.innerHTML = '<div class="empty-state">No pulls recorded yet.</div>';
      return;
    }
    el.innerHTML = data.pulls.map(function (p) {
      return '' +
        '<div class="history-row">' +
        '  <div class="h-name"><span class="dot rarity-' + p.rarity + '"></span>' + escapeHtml(p.name) + '</div>' +
        '  <span class="h-time">' + formatTime(p.ts) + '</span>' +
        '</div>';
    }).join('');
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------

  function init() {
    state = loadState();
    saveState();
    renderLauncher();

    document.getElementById('btn-open').addEventListener('click', handleOpenClick);
    document.getElementById('btn-admin-open').addEventListener('click', openAdminLock);
    document.getElementById('btn-admin-close').addEventListener('click', function () {
      showScreen('screen-launcher');
      renderLauncher();
    });

    document.getElementById('btn-pay-cancel').addEventListener('click', function () {
      document.getElementById('modal-payment').hidden = true;
    });
    document.getElementById('btn-pay-confirm').addEventListener('click', function () {
      document.getElementById('modal-payment').hidden = true;
      openPackFlow();
    });

    document.getElementById('btn-reveal-next').addEventListener('click', closeReveal);

    document.querySelectorAll('.key').forEach(function (btn) {
      btn.addEventListener('click', function () { handleKeypad(btn.dataset.key); });
    });

    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchAdminTab(btn.dataset.tab); });
    });

    document.getElementById('mode-free-btn').addEventListener('click', function () {
      state.activeMode = 'free';
      saveState();
      renderAdminSettings();
      renderCardList();
      renderHistory();
    });
    document.getElementById('mode-paid-btn').addEventListener('click', function () {
      state.activeMode = 'paid';
      saveState();
      renderAdminSettings();
      renderCardList();
      renderHistory();
    });

    document.getElementById('input-event-name').addEventListener('input', function (e) {
      currentModeData().eventName = e.target.value;
      saveState();
    });
    document.getElementById('input-currency').addEventListener('input', function (e) {
      state.paid.currency = e.target.value;
      saveState();
    });
    document.getElementById('input-price').addEventListener('input', function (e) {
      state.paid.price = Math.max(0, parseFloat(e.target.value) || 0);
      saveState();
    });

    document.getElementById('input-back-image-url').addEventListener('input', function (e) {
      var val = e.target.value.trim();
      currentModeData().cardBackImage = val;
      saveState();
      var preview = document.getElementById('back-art-preview');
      preview.style.backgroundImage = (val && isSafeImageUrl(val)) ? 'url("' + val.replace(/["\\]/g, '') + '")' : '';
    });
    document.getElementById('input-back-image-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      resizeImageFile(file, function (dataUrl) {
        currentModeData().cardBackImage = dataUrl;
        saveState();
        renderAdminSettings();
      }, 400, 560);
    });
    document.getElementById('btn-back-image-clear').addEventListener('click', function () {
      currentModeData().cardBackImage = '';
      document.getElementById('input-back-image-file').value = '';
      saveState();
      renderAdminSettings();
    });

    document.getElementById('btn-restock').addEventListener('click', function () {
      if (!confirm('Restock all cards to full quantity for this mode?')) return;
      var data = currentModeData();
      data.cards.forEach(function (c) { c.remaining = c.quantity; });
      saveState();
      renderAdminSettings();
      renderCardList();
    });

    document.getElementById('form-add-card').addEventListener('submit', handleAddCardSubmit);
    document.getElementById('card-list').addEventListener('click', handleCardListClick);
    document.getElementById('card-list').addEventListener('change', function (e) {
      if (!e.target.classList.contains('edit-image-file')) return;
      var label = e.target.closest('.file-btn');
      label.firstChild.textContent = e.target.files[0] ? e.target.files[0].name.slice(0, 14) : 'Upload';
    });

    var fileInput = document.getElementById('input-card-image-file');
    var fileLabel = fileInput.closest('.file-btn');
    fileInput.addEventListener('change', function () {
      fileLabel.firstChild.textContent = fileInput.files[0] ? fileInput.files[0].name.slice(0, 14) : 'Upload';
    });

    document.getElementById('btn-clear-history').addEventListener('click', function () {
      if (!confirm('Clear pull history for this mode?')) return;
      currentModeData().pulls = [];
      saveState();
      renderHistory();
    });

    document.getElementById('btn-save-pin').addEventListener('click', function () {
      var val = document.getElementById('input-new-pin').value.trim();
      if (!/^\d{4}$/.test(val)) { alert('PIN must be exactly 4 digits.'); return; }
      state.pin = val;
      saveState();
      document.getElementById('input-new-pin').value = '';
      alert('PIN updated.');
    });

    document.getElementById('btn-reset-all').addEventListener('click', function () {
      if (!confirm('This will erase ALL cards, history, and settings on this device. Continue?')) return;
      state = defaultState();
      saveState();
      renderAdminSettings();
      renderCardList();
      renderHistory();
      renderLauncher();
      alert('Everything has been reset.');
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
