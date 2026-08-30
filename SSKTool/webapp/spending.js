/* SSKTool spending / cash-flow engine.
 * Companion to forecast.js - reuses window.SSK.parseFile for the POS revenue.
 * No other dependencies. Exposes window.SPEND = { parseExpenses, buildTemplate,
 * buildReport, toCSV }. */
(function (global) {
  "use strict";

  // ---------- category -> priority tier ---------------------------------
  // Tier 1 non-payment stops the business or brings legal / eviction / staff loss.
  // Tier 2 keeps operations smooth; a short delay is tolerable.
  // Tier 3 can be delayed, split or trimmed this cycle.
  // Tier 4 discretionary - skip when cash is tight.
  const TIERS = {
    1: { label: "Critical", base: 100 },
    2: { label: "Important", base: 68 },
    3: { label: "Deferrable", base: 40 },
    4: { label: "Discretionary", base: 18 },
  };
  const DEFAULT_TIER = 3;

  const CATEGORY_RULES = [
    { tier: 1, re: /rent|lease|landlord|stall fee/i },
    { tier: 1, re: /payroll|salar|wage|employee pay|staff pay|13th month/i },
    { tier: 1, re: /electric|power|meralco|veco|davao light|generator fuel|\butility|utilities|water bill|\bwater\b/i },
    { tier: 1, re: /\btax|\bbir\b|government|permit|licen[cs]e|barangay|\bsss\b|philhealth|pag-?ibig|documentary stamp/i },
    { tier: 1, re: /loan|amort|mortgage|\bdebt\b|financ(e|ing)|credit line|interest payment/i },
    { tier: 1, re: /insurance/i },
    { tier: 2, re: /internet|wi-?fi|telecom|pldt|globe|converge|smart|dito|phone bill|mobile|data plan|landline/i },
    { tier: 2, re: /equipment|maintenance|repair|servicing|air-?con|freezer|chiller|ref\b|pos system|software|licence renewal/i },
    { tier: 2, re: /accounting|bookkeep|audit|legal fee|professional fee|consultan/i },
    { tier: 2, re: /security|guard|cctv|alarm|monitoring/i },
    { tier: 2, re: /waste|garbage|sanitation|pest control|cleaning service|disinfect/i },
    { tier: 2, re: /transport|fuel|delivery fee|freight|logistic|hauling|gasoline|diesel/i },
    { tier: 3, re: /inventory|re-?stock|stock purchase|goods|merchandise|supplier|wholesale|purchase order|\bpo\b|product order|order of|resell/i },
    { tier: 3, re: /supplies|consumable|packaging|\bbags?\b|receipt roll|printing|stationery|uniform/i },
    { tier: 3, re: /marketing|advertis|\bads?\b|promo|tarp(aulin)?|signage|flyer|boost|giveaway/i },
    { tier: 4, re: /misc|miscellaneous|renovation|upgrade|decor|bonus|gift|donation|charity|training|seminar|subscription/i },
  ];

  function tierForCategory(cat) {
    const s = String(cat || "");
    for (const r of CATEGORY_RULES) if (r.re.test(s)) return r.tier;
    return DEFAULT_TIER;
  }

  const PRIORITY_WORDS = {
    critical: 1, urgent: 1, "1": 1, high: 2, "2": 2, important: 2,
    medium: 3, normal: 3, "3": 3, low: 4, "4": 4, optional: 4,
  };

  // ---------- small helpers -------------------------------------------------

  function num(v) {
    if (v == null) return null;
    v = String(v).trim().replace(/[₱$,\s]/g, "");
    if (v === "" || v === "-") return null;
    const neg = /^\((.*)\)$/.exec(v);
    if (neg) v = "-" + neg[1];
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function parseDate(s) {
    if (s == null) return null;
    s = String(s).trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, 1));
    m = s.toLowerCase().match(/([a-z]{3,})[.\s-]+(\d{4})/);
    if (m) {
      const mi = MONTH_NAMES.findIndex((x) => x.toLowerCase().startsWith(m[1].slice(0, 3)));
      if (mi >= 0) return new Date(Date.UTC(+m[2], mi, 1));
    }
    const d = new Date(s);
    return isNaN(+d) ? null : d;
  }

  function monthKey(d) {
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }
  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return MONTH_NAMES[m - 1].slice(0, 3) + " " + y;
  }
  function lastDayOfMonth(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }
  function iso(d) { return d ? d.toISOString().slice(0, 10) : ""; }

  function decodeEntities(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  // minimal RFC-4180-ish CSV parser (quoted fields, commas, newlines)
  function parseDelimited(text) {
    const rows = [];
    let row = [], field = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c !== ""));
  }

  // SpreadsheetML 2003 -> array of positional string rows
  function extractSheetRows(text) {
    const out = [];
    const rowRe = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
    const cellRe = /<Cell([^>]*)>([\s\S]*?)<\/Cell>/g;
    let rm;
    while ((rm = rowRe.exec(text))) {
      const cells = [];
      let idx = 0, cm;
      cellRe.lastIndex = 0;
      while ((cm = cellRe.exec(rm[1]))) {
        const attr = cm[1], body = cm[2];
        const im = attr.match(/ss:Index="(\d+)"/);
        if (im) idx = +im[1] - 1;
        const dm = body.match(/<Data[^>]*>([\s\S]*?)<\/Data>/);
        cells[idx] = dm ? decodeEntities(dm[1]) : "";
        const ma = attr.match(/ss:MergeAcross="(\d+)"/);
        idx += 1 + (ma ? +ma[1] : 0);
      }
      out.push(Array.from(cells, (c) => (c == null ? "" : String(c))));
    }
    return out;
  }

  // ---------- expenses file ----------------------------------------------

  const HEADER_ALIASES = {
    date: ["date", "due", "due_date", "due date", "bill date", "pay date"],
    month: ["month", "period", "billing month"],
    category: ["category", "type of expense", "expense", "account", "class"],
    description: ["description", "name", "desc", "item", "details", "particulars", "memo"],
    vendor: ["vendor", "payee", "supplier", "biller", "paid to", "to"],
    amount: ["amount", "cost", "value", "total", "php", "amount due", "balance"],
    kind: ["kind", "expense type", "nature", "fixed/variable", "fixed_variable"],
    frequency: ["frequency", "freq", "recurrence", "recurring"],
    due_day: ["due_day", "due day", "day", "day of month", "dom"],
    status: ["status", "paid", "state", "settled"],
    penalty: ["penalty", "late fee", "late_fee", "interest", "surcharge", "consequence"],
    priority: ["priority", "importance", "rank", "override"],
  };

  function resolveColumns(header) {
    const low = header.map((h) => String(h).trim().toLowerCase());
    const col = {};
    for (const key in HEADER_ALIASES) {
      col[key] = -1;
      for (const alias of HEADER_ALIASES[key]) {
        const i = low.indexOf(alias);
        if (i >= 0) { col[key] = i; break; }
      }
    }
    return col;
  }

  function parseExpenses(text, filename) {
    const meta = { currency: "" };
    let records;

    const head = text.slice(0, 512).trimStart().toLowerCase();
    if (head.startsWith("<?xml") || head.includes("<workbook")) {
      const rows = extractSheetRows(text);
      let hi = rows.findIndex((r) => {
        const j = r.join(" ").toLowerCase();
        return /categ|expense|account/.test(j) && /amount|cost|value|total/.test(j);
      });
      if (hi < 0) hi = 0;
      records = rows.slice(hi);
    } else {
      const body = [];
      for (const line of text.split(/\r?\n/)) {
        if (line.trim().startsWith("#")) {
          const cm = line.match(/currency:\s*([A-Za-z]{2,4})/i);
          if (cm) meta.currency = cm[1].toUpperCase();
          continue;
        }
        body.push(line);
      }
      records = parseDelimited(body.join("\n"));
    }
    if (!records.length) return { rows: [], meta, columns: {} };

    const col = resolveColumns(records[0]);
    if (col.amount < 0 && col.category < 0) {
      // no recognizable header - give up gracefully
      return { rows: [], meta, columns: col };
    }

    const rows = [];
    for (let i = 1; i < records.length; i++) {
      const r = records[i];
      const get = (k) => (col[k] >= 0 ? String(r[col[k]] == null ? "" : r[col[k]]).trim() : "");
      const amount = num(get("amount"));
      const category = get("category") || get("description");
      if (amount == null && !category) continue;
      if (amount == null || amount === 0) continue;

      const rawStatus = get("status").toLowerCase();
      let status = "unpaid";
      if (/^(y|yes|paid|settled|done|true|1)$/.test(rawStatus)) status = "paid";
      else if (/overdue|past due|late|delinquent/.test(rawStatus)) status = "overdue";
      else if (/partial/.test(rawStatus)) status = "partial";

      const priWord = get("priority").toLowerCase().replace(/\s+/g, "");
      const priTier = PRIORITY_WORDS[priWord] || null;

      const dateStr = get("date");
      const monthStr = get("month");
      const dueDay = parseInt(get("due_day"), 10);
      let dueDate = parseDate(dateStr) || parseDate(monthStr);
      let dateExplicit = !!parseDate(dateStr);
      if (dueDate && !dateExplicit && Number.isFinite(dueDay)) {
        dueDate = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(),
          Math.min(28, Math.max(1, dueDay))));
      } else if (dueDate && !dateExplicit) {
        dueDate = lastDayOfMonth(dueDate);
      }

      const penalty = get("penalty");
      rows.push({
        category: category || "Uncategorized",
        description: get("description"),
        vendor: get("vendor"),
        amount: Math.abs(amount),
        kind: get("kind").toLowerCase(),          // fixed | variable | ""
        frequency: get("frequency").toLowerCase(), // monthly | once | ...
        dueDay: Number.isFinite(dueDay) ? dueDay : null,
        dueDate: dueDate || null,
        dateExplicit,
        monthOnly: !dateExplicit && !!(monthStr || dueDay),
        status,
        penalty,
        hasPenalty: !!penalty && !/^(no|none|n\/a|0)$/i.test(penalty),
        priorityTier: priTier,
        _month: (parseDate(monthStr) && monthKey(parseDate(monthStr)))
          || (parseDate(dateStr) && monthKey(parseDate(dateStr))) || null,
      });
    }
    return { rows, meta, columns: col };
  }

  function buildTemplate() {
    return [
      "# Seoul Stop Kmart - monthly expenses / obligations. One row per bill.",
      "# Required: category, amount. Dates: YYYY-MM-DD or M/D/YYYY; 'month' (2026-08) also works.",
      "# status: unpaid | paid | overdue | partial.  priority (optional) overrides the auto tier.",
      "# currency: PHP",
      "date,category,description,vendor,amount,kind,frequency,due_day,status,penalty,priority",
      "2026-08-05,Rent,Store space,Landlord,25000,fixed,monthly,5,unpaid,eviction notice after 7 days,",
      "2026-08-15,Payroll,Staff salaries (3 crew),,33000,fixed,monthly,15,unpaid,,critical",
      "2026-08-10,Utilities,Electricity,Meralco,8200,variable,monthly,10,unpaid,10% surcharge + disconnection,",
      "2026-08-12,Utilities,Water,Metro Water,900,variable,monthly,12,unpaid,,",
      "2026-08-08,Internet,Store + POS line,PLDT,1800,fixed,monthly,8,unpaid,,",
      "2026-08-20,Loan,Chiller financing,Bank,6000,fixed,monthly,20,unpaid,penalty interest,",
      "2026-08-25,Taxes,Percentage tax + permit,BIR,3500,variable,quarterly,25,unpaid,surcharge + interest,",
      "2026-08-01,Insurance,Fire + theft cover,,1500,fixed,monthly,1,unpaid,,",
      "2026-08-18,Inventory,Samyang / Buldak restock,Samyang Distributor,45000,variable,monthly,,unpaid,,",
      "2026-08-22,Inventory,Beverages restock,Coca-Cola PH,18000,variable,monthly,,unpaid,,",
      '2026-08-14,Supplies,"Receipt rolls, bags, cleaning",,1200,variable,monthly,,unpaid,,',
      "2026-08-28,Marketing,FB boost + tarpaulin,,2000,one-off,once,,unpaid,,low",
      "",
    ].join("\n");
  }

  // ---------- trend maths (mirrors forecast.js) --------------------------

  const HISTORY_WEIGHTS = [0.5, 0.3, 0.2];

  function weightedAvgAndSlope(series /* oldest -> newest */) {
    const n = series.length;
    if (!n) return { avg: 0, slope: 0, pctPerMonth: 0 };
    if (n === 1) return { avg: series[0], slope: 0, pctPerMonth: 0 };
    const newest = series.slice().reverse();
    const w = newest.map((_, i) =>
      HISTORY_WEIGHTS[i] != null ? HISTORY_WEIGHTS[i] : HISTORY_WEIGHTS[HISTORY_WEIGHTS.length - 1]);
    const wsum = w.reduce((a, b) => a + b, 0) || 1;
    const avg = newest.reduce((acc, v, i) => acc + v * w[i], 0) / wsum;
    const xs = series.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = series.reduce((a, b) => a + b, 0) / n;
    let dn = 0, nu = 0;
    for (let i = 0; i < n; i++) { dn += (xs[i] - mx) ** 2; nu += (xs[i] - mx) * (series[i] - my); }
    const slope = nu / (dn || 1);
    return { avg, slope, pctPerMonth: (slope / (my || 1)) * 100 };
  }

  function projectNext(series) {
    const { avg, pctPerMonth } = weightedAvgAndSlope(series);
    const g = Math.max(-0.5, Math.min(0.5, pctPerMonth / 100));
    return avg * (1 + g);
  }

  // ---------- scoring & allocation -------------------------------------

  function scoreLine(e, ctx) {
    const tier = e.tier;
    let score = TIERS[tier].base;
    const notes = [];

    if (e.status === "overdue" || (e.dueDate && +e.dueDate < +ctx.asOf)) {
      score += 45; notes.push("overdue");
    } else if (e.dueInWindow) {
      score += 25; notes.push("due within the window");
    } else if (e.dueThisMonth) {
      score += 10; notes.push("due later this month");
    }
    if (e.hasPenalty) { score += 18; notes.push("late penalty / interest"); }
    if (tier === 1) score += 6;
    if ((e.frequency === "once" || e.kind === "one-off" || e.frequency === "one-off") && tier >= 3) {
      score -= 12; notes.push("one-off");
    }
    if (e.priorityTier) notes.push("priority set in file");

    e.score = Math.max(0, Math.round(score));
    e.scoreNotes = notes;
    // tier 3/4 goods & marketing can be split or trimmed this cycle
    e.splittable = tier >= 3 && /inventory|re-?stock|stock|goods|supplier|order|marketing|advertis|promo|supplies/i
      .test(e.category + " " + e.description);
  }

  function allocate(lines, available) {
    let cash = available;
    let stop = false;
    let cutRank = null;
    const plan = lines.map((e, i) => {
      const rank = i + 1;
      if (e.status === "paid") {
        return { ...e, rank, action: "PAID", allocated: 0, remaining: 0 };
      }
      const amt = e.amount;
      if (!stop && cash + 1e-6 >= amt) {
        cash -= amt;
        return { ...e, rank, action: "PAY NOW", allocated: amt, remaining: 0 };
      }
      if (!stop && e.splittable && cash >= Math.max(1, amt * 0.15)) {
        const paid = Math.round(cash);
        cash = 0; stop = true; if (cutRank == null) cutRank = rank;
        return { ...e, rank, action: "PARTIAL", allocated: paid, remaining: Math.round(amt - paid) };
      }
      stop = true;
      if (cutRank == null) cutRank = rank;
      return {
        ...e, rank, allocated: 0, remaining: amt,
        action: e.tier === 1 ? "SHORTFALL" : "DEFER",
      };
    });
    return { plan, cashLeft: Math.max(0, Math.round(cash)), cutRank };
  }

  // ---------- main --------------------------------------------------------

  function buildReport(posPeriods, expenseRows, cfg) {
    cfg = Object.assign({
      currency: "PHP",
      cashOnHand: 0,
      minBuffer: 0,
      expectedInflow: null,     // null => auto from revenue forecast
      windowDays: 7,
      windowLabel: "this week",
      restOfMonth: false,
      asOf: new Date(),
    }, cfg || {});

    const asOf = cfg.asOf instanceof Date ? cfg.asOf : (parseDate(cfg.asOf) || new Date());
    const asOfUTC = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
    let windowEnd, windowDays;
    if (cfg.restOfMonth) {
      windowEnd = lastDayOfMonth(asOfUTC);
      windowDays = Math.max(1, Math.round((+windowEnd - +asOfUTC) / 86400000) + 1);
    } else {
      windowDays = Math.max(1, cfg.windowDays | 0);
      windowEnd = addDays(asOfUTC, windowDays - 1);
    }
    const nextInflowDate = cfg.restOfMonth
      ? new Date(Date.UTC(asOfUTC.getUTCFullYear(), asOfUTC.getUTCMonth() + 1, 1))
      : addDays(windowEnd, 1);

    const flags = [];

    // --- monthly revenue from POS periods ---
    const revByMonth = {};
    (posPeriods || []).forEach((p) => {
      const k = monthKey(p.start);
      const rev = p.rows.reduce((a, r) => a + (r.total || 0), 0);
      revByMonth[k] = (revByMonth[k] || 0) + rev;
    });

    // --- monthly expense totals + per-category series ---
    const expByMonth = {};
    const catByMonth = {};   // cat -> {month: total}
    const catTier = {};
    let undatedTotal = 0;
    expenseRows.forEach((e) => {
      const tier = e.priorityTier || tierForCategory(e.category);
      e.tier = tier;
      catTier[e.category] = Math.min(catTier[e.category] || 9, tier);
      const k = e._month || (e.dueDate ? monthKey(e.dueDate) : null);
      if (k) {
        expByMonth[k] = (expByMonth[k] || 0) + e.amount;
        (catByMonth[e.category] || (catByMonth[e.category] = {}))[k] =
          (catByMonth[e.category][k] || 0) + e.amount;
      } else {
        undatedTotal += e.amount;
      }
    });

    const monthKeys = Array.from(new Set([...Object.keys(revByMonth), ...Object.keys(expByMonth)])).sort();
    const months = monthKeys.map((k) => {
      const revenue = revByMonth[k] != null ? revByMonth[k] : null;
      const expense = expByMonth[k] != null ? expByMonth[k] : null;
      const profit = (revenue != null && expense != null) ? revenue - expense : null;
      return { key: k, label: monthLabel(k), revenue, expense, profit, momPct: null };
    });
    for (let i = 1; i < months.length; i++) {
      const a = months[i - 1].profit, b = months[i].profit;
      if (a != null && b != null && a !== 0) months[i].momPct = ((b - a) / Math.abs(a)) * 100;
    }

    const revSeries = monthKeys.map((k) => revByMonth[k]).filter((v) => v != null);
    const expSeries = monthKeys.map((k) => expByMonth[k]).filter((v) => v != null);
    const profitSeries = months.filter((m) => m.profit != null).map((m) => m.profit);

    const revenueTrendPct = weightedAvgAndSlope(revSeries).pctPerMonth;
    const expenseTrendPct = weightedAvgAndSlope(expSeries).pctPerMonth;
    const profitTrendPct = weightedAvgAndSlope(profitSeries).pctPerMonth;

    const withProfit = months.filter((m) => m.profit != null);
    const latest = withProfit.length ? withProfit[withProfit.length - 1]
      : (months.length ? months[months.length - 1] : { revenue: null, expense: null, profit: null });
    latest.margin = (latest.revenue && latest.profit != null) ? (latest.profit / latest.revenue) * 100 : null;

    if (!posPeriods || !posPeriods.length) flags.push("No sales files - revenue trend and auto inflow are unavailable.");
    if (monthKeys.length <= 1) flags.push("Only one month of data - the P&L 'trend' is a single point, not a forecast.");
    if (undatedTotal > 0) flags.push("Some expense rows have no date/month and were kept only in the payment plan, not the P&L trend.");

    // --- next-month forecast ---
    const revForecast = revSeries.length ? projectNext(revSeries) : 0;
    const categories = Object.keys(catByMonth).map((name) => {
      const series = monthKeys.map((k) => catByMonth[name][k]).filter((v) => v != null);
      const tier = catTier[name] || DEFAULT_TIER;
      const thisMonth = series.length ? series[series.length - 1] : 0;
      const { avg, pctPerMonth } = weightedAvgAndSlope(series);
      const forecast = (tier === 1) ? thisMonth : projectNext(series);
      return { name, tier, tierLabel: TIERS[tier].label, thisMonth, avg, trendPct: pctPerMonth, forecast };
    }).sort((a, b) => a.tier - b.tier || b.forecast - a.forecast);
    const expForecast = categories.reduce((a, c) => a + c.forecast, 0);
    const totalThisMonthExp = categories.reduce((a, c) => a + c.thisMonth, 0) || 1;
    categories.forEach((c) => { c.share = c.thisMonth / totalThisMonthExp; });

    const forecast = {
      revenue: revForecast,
      expenseTotal: expForecast,
      profit: revForecast - expForecast,
      margin: revForecast ? ((revForecast - expForecast) / revForecast) * 100 : null,
    };

    // --- burn & runway ---
    const burnMonthly = expSeries.length ? weightedAvgAndSlope(expSeries).avg
      : (undatedTotal || 0);
    const netMonthly = revForecast - (burnMonthly || expForecast);
    let runwayMonths = Infinity;
    if (netMonthly < 0 && cfg.cashOnHand > 0) runwayMonths = cfg.cashOnHand / -netMonthly;
    const runwayWeeks = runwayMonths === Infinity ? Infinity : runwayMonths * 4.345;

    // --- cash available this window ---
    const inflowAuto = cfg.expectedInflow == null;
    const expectedInflow = inflowAuto
      ? Math.round(revForecast * (windowDays / 30))
      : Math.max(0, +cfg.expectedInflow || 0);
    const available = Math.round(cfg.cashOnHand + expectedInflow - cfg.minBuffer);

    // --- classify each obligation against the window ---
    const scope = [];
    const comingUp = [];
    expenseRows.forEach((e) => {
      const due = e.dueDate;
      e.dueInWindow = due ? (+due >= +asOfUTC && +due <= +windowEnd) : true; // undated => treat as now
      e.overdue = e.status === "overdue" || (due && +due < +asOfUTC);
      e.dueThisMonth = due ? (monthKey(due) === monthKey(asOfUTC) && +due > +windowEnd) : false;
      e.dueLabel = due ? iso(due) : "no date";
      if (e.status === "paid") return;
      if (e.overdue || e.dueInWindow) { scoreLine(e, { asOf: asOfUTC }); scope.push(e); }
      else if (e.dueThisMonth || (due && +due > +windowEnd)) { scoreLine(e, { asOf: asOfUTC }); comingUp.push(e); }
    });

    scope.sort((a, b) =>
      b.score - a.score ||
      (+(a.dueDate || 8.64e15)) - (+(b.dueDate || 8.64e15)) ||
      b.amount - a.amount);
    comingUp.sort((a, b) => (+(a.dueDate || 8.64e15)) - (+(b.dueDate || 8.64e15)) || b.score - a.score);

    const { plan, cashLeft, cutRank } = allocate(scope, available);
    plan.forEach((p) => { p.cut = cutRank != null && p.rank === cutRank; p.suggestedDate = iso(nextInflowDate); });

    const planTotals = {
      payNow: plan.filter((p) => p.action === "PAY NOW").reduce((a, p) => a + p.allocated, 0),
      partial: plan.filter((p) => p.action === "PARTIAL").reduce((a, p) => a + p.allocated, 0),
      deferred: plan.filter((p) => p.action === "DEFER" || p.action === "SHORTFALL")
        .reduce((a, p) => a + p.remaining, 0),
      cashLeft,
    };

    // --- shortfall check on the must-pay tier ---
    const tier1Due = scope.filter((e) => e.tier === 1).reduce((a, e) => a + e.amount, 0);
    const have = cfg.cashOnHand + expectedInflow;
    const shortfall = tier1Due > have
      ? { tier1: Math.round(tier1Due), have: Math.round(have), gap: Math.round(tier1Due - have) }
      : null;

    // --- narrative ---
    const cur = cfg.currency;
    const M = (n) => cur + " " + Math.round(n).toLocaleString();
    const narrative = [];
    narrative.push(
      `As of ${iso(asOfUTC)}, planning the next ${windowDays} day${windowDays === 1 ? "" : "s"} (${cfg.restOfMonth ? "rest of " + MONTH_NAMES[asOfUTC.getUTCMonth()] : cfg.windowLabel}).`);
    narrative.push(
      `Cash on hand ${M(cfg.cashOnHand)}. Expected sales inflow this window ≈ ${M(expectedInflow)}` +
      `${inflowAuto ? " (auto from the revenue forecast)" : " (entered)"}. ` +
      `Keeping a ${M(cfg.minBuffer)} buffer, that leaves ${M(available)} to settle bills now.`);

    const nameOf = (p) => p.description || p.vendor || p.category;
    const payNow = plan.filter((p) => p.action === "PAY NOW");
    if (payNow.length) {
      narrative.push("Pay in this order: " + payNow.slice(0, 6).map((p, i) =>
        `${i + 1}) ${nameOf(p)} ${M(p.amount)}`).join("  •  ") +
        (payNow.length > 6 ? `  •  … +${payNow.length - 6} more` : "") + ".");
    }
    const cantCover = plan.filter((p) => p.action === "SHORTFALL");
    const deferItems = plan.filter((p) => p.action === "DEFER" || p.action === "PARTIAL");
    if (cantCover.length) {
      narrative.push(
        `Cannot fully cover: ${cantCover.map((p) => `${nameOf(p)} ${M(p.remaining)}`).join(", ")} ` +
        `— these are must-pay bills, so free up cash or arrange terms before their due dates.`);
    }
    if (deferItems.length) {
      const big = deferItems.slice().sort((a, b) => b.remaining - a.remaining)[0];
      narrative.push(
        `Defer: ${deferItems.map((p) => nameOf(p) + (p.action === "PARTIAL" ? ` (pay ${M(p.allocated)} now, ${M(p.remaining)} later)` : ` (${M(p.remaining)})`)).join(", ")}. ` +
        `${nameOf(big)} can wait until about ${iso(nextInflowDate)}, when the next deposit lands.`);
    }
    if (!cantCover.length && !deferItems.length) {
      narrative.push("Every obligation in this window is covered by available cash.");
    }
    const upTier1 = comingUp.filter((e) => e.tier === 1);
    if (upTier1.length) {
      const sum = upTier1.reduce((a, e) => a + e.amount, 0);
      narrative.push(
        `Heads up: ${M(sum)} of must-pay bills falls due right after this window — ` +
        `${upTier1.map((e) => `${e.description || e.category} ${M(e.amount)} on ${iso(e.dueDate)}`).join(", ")}. ` +
        `After this week's payments you have about ${M(cashLeft)} left, so set the rest aside from daily takings before those dates.`);
    }
    if (shortfall) {
      narrative.push(
        `⚠ Must-pay obligations (${M(shortfall.tier1)}) exceed cash + expected inflow (${M(shortfall.have)}) by ${M(shortfall.gap)}. ` +
        `Negotiate the rent or supplier terms, split the restock, or bring in ${M(shortfall.gap)} before the due dates.`);
    }
    if (latest.profit != null) {
      const dir = Math.abs(profitTrendPct) < 3 ? "flat" : profitTrendPct > 0 ? "trending up" : "trending down";
      narrative.push(
        `Profit is ${dir}${Math.abs(profitTrendPct) >= 3 ? ` ~${Math.abs(profitTrendPct).toFixed(0)}%/mo` : ""}; ` +
        `last month ${M(latest.profit)} on ${M(latest.revenue)} revenue (${latest.margin.toFixed(0)}% margin). ` +
        `Next month projects ${M(forecast.profit)} profit.`);
    }
    narrative.push(runwayMonths === Infinity
      ? `Operating cash flow is positive at the current run rate - no depletion of the ${M(cfg.cashOnHand)} on hand is projected.`
      : `At the current burn (${M(burnMonthly)}/mo against ${M(revForecast)} sales) the ${M(cfg.cashOnHand)} on hand covers about ${runwayWeeks.toFixed(0)} weeks.`);

    return {
      cfg, currency: cur, flags,
      window: {
        asOf: iso(asOfUTC), end: iso(windowEnd), days: windowDays,
        label: cfg.restOfMonth ? "rest of month" : cfg.windowLabel,
        nextInflowDate: iso(nextInflowDate),
      },
      months, latest,
      revenueTrendPct, expenseTrendPct, profitTrendPct,
      forecast, categories,
      burnMonthly, runwayMonths, runwayWeeks,
      cash: {
        onHand: cfg.cashOnHand, buffer: cfg.minBuffer,
        expectedInflow, inflowAuto, available,
      },
      plan, comingUp, planTotals, cutRank, shortfall,
      narrative,
    };
  }

  // ---------- CSV export ------------------------------------------------

  function csvCell(v) {
    if (typeof v === "number") v = Math.round(v * 100) / 100;
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCSV(report, kind) {
    if (kind === "pnl") {
      const head = ["month", "revenue", "expenses", "profit", "margin_pct", "mom_profit_pct"];
      const lines = [head.join(",")];
      report.months.forEach((m) => lines.push([
        m.key, m.revenue, m.expense, m.profit,
        (m.revenue && m.profit != null) ? (m.profit / m.revenue) * 100 : "",
        m.momPct == null ? "" : m.momPct,
      ].map(csvCell).join(",")));
      lines.push(["forecast", report.forecast.revenue, report.forecast.expenseTotal,
        report.forecast.profit, report.forecast.margin, ""].map(csvCell).join(","));
      return lines.join("\n");
    }
    // payment plan
    const head = ["rank", "action", "category", "description", "vendor", "tier",
      "due_date", "amount", "pay_now", "remaining", "priority_score", "reason", "defer_to"];
    const lines = [head.join(",")];
    report.plan.forEach((p) => lines.push([
      p.rank, p.action, p.category, p.description, p.vendor, p.tier + " " + TIERS[p.tier].label,
      p.dueLabel, p.amount, p.allocated, p.remaining, p.score,
      (p.scoreNotes || []).join("; "), p.action === "PAY NOW" || p.action === "PAID" ? "" : p.suggestedDate,
    ].map(csvCell).join(",")));
    return lines.join("\n");
  }

  global.SPEND = {
    TIERS, tierForCategory, parseExpenses, buildTemplate, buildReport, toCSV,
  };
})(window);
