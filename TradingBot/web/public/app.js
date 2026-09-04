/*
 * Drives the paper-trading test page. The bot logic itself lives in
 * app.py (stateless, one poll = one request); this file just keeps a
 * session (config + the state the server hands back + a local equity
 * history for the chart) and calls POST /api/poll on a timer while the
 * page is open. Closing the tab pauses the bot -- there is no
 * server-side loop to keep running without it. See the project README
 * for why (Vercel's free tier has no per-minute cron).
 */
(() => {
  "use strict";

  const STORAGE_KEY = "tradingbot_paper_session_v1";
  const MAX_EQUITY_POINTS = 500;
  const MAX_LOG_ENTRIES = 100;

  const els = {
    symbol: document.getElementById("cfg-symbol"),
    timeframe: document.getElementById("cfg-timeframe"),
    fast: document.getElementById("cfg-fast"),
    slow: document.getElementById("cfg-slow"),
    stoploss: document.getElementById("cfg-stoploss"),
    quote: document.getElementById("cfg-quote"),
    balance: document.getElementById("cfg-balance"),
    dailyloss: document.getElementById("cfg-dailyloss"),
    fee: document.getElementById("cfg-fee"),
    slippage: document.getElementById("cfg-slippage"),
    interval: document.getElementById("cfg-interval"),
    btnStart: document.getElementById("btn-start"),
    btnStop: document.getElementById("btn-stop"),
    btnReset: document.getElementById("btn-reset"),
    runStatus: document.getElementById("run-status"),
    haltBanner: document.getElementById("halt-banner"),
    statEquity: document.getElementById("stat-equity"),
    statReturn: document.getElementById("stat-return"),
    statBuyhold: document.getElementById("stat-buyhold"),
    statPrice: document.getElementById("stat-price"),
    statPosition: document.getElementById("stat-position"),
    statTrades: document.getElementById("stat-trades"),
    chartEmpty: document.getElementById("chart-empty"),
    chartSvg: document.getElementById("equity-chart"),
    chartTooltip: document.getElementById("chart-tooltip"),
    chartHint: document.getElementById("chart-hint"),
    tradesBody: document.getElementById("trades-body"),
    logWrap: document.getElementById("log-wrap"),
  };

  const configInputs = [
    els.symbol, els.timeframe, els.fast, els.slow, els.stoploss,
    els.quote, els.balance, els.dailyloss, els.fee, els.slippage,
  ];

  let session = loadSession() || freshSession();
  let pollTimer = null;
  let running = false;

  function freshSession() {
    return { config: readConfigFromInputs(), state: null, equityHistory: [], logs: [], lastResult: null };
  }

  function readConfigFromInputs() {
    return {
      symbol: els.symbol.value,
      timeframe: els.timeframe.value,
      fast_ema: Number(els.fast.value),
      slow_ema: Number(els.slow.value),
      stop_loss_pct: Number(els.stoploss.value) / 100,
      quote_amount_per_trade: Number(els.quote.value),
      starting_balance: Number(els.balance.value),
      daily_loss_limit_quote: Number(els.dailyloss.value),
      fee_pct: Number(els.fee.value) / 100,
      slippage_pct: Number(els.slippage.value) / 100,
      poll_interval_seconds: Math.max(5, Number(els.interval.value) || 15),
    };
  }

  function applyConfigToInputs(cfg) {
    els.symbol.value = cfg.symbol;
    els.timeframe.value = cfg.timeframe;
    els.fast.value = cfg.fast_ema;
    els.slow.value = cfg.slow_ema;
    els.stoploss.value = cfg.stop_loss_pct * 100;
    els.quote.value = cfg.quote_amount_per_trade;
    els.balance.value = cfg.starting_balance;
    els.dailyloss.value = cfg.daily_loss_limit_quote;
    els.fee.value = cfg.fee_pct * 100;
    els.slippage.value = cfg.slippage_pct * 100;
    els.interval.value = cfg.poll_interval_seconds;
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.config ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveSession() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* private browsing / storage disabled -- session just won't survive a refresh */
    }
  }

  function setInputsDisabled(disabled) {
    configInputs.forEach((el) => (el.disabled = disabled));
  }

  async function pollOnce() {
    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session.config, state: session.state }),
      });
      const data = await res.json();

      if (!res.ok) {
        pushLog({ timestamp: new Date().toISOString(), signal: "error", message: data.error || `Request failed (${res.status})` });
        renderLog();
        return;
      }

      session.state = data.state;
      session.lastResult = data;
      pushEquityPoint(data.equity);
      pushLog(data.log);
      saveSession();
      render();
    } catch (err) {
      pushLog({ timestamp: new Date().toISOString(), signal: "error", message: `Network error: ${err.message}` });
      renderLog();
    }
  }

  function pushEquityPoint(equity) {
    session.equityHistory.push({ t: Date.now(), equity });
    if (session.equityHistory.length > MAX_EQUITY_POINTS) {
      session.equityHistory.splice(0, session.equityHistory.length - MAX_EQUITY_POINTS);
    }
  }

  function pushLog(log) {
    session.logs.push(log);
    if (session.logs.length > MAX_LOG_ENTRIES) {
      session.logs.splice(0, session.logs.length - MAX_LOG_ENTRIES);
    }
  }

  function start() {
    if (running) return;

    if (!session.state) {
      const cfg = readConfigFromInputs();
      if (cfg.fast_ema >= cfg.slow_ema) {
        alert("Fast EMA must be less than Slow EMA.");
        return;
      }
      session.config = cfg;
      session.equityHistory = [];
      session.logs = [];
    }

    running = true;
    setInputsDisabled(true);
    els.btnStart.disabled = true;
    els.btnStop.disabled = false;
    els.runStatus.textContent = `Live — polling every ${session.config.poll_interval_seconds}s`;
    els.runStatus.classList.add("live");

    pollOnce();
    pollTimer = setInterval(pollOnce, session.config.poll_interval_seconds * 1000);
    saveSession();
  }

  function stop() {
    running = false;
    clearInterval(pollTimer);
    pollTimer = null;
    els.btnStart.disabled = false;
    els.btnStop.disabled = true;
    els.runStatus.textContent = "Paused";
    els.runStatus.classList.remove("live");
  }

  function reset() {
    if (running) stop();
    if (session.state && !confirm("This clears the current paper trading session and starts over. Continue?")) {
      return;
    }
    session = freshSession();
    setInputsDisabled(false);
    els.runStatus.textContent = "Not running";
    els.runStatus.classList.remove("live");
    localStorage.removeItem(STORAGE_KEY);
    render();
  }

  // ---- Formatting ----

  function fmtMoney(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  // ---- Rendering ----

  function render() {
    renderStats();
    renderHaltBanner();
    renderChart();
    renderTrades();
    renderLog();
  }

  function renderStats() {
    const r = session.lastResult;
    const cfg = session.config;

    els.statEquity.textContent = fmtMoney(r ? r.equity : cfg.starting_balance);

    const ret = r ? r.total_return_pct : 0;
    els.statReturn.textContent = fmtPct(ret);
    els.statReturn.className = "stat-value " + (ret > 0 ? "good" : ret < 0 ? "critical" : "");

    els.statBuyhold.textContent = fmtPct(r ? r.buy_hold_return_pct : null);
    els.statPrice.textContent = r ? Number(r.current_price).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—";

    const pos = session.state && session.state.position;
    if (pos && r) {
      const unrealizedPct = (r.current_price / pos.entry_price - 1) * 100;
      els.statPosition.textContent = `Long @ ${pos.entry_price.toFixed(4)} (${fmtPct(unrealizedPct)})`;
      els.statPosition.className = "stat-value " + (unrealizedPct >= 0 ? "good" : "critical");
    } else {
      els.statPosition.textContent = "Flat";
      els.statPosition.className = "stat-value";
    }

    const trades = (session.state && session.state.trade_history) || [];
    const wins = trades.filter((t) => t.pnl_quote > 0).length;
    const winRate = trades.length ? `${Math.round((wins / trades.length) * 100)}%` : "—";
    els.statTrades.textContent = `${trades.length} / ${winRate}`;

    els.chartHint.textContent = `Starts trading with ${fmtMoney(cfg.starting_balance)} in simulated balance — dashed line marks the starting balance.`;
  }

  function renderHaltBanner() {
    const state = session.state;
    if (state && state.trading_halted) {
      els.haltBanner.hidden = false;
      els.haltBanner.textContent = `Trading halted: ${state.halt_reason}. New entries are paused until the next UTC day.`;
    } else {
      els.haltBanner.hidden = true;
    }
  }

  function renderChart() {
    const points = session.equityHistory;
    const svg = els.chartSvg;
    svg.innerHTML = "";

    if (points.length < 2) {
      els.chartEmpty.hidden = false;
      svg.hidden = true;
      return;
    }
    els.chartEmpty.hidden = true;
    svg.hidden = false;

    const W = 800, H = 260, PAD_X = 12, PAD_Y = 20;
    const startingBalance = session.config.starting_balance;
    const values = points.map((p) => p.equity).concat(startingBalance);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1e-9) {
      // No variation yet (e.g. no trades have happened) -- center the flat
      // line instead of letting it collapse onto the bottom edge.
      const pad = Math.max(Math.abs(max) * 0.001, 0.5);
      min -= pad;
      max += pad;
    }
    const range = max - min;

    const x = (i) => PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
    const y = (v) => H - PAD_Y - ((v - min) / range) * (H - PAD_Y * 2);
    const ns = "http://www.w3.org/2000/svg";

    const baseline = document.createElementNS(ns, "line");
    baseline.setAttribute("x1", PAD_X);
    baseline.setAttribute("x2", W - PAD_X);
    baseline.setAttribute("y1", y(startingBalance));
    baseline.setAttribute("y2", y(startingBalance));
    baseline.setAttribute("stroke", "var(--baseline)");
    baseline.setAttribute("stroke-width", "1");
    baseline.setAttribute("stroke-dasharray", "4 4");
    svg.appendChild(baseline);

    const startLabel = document.createElementNS(ns, "text");
    startLabel.setAttribute("x", PAD_X);
    startLabel.setAttribute("y", Math.max(12, y(startingBalance) - 6));
    startLabel.setAttribute("fill", "var(--text-muted)");
    startLabel.setAttribute("font-size", "11");
    startLabel.textContent = `Start ${fmtMoney(startingBalance)}`;
    svg.appendChild(startLabel);

    const path = document.createElementNS(ns, "path");
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.equity).toFixed(2)}`).join(" ");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "var(--series-1)");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    const last = points[points.length - 1];
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x(points.length - 1));
    dot.setAttribute("cy", y(last.equity));
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", "var(--series-1)");
    dot.setAttribute("stroke", "var(--surface-1)");
    dot.setAttribute("stroke-width", "2");
    svg.appendChild(dot);

    const endLabel = document.createElementNS(ns, "text");
    endLabel.setAttribute("x", Math.min(x(points.length - 1), W - 84));
    endLabel.setAttribute("y", Math.max(12, y(last.equity) - 10));
    endLabel.setAttribute("fill", "var(--text-primary)");
    endLabel.setAttribute("font-size", "12");
    endLabel.setAttribute("font-weight", "650");
    endLabel.textContent = fmtMoney(last.equity);
    svg.appendChild(endLabel);

    const crosshair = document.createElementNS(ns, "line");
    crosshair.setAttribute("y1", PAD_Y);
    crosshair.setAttribute("y2", H - PAD_Y);
    crosshair.setAttribute("stroke", "var(--gridline)");
    crosshair.setAttribute("stroke-width", "1");
    crosshair.setAttribute("visibility", "hidden");
    svg.appendChild(crosshair);

    svg.onmousemove = (evt) => {
      const rect = svg.getBoundingClientRect();
      const relX = ((evt.clientX - rect.left) / rect.width) * W;
      let idx = Math.round(((relX - PAD_X) / (W - PAD_X * 2)) * (points.length - 1));
      idx = Math.max(0, Math.min(points.length - 1, idx));
      const p = points[idx];

      crosshair.setAttribute("x1", x(idx));
      crosshair.setAttribute("x2", x(idx));
      crosshair.setAttribute("visibility", "visible");

      const tooltip = els.chartTooltip;
      tooltip.hidden = false;
      tooltip.style.left = `${(x(idx) / W) * 100}%`;
      tooltip.style.top = `${(y(p.equity) / H) * 100}%`;
      const pnl = p.equity - startingBalance;

      tooltip.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = fmtMoney(p.equity);
      tooltip.appendChild(strong);
      tooltip.appendChild(
        document.createTextNode(` · ${new Date(p.t).toLocaleTimeString()} · ${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`)
      );
    };
    svg.onmouseleave = () => {
      crosshair.setAttribute("visibility", "hidden");
      els.chartTooltip.hidden = true;
    };
  }

  function renderTrades() {
    const trades = (session.state && session.state.trade_history) || [];
    els.tradesBody.innerHTML = "";
    if (trades.length === 0) {
      els.tradesBody.innerHTML = '<tr class="empty-row"><td colspan="6">No trades yet.</td></tr>';
      return;
    }
    [...trades].reverse().forEach((t) => {
      const tr = document.createElement("tr");
      const pnlClass = t.pnl_quote >= 0 ? "good" : "critical";

      const cells = [
        fmtTime(t.entry_time),
        fmtTime(t.exit_time),
        Number(t.entry_price).toFixed(4),
        Number(t.exit_price).toFixed(4),
      ];
      cells.forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });

      const pnlTd = document.createElement("td");
      pnlTd.className = pnlClass;
      pnlTd.textContent = `${t.pnl_quote >= 0 ? "+" : ""}${fmtMoney(t.pnl_quote)}`;
      tr.appendChild(pnlTd);

      const reasonTd = document.createElement("td");
      reasonTd.textContent = t.reason;
      tr.appendChild(reasonTd);

      els.tradesBody.appendChild(tr);
    });
  }

  function renderLog() {
    els.logWrap.innerHTML = "";
    if (session.logs.length === 0) {
      els.logWrap.innerHTML = '<p class="empty-row">Nothing logged yet — click Start.</p>';
      return;
    }
    session.logs.forEach((log) => {
      const row = document.createElement("div");
      row.className = "log-entry";

      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = fmtTime(log.timestamp);
      row.appendChild(time);

      const chip = document.createElement("span");
      const signalClass = ["buy", "sell", "error"].includes(log.signal) ? log.signal : "hold";
      chip.className = "log-chip " + signalClass;
      chip.textContent = signalClass;
      row.appendChild(chip);

      const msg = document.createElement("span");
      msg.className = "log-message";
      msg.textContent = log.message || "";
      row.appendChild(msg);

      els.logWrap.appendChild(row);
    });
  }

  // ---- Init ----

  applyConfigToInputs(session.config);
  if (session.state) {
    setInputsDisabled(true);
    els.runStatus.textContent = "Paused (resumed from last visit — press Start to continue polling)";
  }
  render();

  els.btnStart.addEventListener("click", start);
  els.btnStop.addEventListener("click", stop);
  els.btnReset.addEventListener("click", reset);

  window.addEventListener("beforeunload", () => {
    if (running) saveSession();
  });
})();
