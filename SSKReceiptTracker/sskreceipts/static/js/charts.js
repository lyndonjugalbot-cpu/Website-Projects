/* Hand-rolled SVG charts.
 *
 * No charting library: the two figures this dashboard needs are simple, and
 * drawing them directly keeps the app dependency-free (it runs offline) and
 * lets the marks follow the house spec exactly - thin bars with a 4px rounded
 * data-end anchored to the baseline, 2px lines, hairline recessive grid.
 *
 * Both charts render in pixel coordinates measured from the container, so text
 * is never scaled by a viewBox. A ResizeObserver re-renders on layout change.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, text) {
    var node = document.createElementNS(NS, name);
    for (var key in attrs) {
      if (attrs[key] !== null && attrs[key] !== undefined) {
        node.setAttribute(key, String(attrs[key]));
      }
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Enough rungs that the axis top sits close above the data - a coarser ladder
  // (1/2/5/10) rounds 290k up to 500k and wastes half the plot.
  var NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

  /** A round axis maximum, so ticks land on readable numbers. */
  function niceMax(value) {
    if (!(value > 0)) return 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var scaled = value / magnitude;
    for (var i = 0; i < NICE_STEPS.length; i++) {
      if (scaled <= NICE_STEPS[i] + 1e-9) return NICE_STEPS[i] * magnitude;
    }
    return 10 * magnitude;
  }

  /** A rect whose far end is rounded and whose baseline end stays square. */
  function barPath(x, y, w, h, r) {
    var radius = Math.max(0, Math.min(r, w, h / 2));
    if (radius <= 0.5) return 'M' + x + ',' + y + 'h' + w + 'v' + h + 'h' + -w + 'z';
    return 'M' + x + ',' + y +
      'h' + (w - radius) +
      'a' + radius + ',' + radius + ' 0 0 1 ' + radius + ',' + radius +
      'v' + (h - radius * 2) +
      'a' + radius + ',' + radius + ' 0 0 1 ' + -radius + ',' + radius +
      'h' + -(w - radius) + 'z';
  }

  function truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
  }

  function emptyState(container, message) {
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'chart__empty';
    box.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round"><path d="M4 19h16M7 15V9M12 15V5M17 15v-4"/></svg>' +
      '<span></span>';
    box.querySelector('span').textContent = message;
    container.appendChild(box);
  }

  // --- tooltip -------------------------------------------------------------

  var tip = null;
  function tooltipNode() {
    if (!tip) tip = document.getElementById('tooltip');
    return tip;
  }

  function showTip(html, clientX, clientY) {
    var node = tooltipNode();
    if (!node) return;
    node.innerHTML = html;
    node.hidden = false;
    var box = node.getBoundingClientRect();
    var left = clientX + 14;
    var top = clientY - box.height - 12;
    if (left + box.width > window.innerWidth - 8) left = clientX - box.width - 14;
    if (top < 8) top = clientY + 18;
    node.style.left = Math.max(8, left) + 'px';
    node.style.top = top + 'px';
  }

  function hideTip() {
    var node = tooltipNode();
    if (node) node.hidden = true;
  }

  // --- horizontal bars: spending by area -----------------------------------

  function renderBars(container, options) {
    var items = options.items || [];
    var money = options.money;

    if (!items.length) {
      emptyState(container, options.emptyMessage || 'No spending in this range yet.');
      return;
    }

    var width = Math.max(280, container.clientWidth);
    var labelW = Math.min(168, Math.max(96, Math.round(width * 0.3)));
    var valueW = Math.min(132, Math.max(84, Math.round(width * 0.2)));
    var gap = 12;
    var plotX = labelW + gap;
    var plotW = Math.max(40, width - labelW - valueW - gap * 2);

    var rowH = 32;      // pitch; the 10px bar leaves >> 2px of surface between fills
    var barH = 10;
    var height = items.length * rowH + 6;
    var max = Math.max.apply(null, items.map(function (d) { return d.total; })) || 1;
    // One notation for every label in the figure - mixing "61,830" with "436.6K"
    // down the same column makes the bars hard to compare at a glance.
    var label = options.axisMoney ? options.axisMoney(max) : function (v) { return money(v); };

    container.innerHTML = '';
    var svg = el('svg', {
      width: width, height: height, viewBox: '0 0 ' + width + ' ' + height,
      role: 'list', 'aria-label': options.ariaLabel || 'Spending by area'
    });

    items.forEach(function (item, i) {
      var y = i * rowH + 3;
      var mid = y + rowH / 2 - 3;
      var w = Math.max(2, (item.total / max) * plotW);

      var row = el('g', {
        class: 'bar-row', tabindex: 0, role: 'listitem',
        'aria-label': item.name + ': ' + money(item.total) + ', ' + item.count +
          ' receipt' + (item.count === 1 ? '' : 's') + ', ' + item.share + '% of the range'
      });

      row.appendChild(el('text', {
        class: 'mark-label', x: labelW, y: mid + 4, 'text-anchor': 'end'
      }, truncate(item.name, Math.floor(labelW / 6.4))));

      row.appendChild(el('path', {
        class: 'bar-track',
        d: barPath(plotX, mid - barH / 2, plotW, barH, barH / 2)
      }));

      row.appendChild(el('path', {
        class: 'bar-fill' + (item.is_other ? ' bar-fill--other' : ''),
        d: barPath(plotX, mid - barH / 2, w, barH, 4)
      }));

      row.appendChild(el('text', {
        class: 'mark-value', x: width - 2, y: mid + 4, 'text-anchor': 'end'
      }, label(item.total)));

      // A hit area spanning the whole row, so the target is the row not the 10px bar.
      var hit = el('rect', { class: 'bar-hit', x: 0, y: y, width: width, height: rowH });
      row.appendChild(hit);

      var body = function () {
        return '<strong>' + escapeHtml(item.name) + '</strong>' +
          '<span>' + item.count + ' receipt' + (item.count === 1 ? '' : 's') +
          ' · ' + item.share + '% of range</span><br><b>' + money(item.total) + '</b>';
      };

      row.addEventListener('pointermove', function (e) { showTip(body(), e.clientX, e.clientY); });
      row.addEventListener('pointerleave', hideTip);
      row.addEventListener('focus', function () {
        var box = row.getBoundingClientRect();
        showTip(body(), box.left + box.width / 2, box.top + box.height);
      });
      row.addEventListener('blur', hideTip);

      svg.appendChild(row);
    });

    container.appendChild(svg);
  }

  // --- line + area: spending over time -------------------------------------

  function renderSeries(container, options) {
    var points = options.points || [];
    var money = options.money;

    var spent = points.reduce(function (sum, p) { return sum + p.total; }, 0);
    if (points.length < 2 || spent <= 0) {
      // A flat line pinned to zero, with a zero-to-one axis beside it, reads as
      // a broken chart rather than as "nothing was spent".
      emptyState(container, points.length < 2 && spent > 0
        ? 'A single day - the total above says it all.'
        : 'No spending in this range yet.');
      return;
    }

    var width = Math.max(280, container.clientWidth);
    var height = 300;
    var m = { top: 14, right: 10, bottom: 30, left: 58 };
    var plotW = width - m.left - m.right;
    var plotH = height - m.top - m.bottom;

    var max = niceMax(Math.max.apply(null, points.map(function (p) { return p.total; })));
    var tick = options.axisMoney ? options.axisMoney(max) : function (v) { return money(v); };
    var stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
    var xAt = function (i) { return m.left + i * stepX; };
    var yAt = function (v) { return m.top + plotH - (v / max) * plotH; };

    container.innerHTML = '';
    var svg = el('svg', {
      width: width, height: height, viewBox: '0 0 ' + width + ' ' + height,
      role: 'img', 'aria-label': options.ariaLabel || 'Spending over time'
    });

    // gridlines + y ticks
    var TICKS = 4;
    for (var t = 0; t <= TICKS; t++) {
      var value = (max / TICKS) * t;
      var y = yAt(value);
      svg.appendChild(el('line', {
        class: t === 0 ? 'axis-line' : 'grid-line',
        x1: m.left, x2: m.left + plotW, y1: y, y2: y
      }));
      svg.appendChild(el('text', {
        class: 'tick-label', x: m.left - 9, y: y + 3.5, 'text-anchor': 'end'
      }, tick(value)));
    }

    // area + line
    var line = points.map(function (p, i) {
      return (i ? 'L' : 'M') + xAt(i).toFixed(1) + ',' + yAt(p.total).toFixed(1);
    }).join('');
    svg.appendChild(el('path', {
      class: 'area-fill',
      d: line + 'L' + xAt(points.length - 1).toFixed(1) + ',' + yAt(0).toFixed(1) +
         'L' + xAt(0).toFixed(1) + ',' + yAt(0).toFixed(1) + 'Z'
    }));
    svg.appendChild(el('path', { class: 'line-path', d: line }));

    // x tick labels, thinned so they never collide
    var perLabel = 58;
    var every = Math.max(1, Math.ceil((points.length * perLabel) / plotW));
    points.forEach(function (p, i) {
      var last = points.length - 1;
      if (i % every !== 0 && i !== last) return;
      // Drop any regular tick that would sit within one step of the final one,
      // which is always drawn - otherwise the two labels overlap.
      if (i !== last && last - i < every) return;
      svg.appendChild(el('text', {
        class: 'tick-label', x: xAt(i), y: height - 10,
        'text-anchor': i === 0 ? 'start' : (i === last ? 'end' : 'middle')
      }, p.label));
    });

    // dots only when the series is sparse enough for them to read as marks
    if (points.length <= 14) {
      points.forEach(function (p, i) {
        svg.appendChild(el('circle', { class: 'point-dot', cx: xAt(i), cy: yAt(p.total), r: 4 }));
      });
    }

    // hover layer: a crosshair + the nearest point, driven from anywhere in the plot
    var crosshair = el('line', { class: 'crosshair', y1: m.top, y2: m.top + plotH, opacity: 0 });
    var marker = el('circle', { class: 'point-dot', r: 5.5, opacity: 0 });
    svg.appendChild(crosshair);
    svg.appendChild(marker);

    var active = -1;
    function focusIndex(i, clientX, clientY) {
      if (i < 0 || i >= points.length) return;
      active = i;
      var p = points[i];
      var x = xAt(i), y = yAt(p.total);
      crosshair.setAttribute('x1', x); crosshair.setAttribute('x2', x);
      crosshair.setAttribute('opacity', 1);
      marker.setAttribute('cx', x); marker.setAttribute('cy', y);
      marker.setAttribute('opacity', 1);
      var box = svg.getBoundingClientRect();
      showTip(
        '<strong>' + escapeHtml(p.label) + '</strong><span>' + p.count +
        ' receipt' + (p.count === 1 ? '' : 's') + '</span><br><b>' + money(p.total) + '</b>',
        clientX === undefined ? box.left + x : clientX,
        clientY === undefined ? box.top + y : clientY
      );
    }

    function clear() {
      active = -1;
      crosshair.setAttribute('opacity', 0);
      marker.setAttribute('opacity', 0);
      hideTip();
    }

    var overlay = el('rect', {
      x: m.left, y: m.top, width: plotW, height: plotH,
      fill: 'transparent', tabindex: 0, role: 'application',
      'aria-label': 'Spending over time - use the left and right arrow keys to step through periods'
    });
    overlay.style.cursor = 'crosshair';
    overlay.addEventListener('pointermove', function (e) {
      var box = svg.getBoundingClientRect();
      var i = Math.round((e.clientX - box.left - m.left) / (stepX || 1));
      focusIndex(Math.max(0, Math.min(points.length - 1, i)), e.clientX, e.clientY);
    });
    overlay.addEventListener('pointerleave', clear);
    overlay.addEventListener('focus', function () { focusIndex(points.length - 1); });
    overlay.addEventListener('blur', clear);
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { focusIndex(Math.min(points.length - 1, active + 1)); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { focusIndex(Math.max(0, active - 1)); e.preventDefault(); }
      else if (e.key === 'Escape') { clear(); }
    });
    svg.appendChild(overlay);

    container.appendChild(svg);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Bind a chart to a container and keep it sized to its column. */
  function responsive(container, draw) {
    var lastWidth = 0;
    var pending = null;
    var observer = new ResizeObserver(function () {
      var w = container.clientWidth;
      if (Math.abs(w - lastWidth) < 8) return;
      lastWidth = w;
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(draw);
    });
    observer.observe(container);
    return draw;
  }

  global.SSKCharts = {
    bars: renderBars,
    series: renderSeries,
    responsive: responsive,
    escapeHtml: escapeHtml,
    hideTooltip: hideTip
  };
})(window);
