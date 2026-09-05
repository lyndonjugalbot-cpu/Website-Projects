/* The front end.
 *
 * One page, three views, no framework - the app is small enough that a
 * framework would be the largest thing in it. State lives in `state`; every
 * change goes through a `render*` function that rebuilds the section it owns.
 *
 * The role split is enforced on the server (see hrvcoach/auth.py) - what
 * happens here is presentation of that same rule. An employee's requests are
 * scoped to their own rows in SQL whatever this file asks for, so hiding the
 * admin controls is a courtesy to the user, never the security boundary.
 */
(function () {
  'use strict';

  var esc = window.Charts.escapeHtml;
  var fmt = window.Charts.format;

  var state = {
    user: window.HRV.user,
    isAdmin: window.HRV.isAdmin,
    meta: null,
    employees: [],
    view: 'metrics',
    display: 'chart',
    metrics: null,
    logs: [],
    counts: {},
    filters: { logEmployee: '', logStatus: '', search: '' },
    metricEmployee: '',
    weeks: 12
  };

  /* --- plumbing ---------------------------------------------------------- */

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }

  async function api(path, options) {
    var response = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}));
    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Signed out');
    }
    var payload = null;
    try { payload = await response.json(); } catch (e) { /* empty body */ }
    if (!response.ok) {
      var error = new Error((payload && payload.error) || 'Something went wrong (' + response.status + ').');
      error.field = payload && payload.field;
      throw error;
    }
    return payload;
  }

  function toast(message, kind) {
    var node = document.createElement('div');
    node.className = 'toast toast--' + (kind || 'good');
    node.textContent = message;
    $('#toasts').appendChild(node);
    setTimeout(function () { node.remove(); }, 5200);
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function prettyDate(iso) {
    if (!iso) return '—';
    var parts = iso.slice(0, 10).split('-');
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function fileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function metricSpec(key) {
    return (state.meta.metrics || []).filter(function (m) { return m.key === key; })[0] || null;
  }

  /* --- theme ------------------------------------------------------------- */

  $('#theme-toggle').addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('hrv-theme', root.dataset.theme); } catch (e) { /* private mode */ }
    // The charts read their colours from CSS variables, so a theme change
    // means re-drawing rather than restyling.
    window.Charts.redrawAll();
  });

  /* --- views ------------------------------------------------------------- */

  $$('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { showView(tab.dataset.view); });
  });

  function showView(name) {
    state.view = name;
    $$('.tab').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab.dataset.view === name));
    });
    $$('.view').forEach(function (section) { section.hidden = section.dataset.view !== name; });
    if (name === 'metrics') loadMetrics();
    if (name === 'logs') loadLogs();
    if (name === 'roster') renderRoster();
  }

  /* --- metrics ----------------------------------------------------------- */

  async function loadMetrics() {
    var params = new URLSearchParams({ weeks: String(state.weeks) });
    if (state.isAdmin && state.metricEmployee) params.set('employee_uid', state.metricEmployee);
    if (state.isAdmin && !state.metricEmployee) params.set('employee_uid', 'all');
    try {
      state.metrics = await api('/api/metrics?' + params);
      renderMetrics();
    } catch (error) {
      toast(error.message, 'bad');
    }
  }

  function deltaChip(series) {
    if (series.delta === null || series.delta === undefined) {
      return '<div class="tile__delta tile__delta--flat">First reading</div>';
    }
    if (series.improved === null) {
      return '<div class="tile__delta tile__delta--flat">No change vs prev week</div>';
    }
    // Colour by whether the metric moved the *right* way, never by sign: a
    // falling AHT is a win, and colouring it red would say the opposite.
    var good = series.improved;
    var arrow = series.delta > 0 ? '▲' : '▼';
    var sign = series.delta > 0 ? '+' : '−';
    var size = Math.abs(series.delta);
    var smallest = Math.pow(10, -series.decimals);
    var amount = size < smallest
      ? '<' + fmt(smallest, series.decimals) + esc(series.unit)
      : sign + fmt(size, series.decimals) + esc(series.unit);
    return '<div class="tile__delta tile__delta--' + (good ? 'good' : 'bad') + '">' +
      '<span>' + arrow + ' ' + amount + '</span>' +
      '<span class="dim" style="font-weight:500">vs prev week</span></div>';
  }

  function renderMetrics() {
    var data = state.metrics;
    var subject = data.subject.full_name;
    $('#metrics-title').textContent = state.isAdmin ? 'Weekly metrics' : 'My weekly metrics';
    $('#metrics-sub').textContent =
      subject + ' · ' + data.weeks.length + ' weeks to ' + prettyDate(data.weeks[data.weeks.length - 1]) +
      (data.has_comparison ? ' · compared against the team average' : '');

    renderTiles(data);
    renderCharts(data);
    renderMetricTable(data);
  }

  function renderTiles(data) {
    var host = $('#metric-tiles');
    host.innerHTML = data.series.map(function (series) {
      var value = series.latest === null
        ? '<span class="dim" style="font-size:19px">No data</span>'
        : fmt(series.latest, series.decimals) + '<span class="tile__unit">' + esc(series.unit) + '</span>';
      var direction = series.direction === 'up' ? 'Higher is better' : 'Lower is better';
      return '' +
        '<article class="tile">' +
          '<div class="tile__label">' + esc(series.label) + '</div>' +
          '<div class="tile__row"><span class="tile__value">' + value + '</span></div>' +
          (series.latest === null ? '<div class="tile__delta tile__delta--flat">Not recorded yet</div>'
            : deltaChip(series)) +
          '<svg class="tile__spark" data-metric="' + esc(series.key) + '" aria-hidden="true"></svg>' +
          '<div class="tile__foot"><span>' + direction + '</span>' +
            '<span>Target ' + fmt(series.target, series.decimals) + esc(series.unit) + '</span></div>' +
        '</article>';
    }).join('');

    data.series.forEach(function (series) {
      var svg = $('.tile__spark[data-metric="' + series.key + '"]', host);
      if (!svg) return;
      window.Charts.watch(svg.parentNode, function () {
        window.Charts.spark(svg, series.values, getComputedStyle(document.documentElement)
          .getPropertyValue('--series-1').trim());
      });
    });
  }

  function renderCharts(data) {
    var host = $('#metric-charts');
    host.innerHTML = data.series.map(function (series) {
      // A legend is present whenever two series share a plot; with one series
      // the card title already names what is plotted.
      var legend = data.has_comparison
        ? '<div class="legend">' +
            '<span class="legend__item"><span class="legend__key" style="background:var(--series-1)"></span>' +
              esc(data.subject.full_name) + '</span>' +
            '<span class="legend__item"><span class="legend__key" style="background:var(--series-2)"></span>' +
              esc(data.comparison_label) + '</span>' +
          '</div>'
        : '';
      return '' +
        '<section class="chart-card">' +
          '<div class="chart-card__head">' +
            '<div class="chart-card__title"><h2>' + esc(series.label) + '</h2>' +
              '<small>' + esc(series.description) + ' Target ' +
              fmt(series.target, series.decimals) + esc(series.unit) + '.</small></div>' +
            legend +
          '</div>' +
          '<div class="chart" data-metric="' + esc(series.key) + '"></div>' +
        '</section>';
    }).join('');

    data.series.forEach(function (series) {
      var container = $('.chart[data-metric="' + series.key + '"]', host);
      if (!container) return;
      window.Charts.watch(container, function () {
        var lines = [{
          name: data.subject.full_name,
          values: series.values,
          color: getComputedStyle(document.documentElement).getPropertyValue('--series-1').trim()
        }];
        if (data.has_comparison) {
          lines.push({
            name: data.comparison_label,
            values: series.team,
            muted: true,
            color: getComputedStyle(document.documentElement).getPropertyValue('--series-2').trim()
          });
        }
        window.Charts.trend(container, {
          labels: data.week_labels,
          tickLabels: data.week_ticks,
          series: lines,
          unit: series.unit,
          decimals: series.decimals,
          target: series.target,
          min: series.min,
          max: series.max,
          ariaLabel: series.label + ' by week for ' + data.subject.full_name,
          emptyMessage: 'No ' + series.label + ' recorded in this range.'
        });
      });
    });
  }

  /* The same numbers as the charts, in a form a screen reader can walk and a
   * spreadsheet can take. Never a fallback - the toggle is always available. */
  function renderMetricTable(data) {
    var head = '<tr><th>Week</th>' + data.series.map(function (s) {
      return '<th class="num">' + esc(s.label) + ' (' + esc(s.unit) + ')</th>';
    }).join('') + '</tr>';

    var body = data.weeks.map(function (week, index) {
      return '<tr><td>' + esc(data.week_labels[index]) + '</td>' + data.series.map(function (s) {
        var value = s.values[index];
        return '<td class="num">' + (value === null ? '<span class="dim">—</span>' : fmt(value, s.decimals)) + '</td>';
      }).join('') + '</tr>';
    }).reverse().join('');

    $('#metric-table').innerHTML =
      '<table><caption class="sr-only">Weekly metrics for ' + esc(data.subject.full_name) + '</caption>' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  $$('.seg__btn').forEach(function (button) {
    button.addEventListener('click', function () {
      state.display = button.dataset.display;
      $$('.seg__btn').forEach(function (other) {
        other.classList.toggle('is-on', other === button);
      });
      var charts = state.display === 'chart';
      $('#metric-charts').hidden = !charts;
      $('#metric-tiles').hidden = !charts;
      $('#metric-table').hidden = charts;
      if (charts) window.Charts.redrawAll();
    });
  });

  $('#metrics-weeks').addEventListener('change', function (event) {
    state.weeks = Number(event.target.value);
    loadMetrics();
  });

  if ($('#metrics-employee')) {
    $('#metrics-employee').addEventListener('change', function (event) {
      state.metricEmployee = event.target.value;
      loadMetrics();
    });
  }

  /* --- coaching logs ----------------------------------------------------- */

  async function loadLogs() {
    var params = new URLSearchParams({ limit: '200' });
    if (state.isAdmin && state.filters.logEmployee) params.set('employee_uid', state.filters.logEmployee);
    if (state.filters.logStatus) params.set('status', state.filters.logStatus);
    if (state.filters.search) params.set('q', state.filters.search);
    try {
      var payload = await api('/api/logs?' + params);
      state.logs = payload.logs;
      state.counts = payload.counts;
      renderLogs();
    } catch (error) {
      toast(error.message, 'bad');
    }
  }

  function statusChip(log) {
    var label = { open: 'Open', in_progress: 'In progress', closed: 'Closed' }[log.status] || log.status;
    return '<span class="chip chip--' + esc(log.status) + '"><span class="chip__dot"></span>' + esc(label) + '</span>';
  }

  function overdueChip(log) {
    if (!log.follow_up_date || log.status === 'closed' || log.follow_up_date >= today()) return '';
    return '<span class="chip chip--overdue" title="Follow-up date has passed">' +
      '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>' +
      'Follow-up overdue</span>';
  }

  function recordingBlock(log, recording) {
    var source = '/api/recordings/' + recording.id;
    return '' +
      '<div class="recording">' +
        '<div class="recording__head">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" ' +
          'stroke-linecap="round" aria-hidden="true"><path d="M12 3v10.5M12 19v2M8 8v4M16 6v8M4 10v2M20 10v2"/></svg>' +
          '<span class="recording__name" title="' + esc(recording.filename) + '">' + esc(recording.filename) + '</span>' +
          '<span class="dim">' + fileSize(recording.size_bytes) + '</span>' +
          (recording.call_ref ? '<span class="dim">· call ' + esc(recording.call_ref) + '</span>' : '') +
          (state.isAdmin
            ? '<button class="btn btn--ghost btn--sm btn--danger" style="margin-left:auto" ' +
              'data-action="delete-recording" data-id="' + recording.id + '">Remove</button>'
            : '') +
        '</div>' +
        '<audio controls preload="none" src="' + source + '"></audio>' +
      '</div>';
  }

  function logCard(log) {
    var spec = log.metric_key ? metricSpec(log.metric_key) : null;
    var sections = [
      ['Coaching opportunity', log.opportunity],
      ['Root cause', log.root_cause],
      ['Action plan', log.action_plan],
      ['Support / next check-in', log.support]
    ].filter(function (pair) { return pair[1]; }).map(function (pair) {
      return '<div class="log__section"><h3>' + esc(pair[0]) + '</h3><p>' + esc(pair[1]) + '</p></div>';
    }).join('');

    var recordings = log.recordings.length
      ? log.recordings.map(function (r) { return recordingBlock(log, r); }).join('')
      : '<p class="muted dim">No call recording attached.</p>';

    var adminActions = state.isAdmin
      ? '<button class="btn btn--sm" data-action="edit-log" data-id="' + log.id + '">Edit</button>' +
        '<button class="btn btn--sm" data-action="add-recording" data-id="' + log.id + '">Attach recording</button>' +
        '<button class="btn btn--sm btn--danger" data-action="delete-log" data-id="' + log.id + '">Delete</button>'
      : '';

    var ackAction = (!state.isAdmin && !log.acknowledged_at)
      ? '<button class="btn btn--sm btn--primary" data-action="acknowledge" data-id="' + log.id + '">' +
        'I have read this</button>'
      : '';

    var ackNote = log.acknowledged_at
      ? '<span class="chip"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" ' +
        'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 12.5 9 17.5 20 6.5"/></svg>Acknowledged</span>'
      : '<span class="chip">Awaiting employee acknowledgement</span>';

    return '' +
      '<details class="log">' +
        '<summary class="log__head">' +
          '<div class="log__who">' +
            '<strong>' + esc(log.employee_name) + ' <span class="dim">' + esc(log.employee_code) + '</span></strong>' +
            '<div class="log__meta">' +
              '<span>' + prettyDate(log.session_date) + '</span>' +
              '<span>· ' + esc(log.category) + '</span>' +
              (spec ? '<span>· ' + esc(spec.label) + '</span>' : '') +
              (log.coach_name ? '<span>· coached by ' + esc(log.coach_name) + '</span>' : '') +
              (log.recordings.length ? '<span>· 🎧 ' + log.recordings.length + ' recording</span>' : '') +
            '</div>' +
            '<div class="log__excerpt">' + esc(log.opportunity) + '</div>' +
          '</div>' +
          statusChip(log) + overdueChip(log) +
        '</summary>' +
        '<div class="log__body">' +
          '<div class="log__grid">' + sections + '</div>' +
          '<div class="log__section"><h3>Call recording</h3>' + recordings + '</div>' +
          '<div class="log__section"><h3>Follow-up</h3><p>' +
            (log.follow_up_date ? prettyDate(log.follow_up_date) : 'None set') + '</p></div>' +
          '<div class="log__actions">' + ackNote + adminActions + ackAction + '</div>' +
        '</div>' +
      '</details>';
  }

  function renderLogs() {
    var host = $('#log-list');
    var counts = state.counts || {};
    $('#logs-sub').textContent = state.logs.length
      ? state.logs.length + ' log' + (state.logs.length === 1 ? '' : 's') + ' shown · ' +
        (counts.open || 0) + ' open · ' + (counts.in_progress || 0) + ' in progress · ' +
        (counts.closed || 0) + ' closed'
      : 'Nothing recorded yet.';

    if (!state.logs.length) {
      host.innerHTML = '<div class="empty">' +
        '<strong>No coaching logs match this view.</strong>' +
        '<span>' + (state.isAdmin
          ? 'Start one with “New coaching log”, or clear the filters above.'
          : 'When your team leader records a coaching session it will appear here.') + '</span></div>';
      return;
    }
    host.innerHTML = state.logs.map(logCard).join('');
  }

  $('#logs-status').addEventListener('change', function (event) {
    state.filters.logStatus = event.target.value;
    loadLogs();
  });
  $('#logs-search').addEventListener('input', debounce(function (event) {
    state.filters.search = event.target.value.trim();
    loadLogs();
  }, 260));
  if ($('#logs-employee')) {
    $('#logs-employee').addEventListener('change', function (event) {
      state.filters.logEmployee = event.target.value;
      loadLogs();
    });
  }

  /* --- roster (admin) ---------------------------------------------------- */

  function renderRoster() {
    var host = $('#roster-table');
    if (!host) return;
    host.innerHTML = '<table><thead><tr>' +
      '<th>Name</th><th>Employee ID</th><th>Role</th><th>Team</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' +
      state.employees.map(function (person) {
        return '<tr>' +
          '<td>' + esc(person.full_name) + '</td>' +
          '<td><code>' + esc(person.employee_id) + '</code></td>' +
          '<td>' + esc(person.role_label) + '</td>' +
          '<td>' + (person.team ? esc(person.team) : '<span class="dim">—</span>') + '</td>' +
          '<td>' + (person.active
            ? '<span class="chip chip--closed"><span class="chip__dot"></span>Active</span>'
            : '<span class="chip">Deactivated</span>') + '</td>' +
          '<td style="text-align:right">' +
            '<button class="btn btn--sm" data-action="edit-employee" data-id="' + person.id + '">Edit</button>' +
          '</td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* --- dialogs ----------------------------------------------------------- */

  function dialog(title, bodyHtml, footHtml) {
    var node = document.createElement('dialog');
    node.innerHTML = '<form method="dialog" class="dlg">' +
      '<div class="dlg__head"><h2>' + esc(title) + '</h2>' +
        '<button class="icon-btn" value="cancel" aria-label="Close">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<div class="dlg__body">' + bodyHtml + '</div>' +
      '<div class="dlg__foot">' + footHtml + '</div>' +
    '</form>';
    document.body.appendChild(node);
    node.addEventListener('close', function () { node.remove(); });
    node.showModal();
    var first = node.querySelector('.dlg__body input, .dlg__body select, .dlg__body textarea');
    if (first) first.focus();
    return node;
  }

  function fieldError(node, error) {
    $$('.field__error', node).forEach(function (message) { message.remove(); });
    $$('[aria-invalid]', node).forEach(function (input) { input.removeAttribute('aria-invalid'); });
    var target = error.field && $('[name="' + error.field + '"]', node);
    if (target) {
      target.setAttribute('aria-invalid', 'true');
      var message = document.createElement('span');
      message.className = 'field__error';
      message.textContent = error.message;
      (target.closest('.field') || target.parentNode).appendChild(message);
      target.focus();
    } else {
      toast(error.message, 'bad');
    }
  }

  function employeeOptions(selected, includeAdmins) {
    return state.employees
      .filter(function (person) { return includeAdmins || person.role === 'employee'; })
      .filter(function (person) { return person.active || String(person.id) === String(selected); })
      .map(function (person) {
        return '<option value="' + person.id + '"' +
          (String(person.id) === String(selected) ? ' selected' : '') + '>' +
          esc(person.full_name) + ' (' + esc(person.employee_id) + ')</option>';
      }).join('');
  }

  /* --- coaching log form ------------------------------------------------- */

  function logForm(log) {
    var editing = Boolean(log);
    var meta = state.meta;
    var body = '' +
      '<div class="row">' +
        '<label class="field"><span class="field__label">Employee</span>' +
          '<select class="input" name="employee_uid"' + (editing ? ' disabled' : '') + '>' +
            employeeOptions(log && log.employee_uid, false) + '</select>' +
          (editing ? '<span class="field__hint">Reassigning a log is not supported - delete and re-enter.</span>' : '') +
        '</label>' +
        '<label class="field"><span class="field__label">Session date</span>' +
          '<input class="input" type="date" name="session_date" max="' + today() + '" value="' +
            esc((log && log.session_date) || today()) + '"></label>' +
      '</div>' +
      '<div class="row">' +
        '<label class="field"><span class="field__label">Category</span>' +
          '<select class="input" name="category">' + meta.categories.map(function (category) {
            return '<option' + (log && log.category === category ? ' selected' : '') + '>' + esc(category) + '</option>';
          }).join('') + '</select></label>' +
        '<label class="field"><span class="field__label">Metric in focus</span>' +
          '<select class="input" name="metric_key"><option value="">Not metric-specific</option>' +
            meta.metrics.map(function (spec) {
              return '<option value="' + esc(spec.key) + '"' +
                (log && log.metric_key === spec.key ? ' selected' : '') + '>' + esc(spec.label) + '</option>';
            }).join('') + '</select></label>' +
      '</div>' +
      '<label class="field"><span class="field__label">Coaching opportunity</span>' +
        '<textarea class="input" name="opportunity" placeholder="What was observed, and on which calls?" ' +
        'required>' + esc((log && log.opportunity) || '') + '</textarea>' +
        '<span class="field__hint">Be specific enough that the employee can recognise the behaviour.</span></label>' +
      '<label class="field"><span class="field__label">Root cause <span class="dim">(optional)</span></span>' +
        '<textarea class="input" name="root_cause" placeholder="Why is it happening?">' +
        esc((log && log.root_cause) || '') + '</textarea></label>' +
      '<label class="field"><span class="field__label">Action plan</span>' +
        '<textarea class="input" name="action_plan" placeholder="What will they do differently, by when, and how is it measured?" ' +
        'required>' + esc((log && log.action_plan) || '') + '</textarea></label>' +
      '<label class="field"><span class="field__label">Support offered <span class="dim">(optional)</span></span>' +
        '<textarea class="input" name="support" placeholder="Coaching, tools, schedule changes…">' +
        esc((log && log.support) || '') + '</textarea></label>' +
      '<div class="row">' +
        '<label class="field"><span class="field__label">Follow-up date <span class="dim">(optional)</span></span>' +
          '<input class="input" type="date" name="follow_up_date" value="' +
          esc((log && log.follow_up_date) || '') + '"></label>' +
        '<label class="field"><span class="field__label">Status</span>' +
          '<select class="input" name="status">' +
            ['open', 'in_progress', 'closed'].map(function (status) {
              var label = { open: 'Open', in_progress: 'In progress', closed: 'Closed' }[status];
              return '<option value="' + status + '"' +
                (log && log.status === status ? ' selected' : '') + '>' + label + '</option>';
            }).join('') + '</select></label>' +
      '</div>' +
      (editing ? '' : uploadField());

    var node = dialog(editing ? 'Edit coaching log' : 'New coaching log', body,
      '<span class="dlg__note">' + (editing ? '' : 'The employee sees this log as soon as it is saved.') + '</span>' +
      '<button class="btn" value="cancel" type="submit">Cancel</button>' +
      '<button class="btn btn--primary" type="button" data-save>Save log</button>');

    if (!editing) wireUpload(node);

    $('[data-save]', node).addEventListener('click', async function (event) {
      var button = event.currentTarget;
      button.disabled = true;
      try {
        if (editing) {
          await api('/api/logs/' + log.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(collect(node, ['session_date', 'category', 'metric_key', 'opportunity',
              'root_cause', 'action_plan', 'support', 'follow_up_date', 'status']))
          });
          toast('Coaching log updated.');
        } else {
          var form = new FormData();
          Object.entries(collect(node, ['employee_uid', 'session_date', 'category', 'metric_key',
            'opportunity', 'root_cause', 'action_plan', 'support', 'follow_up_date', 'status', 'call_ref']))
            .forEach(function (pair) { form.append(pair[0], pair[1]); });
          var chosen = $('input[type="file"]', node).files[0];
          if (chosen) form.append('recording', chosen);
          var result = await api('/api/logs', { method: 'POST', body: form });
          // A rejected attachment does not discard the log - the server keeps
          // it and says so, and the recording can be attached separately.
          if (result.warning) toast('Log saved, but the recording was not: ' + result.warning, 'bad');
          else toast('Coaching log saved.');
        }
        node.close();
        loadLogs();
      } catch (error) {
        fieldError(node, error);
      } finally {
        button.disabled = false;
      }
    });
  }

  function collect(node, names) {
    var out = {};
    names.forEach(function (name) {
      var input = $('[name="' + name + '"]', node);
      if (input && !input.disabled) out[name] = input.value;
    });
    return out;
  }

  /* --- recording upload -------------------------------------------------- */

  function uploadField() {
    var accept = state.meta.audio_accept.join(',');
    return '' +
      '<div class="field"><span class="field__label">Call recording <span class="dim">(optional)</span></span>' +
        '<div class="dropzone" data-drop>' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>' +
          '<span>Drop an audio file here, or ' +
            '<label style="color:var(--accent-ink);cursor:pointer;text-decoration:underline">browse' +
            '<input type="file" name="recording" accept="' + esc(accept) + ',audio/*" hidden></label></span>' +
          '<span class="dim" style="font-size:11.5px">' + esc(state.meta.audio_accept.join(' ')) +
            ' · up to ' + state.meta.max_recording_mb + ' MB</span>' +
          '<span class="dropzone__file" data-chosen></span>' +
        '</div>' +
      '</div>' +
      '<label class="field"><span class="field__label">Call reference <span class="dim">(optional)</span></span>' +
        '<input class="input" name="call_ref" placeholder="Interaction ID, e.g. INT-88421"></label>';
  }

  function wireUpload(node) {
    var zone = $('[data-drop]', node);
    var input = $('input[type="file"]', node);
    var chosen = $('[data-chosen]', node);

    function announce() {
      var file = input.files[0];
      chosen.textContent = file ? file.name + ' · ' + fileSize(file.size) : '';
      if (file && file.size > state.meta.max_recording_mb * 1024 * 1024) {
        chosen.textContent = file.name + ' · ' + fileSize(file.size) +
          ' — over the ' + state.meta.max_recording_mb + ' MB limit';
        chosen.style.color = 'var(--critical)';
      } else {
        chosen.style.color = '';
      }
    }

    input.addEventListener('change', announce);
    ['dragenter', 'dragover'].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      zone.addEventListener(name, function () { zone.classList.remove('is-over'); });
    });
    zone.addEventListener('drop', function (event) {
      event.preventDefault();
      if (!event.dataTransfer.files.length) return;
      input.files = event.dataTransfer.files;
      announce();
    });
  }

  function attachRecordingForm(logId) {
    var node = dialog('Attach a call recording', uploadField(),
      '<span class="dlg__note">Stored with the coaching log; the employee can play it back.</span>' +
      '<button class="btn" value="cancel" type="submit">Cancel</button>' +
      '<button class="btn btn--primary" type="button" data-save>Upload</button>');
    wireUpload(node);

    $('[data-save]', node).addEventListener('click', async function (event) {
      var input = $('input[type="file"]', node);
      if (!input.files[0]) {
        fieldError(node, { field: 'recording', message: 'Choose a file first.' });
        return;
      }
      event.currentTarget.disabled = true;
      var form = new FormData();
      form.append('recording', input.files[0]);
      form.append('call_ref', $('[name="call_ref"]', node).value);
      try {
        await api('/api/logs/' + logId + '/recordings', { method: 'POST', body: form });
        toast('Recording attached.');
        node.close();
        loadLogs();
      } catch (error) {
        event.currentTarget.disabled = false;
        fieldError(node, error);
      }
    });
  }

  /* --- weekly metric entry ----------------------------------------------- */

  function mondayOf(iso) {
    var parts = iso.split('-');
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }

  function metricsForm() {
    var week = mondayOf(today());
    var body = '' +
      '<div class="row">' +
        '<label class="field"><span class="field__label">Employee</span>' +
          '<select class="input" name="employee_uid">' + employeeOptions(state.metricEmployee, false) +
          '</select></label>' +
        '<label class="field"><span class="field__label">Week beginning (Monday)</span>' +
          '<input class="input" type="date" name="week_start" value="' + week + '">' +
          '<span class="field__hint">Any date works - it snaps to that week\'s Monday.</span></label>' +
      '</div>' +
      '<div class="row">' + state.meta.metrics.map(function (spec) {
        return '<label class="field"><span class="field__label">' + esc(spec.label) +
          ' <span class="dim">(' + esc(spec.unit) + ')</span></span>' +
          '<input class="input" type="number" step="any" name="' + esc(spec.key) + '" ' +
          'min="' + spec.min + '" max="' + spec.max + '" placeholder="target ' + spec.target + '">' +
          '</label>';
      }).join('') + '</div>' +
      '<label class="field"><span class="field__label">Note <span class="dim">(optional)</span></span>' +
        '<input class="input" name="note" placeholder="Anything that explains this week\'s numbers"></label>' +
      '<p class="muted dim">Leave a box empty to clear that metric for the week. ' +
        'Re-entering a week overwrites it, so a correction is just a re-save.</p>';

    var node = dialog('Enter weekly numbers', body,
      '<span class="dlg__note" data-status></span>' +
      '<button class="btn" value="cancel" type="submit">Cancel</button>' +
      '<button class="btn btn--primary" type="button" data-save>Save week</button>');

    // Prefill from whatever is already recorded, so the form shows the current
    // state of the week rather than looking like a blank slate to overwrite.
    async function prefill() {
      var params = new URLSearchParams({
        employee_uid: $('[name="employee_uid"]', node).value,
        week_start: $('[name="week_start"]', node).value || today()
      });
      try {
        var payload = await api('/api/metrics/week?' + params);
        state.meta.metrics.forEach(function (spec) {
          var input = $('[name="' + spec.key + '"]', node);
          input.value = payload.values[spec.key] === undefined ? '' : payload.values[spec.key];
        });
        $('[data-status]', node).textContent = 'Week of ' + prettyDate(payload.week_start);
      } catch (error) { /* an empty form is a fine starting point */ }
    }

    $('[name="employee_uid"]', node).addEventListener('change', prefill);
    $('[name="week_start"]', node).addEventListener('change', prefill);
    prefill();

    $('[data-save]', node).addEventListener('click', async function (event) {
      var button = event.currentTarget;
      var values = {};
      state.meta.metrics.forEach(function (spec) {
        values[spec.key] = $('[name="' + spec.key + '"]', node).value.trim();
      });
      button.disabled = true;
      try {
        await api('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_uid: $('[name="employee_uid"]', node).value,
            week_start: $('[name="week_start"]', node).value,
            note: $('[name="note"]', node).value,
            values: values
          })
        });
        toast('Week saved.');
        node.close();
        loadMetrics();
      } catch (error) {
        fieldError(node, error);
      } finally {
        button.disabled = false;
      }
    });
  }

  /* --- roster forms ------------------------------------------------------ */

  function employeeForm(person) {
    var editing = Boolean(person);
    var body = '' +
      '<div class="row">' +
        '<label class="field"><span class="field__label">Full name</span>' +
          '<input class="input" name="full_name" value="' + esc((person && person.full_name) || '') + '" required></label>' +
        '<label class="field"><span class="field__label">Employee ID</span>' +
          '<input class="input" name="employee_id" value="' + esc((person && person.employee_id) || '') + '"' +
          (editing ? ' disabled' : '') + ' placeholder="EMP-105" spellcheck="false">' +
          '<span class="field__hint">' + (editing ? 'IDs cannot be changed.' : 'What they type to sign in.') +
          '</span></label>' +
      '</div>' +
      '<div class="row">' +
        '<label class="field"><span class="field__label">Role</span>' +
          '<select class="input" name="role">' +
            '<option value="employee"' + (person && person.role === 'employee' ? ' selected' : '') + '>' +
              'Employee - sees only their own logs and metrics</option>' +
            '<option value="admin"' + (person && person.role === 'admin' ? ' selected' : '') + '>' +
              'Team Leader / Admin - full access</option>' +
          '</select></label>' +
        '<label class="field"><span class="field__label">Team <span class="dim">(optional)</span></span>' +
          '<input class="input" name="team" value="' + esc((person && person.team) || '') + '"></label>' +
      '</div>' +
      '<label class="field"><span class="field__label">' +
        (editing ? 'New password (leave blank to keep the current one)' : 'Temporary password') + '</span>' +
        '<input class="input" name="password" type="text" autocomplete="new-password" ' +
        'placeholder="At least 8 characters"><span class="field__hint">' +
        'Share it with them and ask them to change it from the account menu.</span></label>' +
      (editing
        ? '<label class="field"><span class="field__label">Account status</span>' +
          '<select class="input" name="active"><option value="1"' + (person.active ? ' selected' : '') +
          '>Active</option><option value="0"' + (person.active ? '' : ' selected') +
          '>Deactivated - cannot sign in</option></select></label>'
        : '');

    var node = dialog(editing ? 'Edit ' + person.full_name : 'Add a person', body,
      '<button class="btn" value="cancel" type="submit">Cancel</button>' +
      '<button class="btn btn--primary" type="button" data-save>' + (editing ? 'Save' : 'Create account') + '</button>');

    $('[data-save]', node).addEventListener('click', async function (event) {
      var button = event.currentTarget;
      var payload = collect(node, ['full_name', 'employee_id', 'role', 'team', 'password']);
      if (editing) {
        payload.active = $('[name="active"]', node).value === '1';
        if (!payload.password) delete payload.password;
      }
      button.disabled = true;
      try {
        await api(editing ? '/api/employees/' + person.id : '/api/employees', {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        toast(editing ? 'Account updated.' : 'Account created.');
        node.close();
        await loadEmployees();
        renderRoster();
      } catch (error) {
        fieldError(node, error);
      } finally {
        button.disabled = false;
      }
    });
  }

  function passwordForm() {
    var node = dialog('Change your password',
      '<label class="field"><span class="field__label">Current password</span>' +
        '<input class="input" name="current" type="password" autocomplete="current-password"></label>' +
      '<label class="field"><span class="field__label">New password</span>' +
        '<input class="input" name="new" type="password" autocomplete="new-password">' +
        '<span class="field__hint">At least 8 characters.</span></label>',
      '<button class="btn" value="cancel" type="submit">Cancel</button>' +
      '<button class="btn btn--primary" type="button" data-save>Change password</button>');

    $('[data-save]', node).addEventListener('click', async function (event) {
      event.currentTarget.disabled = true;
      try {
        await api('/api/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collect(node, ['current', 'new']))
        });
        toast('Password changed.');
        node.close();
      } catch (error) {
        event.currentTarget.disabled = false;
        fieldError(node, error);
      }
    });
  }

  /* --- one delegated click handler --------------------------------------- */

  document.addEventListener('click', async function (event) {
    var trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    var id = trigger.dataset.id;
    var action = trigger.dataset.action;

    // Inside <details>/<summary>, a button click would otherwise toggle the card.
    if (trigger.tagName === 'BUTTON') event.preventDefault();
    $$('.menu[open]').forEach(function (menu) { menu.open = false; });

    if (action === 'new-log') return logForm(null);
    if (action === 'enter-metrics') return metricsForm();
    if (action === 'new-employee') return employeeForm(null);
    if (action === 'password') return passwordForm();
    if (action === 'add-recording') return attachRecordingForm(id);

    if (action === 'edit-log') {
      return logForm(state.logs.filter(function (log) { return String(log.id) === id; })[0]);
    }
    if (action === 'edit-employee') {
      return employeeForm(state.employees.filter(function (p) { return String(p.id) === id; })[0]);
    }

    if (action === 'acknowledge') {
      try {
        await api('/api/logs/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledge: true })
        });
        toast('Marked as read.');
        loadLogs();
      } catch (error) { toast(error.message, 'bad'); }
      return;
    }

    if (action === 'delete-log') {
      if (!window.confirm('Delete this coaching log and any recording attached to it? This cannot be undone.')) return;
      try {
        await api('/api/logs/' + id, { method: 'DELETE' });
        toast('Coaching log deleted.');
        loadLogs();
      } catch (error) { toast(error.message, 'bad'); }
      return;
    }

    if (action === 'delete-recording') {
      if (!window.confirm('Remove this recording? The coaching log itself stays.')) return;
      try {
        await api('/api/recordings/' + id, { method: 'DELETE' });
        toast('Recording removed.');
        loadLogs();
      } catch (error) { toast(error.message, 'bad'); }
    }
  });

  // A click anywhere else closes the account menu.
  document.addEventListener('click', function (event) {
    $$('.menu[open]').forEach(function (menu) {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });

  /* --- boot -------------------------------------------------------------- */

  async function loadEmployees() {
    var payload = await api('/api/employees');
    state.employees = payload.employees;
    if (!state.isAdmin) return;

    var employees = state.employees.filter(function (p) { return p.role === 'employee'; });
    var options = '<option value="">All employees (team average)</option>' +
      employees.map(function (person) {
        return '<option value="' + person.id + '">' + esc(person.full_name) +
          ' (' + esc(person.employee_id) + ')</option>';
      }).join('');
    ['#metrics-employee', '#logs-employee'].forEach(function (selector) {
      var select = $(selector);
      if (!select) return;
      var current = select.value;
      select.innerHTML = selector === '#logs-employee'
        ? options.replace('All employees (team average)', 'Everyone')
        : options;
      select.value = current;
    });
  }

  (async function start() {
    try {
      state.meta = await api('/api/session');
      await loadEmployees();
      showView('metrics');
    } catch (error) {
      toast(error.message, 'bad');
    }
  })();
})();
