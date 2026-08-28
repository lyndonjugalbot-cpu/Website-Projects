/* SSK Receipt Tracker - UI controller.
 *
 * The page is a thin client over /api/dashboard: every range change is one
 * fetch that returns the receipts and every aggregate already computed, so the
 * browser never re-derives totals the server has authoritative numbers for.
 */
(function () {
  'use strict';

  var root = document.getElementById('app');
  var CURRENCY = root.dataset.currency;
  var LOCALE = root.dataset.locale || undefined;
  var THEME_KEY = 'ssk-theme';
  var PAGE = 60;            // rows drawn before the "show more" step
  var RANGE_KEY = 'ssk-range';

  var state = {
    start: null,
    end: null,
    preset: 'this-month',
    receipts: [],
    summary: null,
    bounds: { earliest: null, latest: null, today: null },
    search: '',
    sort: { key: 'date', dir: 'desc' },
    limit: PAGE,
    loading: false
  };

  // --- formatting ----------------------------------------------------------

  var moneyFmt = new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  var moneyWhole = new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: CURRENCY, maximumFractionDigits: 0
  });
  var moneyCompact = new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1
  });

  /** `short` trades exact centavos for a value that fits on an axis or a bar. */
  function money(value, short) {
    var n = Number(value) || 0;
    if (!short) return moneyFmt.format(n);
    if (Math.abs(n) >= 1e6) return moneyCompact.format(n);
    return moneyWhole.format(n);
  }

  /** One notation for a whole axis or label column, chosen from its maximum. */
  function axisMoney(max) {
    var compact = Math.abs(max) >= 1e6;
    return function (value) {
      return (compact ? moneyCompact : moneyWhole).format(Number(value) || 0);
    };
  }

  function toDate(iso) {
    // Build in local time: `new Date('2026-08-27')` is parsed as UTC and can
    // render as the 26th for anyone west of Greenwich.
    var parts = String(iso).split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }

  function iso(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  var dayFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
  var dayShortFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  var esc = window.SSKCharts.escapeHtml;

  // --- date presets --------------------------------------------------------

  function today() {
    return state.bounds.today ? toDate(state.bounds.today) : new Date();
  }

  function presetRange(name) {
    var now = today();
    var y = now.getFullYear(), m = now.getMonth();
    switch (name) {
      case 'this-month':
        return [new Date(y, m, 1), now];
      case 'last-month':
        return [new Date(y, m - 1, 1), new Date(y, m, 0)];
      case 'last-90':
        return [new Date(y, m, now.getDate() - 89), now];
      case 'ytd':
        return [new Date(y, 0, 1), now];
      case 'all':
        return [
          state.bounds.earliest ? toDate(state.bounds.earliest) : new Date(y, m, 1),
          state.bounds.latest && toDate(state.bounds.latest) > now ? toDate(state.bounds.latest) : now
        ];
      default:
        return [new Date(y, m, 1), now];
    }
  }

  function applyPreset(name) {
    var range = presetRange(name);
    state.preset = name;
    state.start = iso(range[0]);
    state.end = iso(range[1]);
    syncFilterInputs();
    try { localStorage.setItem(RANGE_KEY, name); } catch (e) { /* private mode */ }
  }

  function syncFilterInputs() {
    $('#f-start').value = state.start || '';
    $('#f-end').value = state.end || '';
    $$('#presets .segmented__btn').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.preset === state.preset));
    });
    var qs = '?start=' + encodeURIComponent(state.start) + '&end=' + encodeURIComponent(state.end);
    $('#export-csv').href = '/api/export.csv' + qs;
  }

  // --- DOM helpers ---------------------------------------------------------

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  function toast(message, kind, action) {
    var node = document.createElement('div');
    node.className = 'toast' + (kind ? ' toast--' + kind : '');
    node.innerHTML = '<span>' + esc(message) + '</span>';
    if (action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast__undo';
      btn.textContent = action.label;
      btn.addEventListener('click', function () { node.remove(); action.run(); });
      node.appendChild(btn);
    }
    $('#toasts').appendChild(node);
    setTimeout(function () { node.remove(); }, action ? 8000 : 4000);
  }

  function setFieldError(inputId, errorId, message) {
    var input = $(inputId), error = $(errorId);
    error.textContent = message || '';
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(prefix) {
    ['name', 'amount', 'date'].forEach(function (f) {
      var input = $('#' + prefix + '-' + f);
      var error = $('#err-' + (prefix === 'f' ? '' : prefix + '-') + f);
      if (input) input.removeAttribute('aria-invalid');
      if (error) error.textContent = '';
    });
  }

  // --- data ----------------------------------------------------------------

  async function api(path, options) {
    var response = await fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, options));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.ok === false) {
      var err = new Error(data.error || 'Something went wrong. Please try again.');
      err.field = data.field;
      throw err;
    }
    return data;
  }

  async function load() {
    state.loading = true;
    try {
      var qs = '?start=' + encodeURIComponent(state.start) + '&end=' + encodeURIComponent(state.end);
      var data = await api('/api/dashboard' + qs);
      state.receipts = data.receipts;
      state.summary = data.summary;
      state.limit = PAGE;
      state.bounds = data.bounds;
      renderSuggestions(data.suggestions);
      render();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      state.loading = false;
    }
  }

  // --- rendering -----------------------------------------------------------

  function render() {
    renderCaption();
    renderKpis();
    renderCharts();
    renderReceipts();
  }

  function renderCaption() {
    var s = state.summary;
    if (!s) return;
    var start = toDate(s.range.start), end = toDate(s.range.end);
    var sameYear = start.getFullYear() === end.getFullYear();
    $('#range-caption').textContent =
      (sameYear ? dayShortFmt.format(start) : dayFmt.format(start)) + ' – ' + dayFmt.format(end) +
      ' · ' + plural(s.range.days, 'day');
  }

  function deltaMarkup(pct) {
    if (pct === null || pct === undefined) return '';
    var up = pct > 0;
    var arrow = up
      ? '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/></svg>'
      : '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5"/></svg>';
    if (pct === 0) return '<span class="delta">no change</span>';
    return '<span class="delta delta--' + (up ? 'up' : 'down') + '">' + arrow +
      Math.abs(pct).toFixed(1) + '%</span>';
  }

  function renderKpis() {
    var s = state.summary;
    if (!s) return;

    $('#kpi-total').textContent = money(s.total);
    $('#kpi-total-meta').innerHTML = s.change_pct === null
      ? '<span>no comparable period before this one</span>'
      : deltaMarkup(s.change_pct) + ' vs previous ' + plural(s.range.days, 'day') +
        ' (' + money(s.previous_total, true) + ')';

    $('#kpi-count').textContent = s.count.toLocaleString(LOCALE);
    $('#kpi-count-meta').textContent = s.count
      ? money(s.daily_average, true) + ' per day on average'
      : 'nothing logged in this range';

    $('#kpi-average').textContent = money(s.average);
    $('#kpi-average-meta').textContent = s.largest_receipt
      ? 'largest ' + money(s.largest_receipt.total, true) + ' · ' +
        dayShortFmt.format(toDate(s.largest_receipt.date))
      : '—';

    $('#kpi-top').textContent = s.top_area ? s.top_area.name : '—';
    $('#kpi-top').title = s.top_area ? s.top_area.name : '';
    $('#kpi-top-meta').textContent = s.top_area
      ? money(s.top_area.total, true) + ' · ' + s.top_area.share + '% of ' +
        plural(s.area_count, 'area')
      : 'no receipts yet';
  }

  var drawAreas, drawSeries;

  function renderCharts() {
    var s = state.summary;
    if (!s) return;

    $('#series-sub').textContent = {
      day: 'Daily totals across the range.',
      week: 'Weekly totals (weeks start Monday).',
      month: 'Monthly totals across the range.'
    }[s.series.granularity];

    drawAreas = function () {
      window.SSKCharts.bars($('#chart-areas'), {
        items: state.summary.chart_areas,
        money: money,
        axisMoney: axisMoney,
        ariaLabel: 'Spending by area, largest first'
      });
    };
    drawSeries = function () {
      window.SSKCharts.series($('#chart-series'), {
        points: state.summary.series.points,
        money: money,
        axisMoney: axisMoney,
        ariaLabel: 'Spending over time'
      });
    };
    drawAreas();
    drawSeries();

    renderChartTable('areas');
    renderChartTable('series');
  }

  /** Every value in a chart is also reachable as text - tooltips never gate data. */
  function renderChartTable(which) {
    var host = $('#' + which + '-table');
    var rows, head;
    if (which === 'areas') {
      head = '<tr><th>Area</th><th class="num">Receipts</th><th class="num">Total</th><th class="num">Share</th></tr>';
      rows = state.summary.areas.map(function (a) {
        return '<tr><td>' + esc(a.name) + '</td><td class="num">' + a.count +
          '</td><td class="num">' + money(a.total) + '</td><td class="num">' + a.share + '%</td></tr>';
      });
    } else {
      head = '<tr><th>Period</th><th class="num">Receipts</th><th class="num">Total</th></tr>';
      rows = state.summary.series.points.map(function (p) {
        return '<tr><td>' + esc(p.label) + '</td><td class="num">' + p.count +
          '</td><td class="num">' + money(p.total) + '</td></tr>';
      });
    }
    host.innerHTML = rows.length
      ? '<table><thead>' + head + '</thead><tbody>' + rows.join('') + '</tbody></table>'
      : '<p class="empty">Nothing to show for this range.</p>';
  }

  function visibleReceipts() {
    var term = state.search.trim().toLowerCase();
    var list = term
      ? state.receipts.filter(function (r) { return r.name.toLowerCase().includes(term); })
      : state.receipts.slice();

    var key = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
    list.sort(function (a, b) {
      var cmp;
      if (key === 'amount') cmp = a.amount - b.amount;
      else if (key === 'name') cmp = a.name.localeCompare(b.name, LOCALE);
      else cmp = a.date.localeCompare(b.date);
      // Stable tiebreak on id, so equal dates keep a predictable order.
      return cmp !== 0 ? cmp * dir : (a.id - b.id) * dir;
    });
    return list;
  }

  var EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5 17.5 10.5"/></svg>';
  var DELETE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';

  function renderReceipts() {
    var list = visibleReceipts();
    var body = $('#receipts-body');
    var total = list.reduce(function (sum, r) { return sum + r.amount; }, 0);
    // A multi-year range can hold thousands of rows; draw a page at a time so
    // the table never stalls the browser.
    var shown = list.slice(0, state.limit);

    $('#receipts-sub').textContent = state.search
      ? plural(list.length, 'match') + ' · ' + money(total)
      : plural(state.receipts.length, 'receipt') + ' in this range';

    body.innerHTML = shown.map(function (r) {
      return '<tr data-id="' + r.id + '">' +
        '<td class="cell-date">' + esc(dayFmt.format(toDate(r.date))) + '</td>' +
        '<td class="cell-name">' + esc(r.name) + '</td>' +
        '<td class="num cell-amount">' + money(r.amount) + '</td>' +
        '<td class="cell-actions">' +
          '<button type="button" class="row-btn" data-action="edit" ' +
            'aria-label="Edit ' + esc(r.name) + '" title="Edit">' + EDIT_ICON + '</button>' +
          '<button type="button" class="row-btn row-btn--danger" data-action="delete" ' +
            'aria-label="Delete ' + esc(r.name) + '" title="Delete">' + DELETE_ICON + '</button>' +
        '</td></tr>';
    }).join('');

    var more = $('#receipts-more');
    var remaining = list.length - shown.length;
    more.hidden = remaining <= 0;
    if (remaining > 0) {
      $('#receipts-more-btn').textContent =
        'Show ' + Math.min(PAGE, remaining) + ' more (' + remaining + ' hidden)';
    }

    var empty = $('#receipts-empty');
    if (list.length) {
      empty.hidden = true;
    } else {
      empty.hidden = false;
      empty.textContent = state.receipts.length
        ? 'No receipts match “' + state.search + '”.'
        : 'No receipts in this range yet. Add one from the panel on the left.';
    }

    $$('.th-sort').forEach(function (btn) {
      if (btn.dataset.sort === state.sort.key) btn.dataset.dir = state.sort.dir;
      else btn.removeAttribute('data-dir');
    });
  }

  function renderSuggestions(names) {
    $('#name-options').innerHTML = names.map(function (n) {
      return '<option value="' + esc(n) + '"></option>';
    }).join('');
  }

  // --- actions -------------------------------------------------------------

  async function submitReceipt(event) {
    event.preventDefault();
    clearErrors('f');
    var button = $('#f-submit');
    button.disabled = true;

    var payload = {
      name: $('#f-name').value,
      amount: $('#f-amount').value,
      date: $('#f-date').value
    };

    try {
      var data = await api('/api/receipts', { method: 'POST', body: JSON.stringify(payload) });
      $('#f-name').value = '';
      $('#f-amount').value = '';
      $('#f-name').focus();
      toast('Added ' + data.receipt.name + ' · ' + money(data.receipt.amount), 'success');
      await ensureVisible(data.receipt.date);
      await load();
    } catch (err) {
      if (err.field) setFieldError('#f-' + err.field, '#err-' + err.field, err.message);
      else toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  /** Widen the filter if a just-saved receipt would land outside it. */
  async function ensureVisible(date) {
    if (date >= state.start && date <= state.end) return;
    if (date < state.start) state.start = date;
    if (date > state.end) state.end = date;
    state.preset = 'custom';
    syncFilterInputs();
    toast('Range widened to include ' + dayFmt.format(toDate(date)) + '.');
  }

  var editing = null;

  function openEdit(id) {
    var receipt = state.receipts.find(function (r) { return r.id === id; });
    if (!receipt) return;
    editing = receipt;
    clearErrors('e');
    $('#e-name').value = receipt.name;
    $('#e-amount').value = receipt.amount.toFixed(2);
    $('#e-date').value = receipt.date;
    $('#edit-dialog').showModal();
    $('#e-name').focus();
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing) return;
    clearErrors('e');
    var button = $('#edit-save');
    button.disabled = true;
    try {
      await api('/api/receipts/' + editing.id, {
        method: 'PUT',
        body: JSON.stringify({
          name: $('#e-name').value, amount: $('#e-amount').value, date: $('#e-date').value
        })
      });
      $('#edit-dialog').close();
      editing = null;
      toast('Receipt updated.', 'success');
      await load();
    } catch (err) {
      if (err.field) setFieldError('#e-' + err.field, '#err-e-' + err.field, err.message);
      else toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function removeReceipt(id) {
    try {
      var data = await api('/api/receipts/' + id, { method: 'DELETE' });
      var gone = data.receipt;
      await load();
      toast('Deleted ' + gone.name + ' · ' + money(gone.amount), null, {
        label: 'Undo',
        run: async function () {
          try {
            await api('/api/receipts', {
              method: 'POST',
              body: JSON.stringify({ name: gone.name, amount: gone.amount, date: gone.date })
            });
            toast('Restored ' + gone.name + '.', 'success');
            await load();
          } catch (err) { toast(err.message, 'error'); }
        }
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // --- theme ---------------------------------------------------------------

  function currentTheme() {
    var stored = document.documentElement.dataset.theme;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncThemeButton() {
    var dark = currentTheme() === 'dark';
    $('#theme-label').textContent = dark ? 'Light mode' : 'Dark mode';
    $('#theme-toggle').setAttribute('aria-pressed', String(dark));
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
    syncThemeButton();
    // The chart marks read their colours from CSS custom properties, so they
    // need a repaint after the theme swaps.
    if (drawAreas) drawAreas();
    if (drawSeries) drawSeries();
  }

  // --- wiring --------------------------------------------------------------

  function wire() {
    $('#receipt-form').addEventListener('submit', submitReceipt);
    $('#edit-form').addEventListener('submit', saveEdit);
    $('#edit-cancel').addEventListener('click', function () { $('#edit-dialog').close(); });
    $('#theme-toggle').addEventListener('click', toggleTheme);

    $('#presets').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-preset]');
      if (!btn) return;
      applyPreset(btn.dataset.preset);
      load();
    });

    ['#f-start', '#f-end'].forEach(function (sel) {
      $(sel).addEventListener('change', function () {
        var start = $('#f-start').value, end = $('#f-end').value;
        if (!start || !end) return;
        if (start > end) {
          $('#range-error').textContent = 'The start date must be on or before the end date.';
          return;
        }
        $('#range-error').textContent = '';
        state.start = start;
        state.end = end;
        state.preset = 'custom';
        syncFilterInputs();
        load();
      });
    });

    var searchTimer;
    $('#f-search').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      var value = e.target.value;
      searchTimer = setTimeout(function () {
        state.search = value;
        state.limit = PAGE;
        renderReceipts();
      }, 120);
    });

    $('#receipts-table').addEventListener('click', function (e) {
      var sortBtn = e.target.closest('.th-sort');
      if (sortBtn) {
        var key = sortBtn.dataset.sort;
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort.key = key;
          state.sort.dir = key === 'name' ? 'asc' : 'desc';
        }
        state.limit = PAGE;
        renderReceipts();
        return;
      }
      var action = e.target.closest('[data-action]');
      if (!action) return;
      var id = Number(action.closest('tr').dataset.id);
      if (action.dataset.action === 'edit') openEdit(id);
      else removeReceipt(id);
    });

    $('#receipts-more-btn').addEventListener('click', function () {
      state.limit += PAGE;
      renderReceipts();
    });

    $$('[data-table-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var host = $('#' + btn.dataset.tableToggle + '-table');
        var open = host.hidden;
        host.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? 'Chart only' : 'Table';
      });
    });

    // Keep the figures sized to their column when the window resizes.
    window.SSKCharts.responsive($('#chart-areas'), function () { if (drawAreas) drawAreas(); });
    window.SSKCharts.responsive($('#chart-series'), function () { if (drawSeries) drawSeries(); });

    window.addEventListener('scroll', window.SSKCharts.hideTooltip, { passive: true });

    // Follow the OS theme while the user has not made an explicit choice.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!document.documentElement.dataset.theme) {
        syncThemeButton();
        if (drawAreas) drawAreas();
        if (drawSeries) drawSeries();
      }
    });
  }

  function start() {
    var stored;
    try { stored = localStorage.getItem(RANGE_KEY); } catch (e) { stored = null; }
    $('#f-date').value = iso(new Date());
    $('#f-date').max = iso(new Date(Date.now() + 31 * 864e5));

    applyPreset(stored || 'this-month');
    syncThemeButton();
    wire();
    load().then(function () {
      // "All time" needs the data bounds, which only arrive with the first load.
      if (state.preset === 'all') { applyPreset('all'); load(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
