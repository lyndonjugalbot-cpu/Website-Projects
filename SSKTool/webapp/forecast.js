/* SSKTool forecasting engine - browser port of ssktool/model.py.
 * No dependencies. Exposes window.SSK = { parseFile, buildRecommendations, toCSV }. */
(function (global) {
  "use strict";

  const DEFAULT_CONFIG = {
    forecast_period_days: 30,
    lead_time_days: 7,
    review_period_days: 30,
    safety_stock_days: 10,
    growth_factor: 1.0,
    seasonality: {},            // { "12": 1.3 }
    history_weights: [0.5, 0.3, 0.2],
    movement_tiers: { fast: 20, medium: 6, slow: 1 },
    non_orderable_patterns: [
      "cooking charge", "\\bcharge\\b", "chopstick", "^cup only$",
      "delivery", "plastic bag", "service", "\\bpax\\b",
    ],
    default_pack_size: 1,
    currency: "PHP",
  };

  const MONTHS = ["january","february","march","april","may","june","july",
    "august","september","october","november","december"];

  // ---------- parsing ----------------------------------------------------

  function num(v) {
    if (v == null) return null;
    v = String(v).trim().replace(/,/g, "");
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000) + 1;
  }

  function guessPeriodFromName(name) {
    const lower = name.toLowerCase();
    const ym = lower.match(/(20\d{2})/);
    const year = ym ? Number(ym[1]) : new Date().getFullYear();
    let month = MONTHS.findIndex((m) => lower.includes(m));
    if (month < 0) month = new Date().getMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return { start, end };
  }

  function parseUSDate(s) {
    const m = s.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  }

  function decodeEntities(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  // POS export: SpreadsheetML 2003 XML. Columns after merge-expansion:
  // 1 Code, 2 Product, 5 Quantity, 7 UOM, 10 Total.
  function parseSpreadsheetML(text, filename) {
    const rows = [];
    const rowRe = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
    const cellRe = /<Cell([^>]*)>([\s\S]*?)<\/Cell>/g;
    let rm;
    while ((rm = rowRe.exec(text))) {
      const cells = {};
      let idx = 1, cmatch;
      cellRe.lastIndex = 0;
      while ((cmatch = cellRe.exec(rm[1]))) {
        const attr = cmatch[1], body = cmatch[2];
        const im = attr.match(/ss:Index="(\d+)"/);
        if (im) idx = Number(im[1]);
        const dm = body.match(/<Data[^>]*>([\s\S]*?)<\/Data>/);
        cells[idx] = dm ? decodeEntities(dm[1]) : "";
        const ma = attr.match(/ss:MergeAcross="(\d+)"/);
        idx += 1 + (ma ? Number(ma[1]) : 0);
      }
      rows.push(cells);
    }

    let start = null, end = null, company = "";
    for (const c of rows) {
      const joined = Object.values(c).join(" ");
      const pm = joined.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (pm && !start) { start = parseUSDate(pm[1]); end = parseUSDate(pm[2]); }
      if (!company) {
        const keys = Object.keys(c).map(Number).sort((a, b) => a - b);
        for (let i = 0; i < keys.length; i++) {
          if ((c[keys[i]] || "").trim() === "Company:") {
            const later = keys.slice(i + 1).map((k) => (c[k] || "").trim()).filter(Boolean);
            if (later.length) company = later[0];
          }
        }
      }
    }
    if (!start) { const g = guessPeriodFromName(filename); start = g.start; end = g.end; }

    const lines = [];
    for (const c of rows) {
      const code = (c[1] || "").trim();
      if (!/^\d+$/.test(code)) continue;
      const qty = num(c[5]);
      if (qty == null) continue;
      lines.push({
        code,
        product: (c[2] || "").trim(),
        qty,
        total: num(c[10]) || 0,
        uom: (c[7] || "").trim(),
      });
    }
    return { start, end, company: company || "Unknown", rows: lines };
  }

  function parseCSVText(text, filename) {
    let start = null, end = null, company = "";
    const bodyLines = [];
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith("#")) {
        const pm = line.match(/period:\s*(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/i);
        if (pm) {
          start = new Date(pm[1] + "T00:00:00Z");
          end = new Date(pm[2] + "T00:00:00Z");
        }
        const cm = line.match(/company:\s*(.+)/i);
        if (cm) company = cm[1].trim();
        continue;
      }
      bodyLines.push(line);
    }
    if (!start) { const g = guessPeriodFromName(filename); start = g.start; end = g.end; }

    const records = parseDelimited(bodyLines.join("\n"));
    if (!records.length) return { start, end, company: company || "Unknown", rows: [] };
    const header = records[0].map((h) => h.trim().toLowerCase());
    const col = (name) => header.indexOf(name);
    const ci = {
      code: col("code"),
      product: col("product"),
      qty: col("qty") >= 0 ? col("qty") : col("quantity"),
      total: col("total"),
      uom: col("uom"),
    };
    const rows = [];
    for (let i = 1; i < records.length; i++) {
      const r = records[i];
      if (!r.length || !(r[ci.code] || "").trim()) continue;
      rows.push({
        code: (r[ci.code] || "").trim(),
        product: ci.product >= 0 ? (r[ci.product] || "").trim() : "",
        qty: num(r[ci.qty]) || 0,
        total: ci.total >= 0 ? (num(r[ci.total]) || 0) : 0,
        uom: ci.uom >= 0 ? (r[ci.uom] || "").trim() : "",
      });
    }
    return { start, end, company: company || "Unknown", rows };
  }

  // minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines)
  function parseDelimited(text) {
    const rows = [];
    let row = [], field = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c !== ""));
  }

  function parseFile(text, filename) {
    const head = text.slice(0, 512).trimStart().toLowerCase();
    if (head.startsWith("<?xml") || head.includes("<workbook"))
      return parseSpreadsheetML(text, filename);
    return parseCSVText(text, filename);
  }

  // parse an inventory CSV -> { code: InventoryInfo }
  function parseInventory(text) {
    const records = parseDelimited(text);
    if (!records.length) return {};
    const header = records[0].map((h) => h.trim().toLowerCase());
    const idx = (n) => header.indexOf(n);
    const map = {};
    for (let i = 1; i < records.length; i++) {
      const r = records[i];
      const code = (r[idx("code")] || "").trim();
      if (!code) continue;
      const lt = (r[idx("lead_time_days")] || "").trim();
      map[code] = {
        on_hand: num(r[idx("on_hand")]) || 0,
        on_order: num(r[idx("on_order")]) || 0,
        pack_size: Math.max(1, Math.trunc(num(r[idx("pack_size")]) || 1)),
        moq: Math.trunc(num(r[idx("moq")]) || 0),
        unit_cost: num(r[idx("unit_cost")]) || 0,
        supplier: (r[idx("supplier")] || "").trim(),
        lead_time_days: /^\d+$/.test(lt) ? Number(lt) : null,
        known: true,
      };
    }
    return map;
  }

  // ---------- forecasting ---------------------------------------------------

  function emptyInv() {
    return { on_hand: 0, on_order: 0, pack_size: 1, moq: 0, unit_cost: 0,
      supplier: "", lead_time_days: null, known: false };
  }

  function seasonFactor(cfg, month) {
    const t = cfg.seasonality || {};
    return Number(t[String(month)] != null ? t[String(month)] : 1.0);
  }

  function isNonOrderable(name, cfg) {
    return (cfg.non_orderable_patterns || []).some((p) => {
      try { return new RegExp(p, "i").test(name); } catch (e) { return false; }
    });
  }

  function movementClass(per30, cfg) {
    const t = cfg.movement_tiers;
    if (per30 >= t.fast) return "fast";
    if (per30 >= t.medium) return "medium";
    if (per30 >= t.slow) return "slow";
    return "minimal";
  }

  function buildSeries(periods) {
    periods = periods.slice().sort((a, b) => a.start - b.start);
    const series = {};
    periods.forEach((p, pi) => {
      const seen = new Set();
      const byCode = {};
      for (const r of p.rows) {
        const e = byCode[r.code] || { q: 0, t: 0, name: "", uom: "" };
        e.q += r.qty; e.t += r.total; e.name = r.product || e.name; e.uom = r.uom || e.uom;
        byCode[r.code] = e;
      }
      for (const code in byCode) {
        const e = byCode[code];
        const s = series[code] || (series[code] = { code, product: e.name, uom: e.uom, periods: [], qty: [], revenue: [] });
        s.product = e.name || s.product;
        s.uom = e.uom || s.uom;
        s.periods.push([p.start, p.end]);
        s.qty.push(e.q);
        s.revenue.push(e.t);
        seen.add(code);
      }
      for (const code in series) {
        const s = series[code];
        if (!seen.has(code) && s.qty.length < pi + 1) {
          s.periods.push([p.start, p.end]);
          s.qty.push(0);
          s.revenue.push(0);
        }
      }
    });
    return series;
  }

  function dailyDemand(s) {
    return s.periods.map(([a, b], i) => {
      const d = daysBetween(a, b);
      return d ? s.qty[i] / d : 0;
    });
  }

  function weightedAddAndTrend(dd, weights) {
    if (!dd.length) return [0, 0];
    if (dd.length === 1) return [dd[0], 0];
    const newest = dd.slice().reverse();
    const w = [];
    for (let i = 0; i < newest.length; i++) w.push(weights[i] != null ? weights[i] : weights[weights.length - 1]);
    const wsum = w.reduce((a, b) => a + b, 0) || 1;
    const add = newest.reduce((acc, v, i) => acc + v * w[i], 0) / wsum;
    const n = dd.length;
    const xs = Array.from({ length: n }, (_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = dd.reduce((a, b) => a + b, 0) / n;
    let denom = 0, numr = 0;
    for (let i = 0; i < n; i++) { denom += (xs[i] - mx) ** 2; numr += (xs[i] - mx) * (dd[i] - my); }
    const slope = numr / (denom || 1);
    return [add, (slope / (my || 1)) * 100];
  }

  function buildRecommendations(periods, inventory, config, targetMonth) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
    inventory = inventory || {};
    const latest = periods.slice().sort((a, b) => a.start - b.start).pop();
    if (targetMonth == null) {
      const nm = new Date(latest.end); nm.setUTCDate(nm.getUTCDate() + 1);
      targetMonth = nm.getUTCMonth() + 1;
    }
    const series = buildSeries(periods);
    const horizon = cfg.forecast_period_days;
    const season = seasonFactor(cfg, targetMonth);
    const growth = cfg.growth_factor;

    const latestRev = {};
    for (const r of latest.rows) latestRev[r.code] = (latestRev[r.code] || 0) + r.total;
    const ranked = Object.entries(latestRev).sort((a, b) => b[1] - a[1]);
    const totalRev = Object.values(latestRev).reduce((a, b) => a + b, 0) || 1;
    const abc = {};
    let cum = 0;
    for (const [code, rev] of ranked) {
      cum += rev;
      const share = cum / totalRev;
      abc[code] = share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C";
    }

    const recs = [];
    for (const code in series) {
      const s = series[code];
      const dd = dailyDemand(s);
      const [add, trend] = weightedAddAndTrend(dd, cfg.history_weights);
      const months = s.qty.length;
      const effGrowth = months === 1 ? growth : 1.0;

      const inv = inventory[code] || emptyInv();
      const lead = inv.lead_time_days || cfg.lead_time_days;
      const review = cfg.review_period_days;

      const forecastUnits = add * horizon * effGrowth * season;
      const safetyUnits = add * cfg.safety_stock_days;
      const rop = add * lead + safetyUnits;
      const orderUpTo = add * (lead + review) * effGrowth * season + safetyUnits;

      const pack = inv.pack_size || cfg.default_pack_size || 1;
      const rawNeed = Math.max(0, orderUpTo - inv.on_hand - inv.on_order);
      let packs = rawNeed > 0 ? Math.ceil(rawNeed / pack) : 0;
      if (packs && inv.moq) packs = Math.max(packs, Math.ceil(inv.moq / pack));
      let orderUnits = packs * pack;

      let unitsSoldLatest = 0;
      s.periods.forEach(([a], i) => { if (+a === +latest.start) unitsSoldLatest = s.qty[i]; });
      const per30 = add * 30;
      const movement = movementClass(per30, cfg);

      const flags = [];
      if (!inv.known) flags.push("no stock data - qty assumes 0 on hand");
      if (isNonOrderable(s.product, cfg)) {
        flags.push("non-orderable (service/consumable) - excluded from PO");
        orderUnits = 0; packs = 0;
      }
      if (months === 1) flags.push("single month - projection only, not a true forecast");
      if (unitsSoldLatest <= 2 && (movement === "slow" || movement === "minimal"))
        flags.push("long-tail - consider buy-to-order or delist");
      if (trend <= -25 && months >= 2) flags.push(`declining ~${trend.toFixed(0)}%/mo`);
      if (trend >= 25 && months >= 2) flags.push(`growing ~${trend.toFixed(0)}%/mo`);
      if (inv.known && inv.on_hand + inv.on_order >= orderUpTo && per30 > 0)
        flags.push("stock above target - no order needed");

      recs.push({
        code, product: s.product, uom: s.uom,
        units_sold_latest: unitsSoldLatest,
        revenue_latest: latestRev[code] || 0,
        months_observed: months,
        avg_daily_demand: add,
        trend_pct_per_month: trend,
        forecast_units: forecastUnits,
        safety_stock_units: safetyUnits,
        reorder_point_units: rop,
        order_up_to_units: orderUpTo,
        on_hand: inv.on_hand,
        on_order: inv.on_order,
        suggested_order_units: orderUnits,
        suggested_order_packs: packs,
        pack_size: pack,
        est_order_cost: orderUnits * inv.unit_cost,
        abc_class: abc[code] || "C",
        movement_class: movement,
        supplier: inv.supplier,
        flags,
      });
    }

    const abcRank = { A: 0, B: 1, C: 2 };
    recs.sort((a, b) =>
      (a.supplier || "~").localeCompare(b.supplier || "~") ||
      abcRank[a.abc_class] - abcRank[b.abc_class] ||
      b.suggested_order_units - a.suggested_order_units ||
      a.product.toLowerCase().localeCompare(b.product.toLowerCase()));

    return { recs, targetMonth, latest, periods: periods.slice().sort((a, b) => a.start - b.start) };
  }

  // ---------- CSV export -------------------------------------------------

  const CSV_FIELDS = [
    "supplier", "code", "product", "uom", "abc_class", "movement_class",
    "months_observed", "units_sold_latest", "revenue_latest", "avg_daily_demand",
    "trend_pct_per_month", "forecast_units", "safety_stock_units",
    "reorder_point_units", "order_up_to_units", "on_hand", "on_order",
    "pack_size", "suggested_order_packs", "suggested_order_units",
    "est_order_cost", "flags",
  ];

  function csvCell(v) {
    if (typeof v === "number") v = Math.round(v * 100) / 100;
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCSV(recs, kind) {
    if (kind === "po") {
      const lines = [["supplier", "code", "product", "order_packs", "pack_size",
        "order_units", "est_cost", "reason"].join(",")];
      for (const r of recs) {
        if (r.suggested_order_units <= 0) continue;
        lines.push([r.supplier, r.code, r.product, r.suggested_order_packs, r.pack_size,
          r.suggested_order_units, Math.round(r.est_order_cost * 100) / 100,
          `${r.movement_class}/${r.abc_class}; sold ${r.units_sold_latest} last month`]
          .map(csvCell).join(","));
      }
      return lines.join("\n");
    }
    const lines = [CSV_FIELDS.join(",")];
    for (const r of recs) {
      lines.push(CSV_FIELDS.map((f) => csvCell(f === "flags" ? r.flags.join("; ") : r[f])).join(","));
    }
    return lines.join("\n");
  }

  global.SSK = { DEFAULT_CONFIG, parseFile, parseInventory, buildRecommendations, toCSV };
})(window);
