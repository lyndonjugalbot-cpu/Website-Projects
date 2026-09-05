/* Hand-rolled SVG charts.
 *
 * No charting library: the two figures this dashboard needs - a weekly trend
 * line and a tile sparkline - are simple, and drawing them directly keeps the
 * app dependency-free (it runs offline, behind a firewall, with no CDN) and
 * lets the marks follow the house spec exactly: 2px lines with round joins,
 * >=8px end markers carrying a 2px surface ring, a hairline recessive grid,
 * and one selective direct label rather than a number on every point.
 *
 * Two rules the metric grid depends on:
 *
 *  - **One chart per metric, never one chart for all of them.** QA is a
 *    percentage, AHT is minutes; putting them on one plot needs two y-scales,
 *    and the alignment between two y-scales is arbitrary - it invents
 *    correlations that are not in the data. Small multiples instead.
 *  - **A gap stays a gap.** A week with no reading is `null` and breaks the
 *    path. Interpolating across it would draw a number nobody recorded.
 *
 * Everything renders in pixel coordinates measured from the container, so text
 * is never scaled by a viewBox. A ResizeObserver re-renders on layout change.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PAD = { top: 14, right: 44, bottom: 22, left: 42 };
  var NICE_STEPS = [1, 2, 2.5, 5, 10];

  function el(name, attrs, text) {
    var node = document.createElementNS(NS, name);
    for (var key in attrs) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function isNum(value) {
    return typeof value === 'number' && isFinite(value);
  }

  /** A round step so gridlines land on numbers a reader can hold in their head. */
  function niceStep(span, wanted) {
    if (!(span > 0)) return 1;
    var rough = span / wanted;
    var magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    var scaled = rough / magnitude;
    for (var i = 0; i < NICE_STEPS.length; i++) {
      if (scaled <= NICE_STEPS[i] + 1e-9) return NICE_STEPS[i] * magnitude;
    }
    return 10 * magnitude;
  }

  /* A trend line is not a magnitude comparison, so it does not have to start at
   * zero - forcing 0 on a QA score that lives between 86 and 94 flattens the
   * whole story into one straight line. The domain hugs the data instead, with
   * the target inside it so the reference line is always on screen. */
  function domainFor(values, target, floor, ceiling) {
    var lo = Infinity;
    var hi = -Infinity;
    values.forEach(function (value) {
      if (!isNum(value)) return;
      lo = Math.min(lo, value);
      hi = Math.max(hi, value);
    });
    if (lo === Infinity) return null;
    if (isNum(target)) { lo = Math.min(lo, target); hi = Math.max(hi, target); }

    var span = hi - lo;
    if (span < 1e-9) { span = Math.max(Math.abs(hi) * 0.1, 1); lo -= span / 2; hi += span / 2; }
    var step = niceStep(span * 1.35, 4);
    lo = Math.floor(lo / step) * step - (span < step ? step : 0);
    hi = Math.ceil(hi / step) * step;
    if (isNum(floor)) lo = Math.max(lo, floor);
    if (isNum(ceiling)) hi = Math.min(hi, ceiling);
    if (hi - lo < step) hi = lo + step;
    return { lo: lo, hi: hi, step: step };
  }

  function ticksFor(domain) {
    var out = [];
    var start = Math.ceil(domain.lo / domain.step - 1e-9) * domain.step;
    for (var value = start; value <= domain.hi + 1e-9; value += domain.step) {
      out.push(Math.abs(value) < 1e-9 ? 0 : value);
      if (out.length > 12) break;
    }
    return out;
  }

  function format(value, decimals) {
    if (!isNum(value)) return '—';
    var rounded = Number(value.toFixed(decimals == null ? 1 : decimals));
    return rounded.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals == null ? 1 : decimals
    });
  }

  /** The rendered width of a string, taken from the DOM rather than estimated. */
  function measureText(svg, text, size) {
    var probe = el('text', { x: -999, y: -999, 'font-size': size }, text);
    svg.appendChild(probe);
    var width = probe.getComputedTextLength ? probe.getComputedTextLength() : String(text).length * size * 0.55;
    probe.remove();
    return width || String(text).length * size * 0.55;
  }

  function emptyState(container, message) {
    container.textContent = '';
    var box = document.createElement('div');
    box.className = 'chart__empty';
    box.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 20h18M4 15l5-5 4 4 6-7"/></svg><span></span>';
    box.querySelector('span').textContent = message;
    container.appendChild(box);
    return box;
  }

  /** The line path, broken wherever the data has a hole. */
  function linePath(values, x, y) {
    var out = '';
    var pen = 'M';
    values.forEach(function (value, index) {
      if (!isNum(value)) { pen = 'M'; return; }
      out += pen + x(index).toFixed(1) + ',' + y(value).toFixed(1) + ' ';
      pen = 'L';
    });
    return out.trim();
  }

  /* --- tooltip ----------------------------------------------------------- */

  function makeTip(container) {
    var tip = document.createElement('div');
    tip.className = 'tip';
    container.appendChild(tip);
    return tip;
  }

  function showTip(tip, container, x, y, html) {
    tip.innerHTML = html;
    tip.classList.add('is-on');
    var width = tip.offsetWidth;
    var bounded = Math.max(width / 2 + 2, Math.min(container.clientWidth - width / 2 - 2, x));
    tip.style.left = bounded + 'px';
    tip.style.top = Math.max(tip.offsetHeight + 4, y - 10) + 'px';
  }

  /* --- the weekly trend chart -------------------------------------------- */

  /**
   * @param {HTMLElement} container
   * @param {{labels: string[], series: Array<{name, values, color, muted}>,
   *          unit: string, decimals: number, target: number|null,
   *          min: number, max: number, emptyMessage: string}} spec
   */
  function trend(container, spec) {
    var width = container.clientWidth;
    var height = container.clientHeight;
    if (width < 40 || height < 40) return;

    var series = spec.series.filter(function (s) {
      return s.values.some(isNum);
    });
    container.textContent = '';
    if (!series.length) {
      emptyState(container, spec.emptyMessage || 'No readings in this range yet.');
      return;
    }

    var pooled = [];
    series.forEach(function (s) { pooled = pooled.concat(s.values); });
    var domain = domainFor(pooled, spec.target, spec.min, spec.max);
    var plotW = width - PAD.left - PAD.right;
    var plotH = height - PAD.top - PAD.bottom;
    var count = spec.labels.length;

    var x = function (index) {
      return PAD.left + (count < 2 ? plotW / 2 : (index / (count - 1)) * plotW);
    };
    var y = function (value) {
      return PAD.top + plotH - ((value - domain.lo) / (domain.hi - domain.lo)) * plotH;
    };

    var svg = el('svg', {
      width: width, height: height, role: 'img',
      'aria-label': spec.ariaLabel || 'Weekly trend'
    });

    var grid = css('--grid');
    var axis = css('--axis');
    var muted = css('--text-muted');
    var surface = css('--surface-1');

    // Gridlines: hairline, solid, one step off the surface - recessive enough
    // that the data reads first.
    ticksFor(domain).forEach(function (value) {
      var yy = y(value);
      svg.appendChild(el('line', {
        x1: PAD.left, x2: width - PAD.right, y1: yy, y2: yy, stroke: grid, 'stroke-width': 1
      }));
      svg.appendChild(el('text', {
        x: PAD.left - 7, y: yy + 3.5, 'text-anchor': 'end',
        fill: muted, 'font-size': 10.5, 'font-variant-numeric': 'tabular-nums'
      }, format(value, value % 1 === 0 ? 0 : spec.decimals)));
    });

    // The target reference. Dotted rather than solid so it cannot be mistaken
    // for one of the (always-solid) gridlines, and labelled so it does not need
    // to be guessed at.
    if (isNum(spec.target) && spec.target >= domain.lo && spec.target <= domain.hi) {
      var ty = y(spec.target);
      svg.appendChild(el('line', {
        x1: PAD.left, x2: width - PAD.right, y1: ty, y2: ty,
        stroke: axis, 'stroke-width': 1.5, 'stroke-dasharray': '1 4', 'stroke-linecap': 'round'
      }));
    }

    // X labels. The width one actually takes is measured rather than guessed,
    // because a guess is how "Aug 10" and "Aug 31" end up printed on top of
    // each other. Ticks are then thinned until neighbours clear each other,
    // and the first and last are always kept - they anchor the range.
    var tickLabels = spec.tickLabels || spec.labels;
    var labelW = measureText(svg, tickLabels[tickLabels.length - 1], 10.5) + 14;
    var fits = Math.max(2, Math.floor(plotW / labelW) + 1);
    var every = Math.max(1, Math.ceil((count - 1) / (fits - 1)));
    tickLabels.forEach(function (label, index) {
      var last = index === count - 1;
      if (index !== 0 && !last && (count - 1 - index) % every !== 0) return;
      // Drop a regular tick that would crowd the always-drawn first or last one.
      if (!last && index !== 0 && (count - 1 - index < every * 0.7 || index < every * 0.7)) return;
      svg.appendChild(el('text', {
        x: x(index), y: height - 6, fill: muted, 'font-size': 10.5,
        'text-anchor': index === 0 ? 'start' : last ? 'end' : 'middle'
      }, label));
    });

    svg.appendChild(el('line', {
      x1: PAD.left, x2: width - PAD.right, y1: PAD.top + plotH, y2: PAD.top + plotH,
      stroke: axis, 'stroke-width': 1
    }));

    // Series are drawn in reverse so the primary line sits on top of context.
    series.slice().reverse().forEach(function (s) {
      svg.appendChild(el('path', {
        d: linePath(s.values, x, y), fill: 'none', stroke: s.color,
        'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
      // A single reading has no line to see, so it gets a dot to stand on.
      var present = s.values.filter(isNum).length;
      if (present === 1) {
        s.values.forEach(function (value, index) {
          if (!isNum(value)) return;
          svg.appendChild(el('circle', {
            cx: x(index), cy: y(value), r: 4, fill: s.color,
            stroke: surface, 'stroke-width': 2
          }));
        });
      }
    });

    // End markers: >=8px across, ringed in the surface colour so they stay
    // legible where the two lines cross.
    series.forEach(function (s) {
      var last = -1;
      s.values.forEach(function (value, index) { if (isNum(value)) last = index; });
      if (last < 0) return;
      svg.appendChild(el('circle', {
        cx: x(last), cy: y(s.values[last]), r: 4.5, fill: s.color,
        stroke: surface, 'stroke-width': 2
      }));
      // Exactly one direct label - on the series this chart is about. The
      // second series is identified by the legend, which avoids two labels
      // colliding wherever the lines converge.
      if (!s.muted) {
        svg.appendChild(el('text', {
          x: Math.min(x(last) + 9, width - 4), y: y(s.values[last]) + 3.5,
          fill: css('--text-primary'), 'font-size': 11, 'font-weight': 620,
          'text-anchor': x(last) + 9 > width - PAD.right + 34 ? 'end' : 'start'
        }, format(s.values[last], spec.decimals)));
      }
    });

    var crosshair = el('line', {
      y1: PAD.top, y2: PAD.top + plotH, stroke: axis, 'stroke-width': 1, opacity: 0
    });
    svg.appendChild(crosshair);
    var dots = el('g', { opacity: 0 });
    series.forEach(function (s) {
      dots.appendChild(el('circle', { r: 4, fill: s.color, stroke: surface, 'stroke-width': 2 }));
    });
    svg.appendChild(dots);

    container.appendChild(svg);
    var tip = makeTip(container);

    // One hit band per week, full plot height - a hover target far bigger than
    // the 8px mark it selects.
    var band = plotW / Math.max(1, count - 1);
    var hits = el('g', {});
    spec.labels.forEach(function (label, index) {
      var rect = el('rect', {
        x: Math.max(0, x(index) - band / 2), y: PAD.top,
        width: Math.max(6, band), height: plotH, fill: 'transparent'
      });
      rect.addEventListener('pointerenter', function () { paint(index); });
      hits.appendChild(rect);
    });
    svg.appendChild(hits);
    svg.addEventListener('pointerleave', clear);

    function paint(index) {
      var rows = series.map(function (s, order) {
        var value = s.values[index];
        var dot = dots.children[order];
        if (isNum(value)) {
          dot.setAttribute('cx', x(index));
          dot.setAttribute('cy', y(value));
          dot.setAttribute('visibility', 'visible');
        } else {
          dot.setAttribute('visibility', 'hidden');
        }
        return '<div class="tip__row"><span class="tip__name">' +
          '<span class="legend__key" style="background:' + s.color + '"></span>' +
          '<span>' + escapeHtml(s.name) + '</span></span><span class="tip__value">' +
          format(value, spec.decimals) + (isNum(value) ? escapeHtml(spec.unit || '') : '') +
          '</span></div>';
      }).join('');
      crosshair.setAttribute('x1', x(index));
      crosshair.setAttribute('x2', x(index));
      crosshair.setAttribute('opacity', 1);
      dots.setAttribute('opacity', 1);
      showTip(tip, container, x(index), PAD.top + 4,
        '<div class="tip__week">' + escapeHtml(spec.labels[index]) + '</div>' + rows);
    }

    function clear() {
      crosshair.setAttribute('opacity', 0);
      dots.setAttribute('opacity', 0);
      tip.classList.remove('is-on');
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* --- sparkline (stat tiles) -------------------------------------------- */

  /** 12 points of context inside a tile: the trend in the accent, no axes. */
  function spark(svg, values, color) {
    var width = Math.round(svg.getBoundingClientRect().width) ||
      svg.clientWidth || svg.parentNode.clientWidth || 160;
    var height = 26;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.textContent = '';
    var present = values.filter(isNum);
    if (present.length < 2) return;

    var lo = Math.min.apply(null, present);
    var hi = Math.max.apply(null, present);
    if (hi - lo < 1e-9) { hi = lo + 1; lo -= 1; }
    var x = function (i) { return 2 + (i / (values.length - 1)) * (width - 12); };
    var y = function (v) { return 22 - ((v - lo) / (hi - lo)) * 18; };

    svg.appendChild(el('path', {
      d: linePath(values, x, y), fill: 'none', stroke: color,
      'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));
    var last = -1;
    values.forEach(function (v, i) { if (isNum(v)) last = i; });
    if (last >= 0) {
      svg.appendChild(el('circle', {
        cx: x(last), cy: y(values[last]), r: 3, fill: color,
        stroke: css('--surface-1'), 'stroke-width': 2
      }));
    }
  }

  /* --- re-render on resize and on a theme change -------------------------- */

  var watched = [];

  function watch(container, draw) {
    draw();
    watched.push({ container: container, draw: draw });
    if (global.ResizeObserver) {
      var observer = new ResizeObserver(function () { draw(); });
      observer.observe(container);
    }
  }

  function redrawAll() {
    watched = watched.filter(function (entry) { return entry.container.isConnected; });
    watched.forEach(function (entry) { entry.draw(); });
  }

  global.Charts = {
    trend: trend,
    spark: spark,
    watch: watch,
    redrawAll: redrawAll,
    format: format,
    escapeHtml: escapeHtml
  };
})(window);
