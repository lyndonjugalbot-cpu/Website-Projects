// WebAppTimer - a static browser time tracker.
// Data model:
//   entry   = { id, task, project, start, end }   // start/end are epoch ms
//   running = { task, project, start, accum, segmentStart } | null
//     start        = when the timer was first started (epoch ms)
//     accum        = tracked ms banked from earlier run segments (before pauses)
//     segmentStart = when the current running segment began, or null while paused
// Everything persists to localStorage on this device only.

const K_ENTRIES = "wat.entries.v1";
const K_RUNNING = "wat.running.v1";

const $ = (sel) => document.querySelector(sel);

let entries = load(K_ENTRIES, []);
let running = load(K_RUNNING, null);
let range = "today";
let tick = null;

// Migrate timers saved before pause/continue existed.
if (running && running.segmentStart === undefined) {
  running.accum = 0;
  running.segmentStart = running.start;
}

/* ---------- storage ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save() {
  localStorage.setItem(K_ENTRIES, JSON.stringify(entries));
  if (running) localStorage.setItem(K_RUNNING, JSON.stringify(running));
  else localStorage.removeItem(K_RUNNING);
}

/* ---------- time helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");

function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function fmtDur(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayLabel(ms) {
  const today = startOfDay(Date.now());
  const that = startOfDay(ms);
  if (that === today) return "Today";
  if (that === today - 86400000) return "Yesterday";
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function hhmm(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// "1h 30m" | "90m" | "1.5h" | "45" (minutes) -> minutes, or NaN
function parseDuration(str) {
  const s = String(str).trim().toLowerCase();
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  let min = 0;
  let matched = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+(?:\.\d+)?)\s*m/);
  if (h) { min += parseFloat(h[1]) * 60; matched = true; }
  if (m) { min += parseFloat(m[1]); matched = true; }
  return matched ? Math.round(min) : NaN;
}

// combine a yyyy-mm-dd string + hh:mm string -> epoch ms
function combine(dateStr, timeStr) {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  return new Date(y, mo - 1, da, h, mi, 0, 0).getTime();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- timer ---------- */
function elapsedMs() {
  if (!running) return 0;
  return running.accum + (running.segmentStart ? Date.now() - running.segmentStart : 0);
}
const isPaused = () => !!running && !running.segmentStart;

function startTimer() {
  if (running) return;
  const task = $("#taskName").value.trim();
  if (!task) { $("#taskName").focus(); return; }
  const now = Date.now();
  running = { task, project: $("#projectName").value.trim(), start: now, accum: 0, segmentStart: now };
  save();
  renderTimer();
}
function pauseResume() {
  if (!running) return;
  if (running.segmentStart) {
    running.accum += Date.now() - running.segmentStart;
    running.segmentStart = null;
  } else {
    running.segmentStart = Date.now();
  }
  save();
  renderTimer();
}
function stopTimer(saveEntry) {
  if (!running) return;
  if (saveEntry) {
    const ms = elapsedMs();
    if (ms >= 1000) {
      entries.push({ id: uid(), task: running.task, project: running.project, start: running.start, end: running.start + ms });
    }
  }
  running = null;
  $("#taskName").value = "";
  save();
  renderTimer();
  renderAll();
}
function renderTimer() {
  const box = $("#running");
  const startBtn = $("#startBtn");
  if (running) {
    box.hidden = false;
    startBtn.hidden = true;
    box.classList.toggle("paused", isPaused());
    $("#pauseBtn").textContent = isPaused() ? "Continue" : "Pause";
    $("#runningTask").textContent = running.project ? `${running.task} - ${running.project}` : running.task;
    updateClock();
    if (!tick) tick = setInterval(updateClock, 1000);
  } else {
    box.hidden = true;
    startBtn.hidden = false;
    clearInterval(tick);
    tick = null;
    document.title = "WebAppTimer - Time Tracker";
  }
}
function updateClock() {
  if (!running) return;
  const t = fmtClock(elapsedMs());
  $("#clock").textContent = t;
  document.title = `${isPaused() ? "Paused " : ""}${t} - ${running.task}`;
}

/* ---------- manual + edit ---------- */
function addManual() {
  const msg = $("#manualMsg");
  const task = $("#mTask").value.trim();
  const project = $("#mProject").value.trim();
  const date = $("#mDate").value;
  const startT = $("#mStart").value;
  const endT = $("#mEnd").value;
  const durRaw = $("#mDur").value.trim();

  msg.className = "status err";
  if (!task) return (msg.textContent = "Add a task name.");
  if (!date) return (msg.textContent = "Pick a date.");

  let start, end;
  if (startT && endT) {
    start = combine(date, startT);
    end = combine(date, endT);
    if (end <= start) end += 86400000; // crossed midnight
  } else if (startT && durRaw) {
    const mins = parseDuration(durRaw);
    if (!mins || mins <= 0) return (msg.textContent = "Couldn't read that duration. Try \"1h 30m\".");
    start = combine(date, startT);
    end = start + mins * 60000;
  } else if (durRaw) {
    const mins = parseDuration(durRaw);
    if (!mins || mins <= 0) return (msg.textContent = "Couldn't read that duration. Try \"1h 30m\".");
    end = combine(date, "12:00");
    start = end - mins * 60000;
  } else {
    return (msg.textContent = "Give a start + end time, or a duration.");
  }

  entries.push({ id: uid(), task, project, start, end });
  save();
  ["#mTask", "#mProject", "#mStart", "#mEnd", "#mDur"].forEach((s) => ($(s).value = ""));
  msg.className = "status ok";
  msg.textContent = `Added ${fmtDur(end - start)}.`;
  renderAll();
}

const dlg = $("#editDialog");
let editingId = null;

function openEdit(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  editingId = id;
  $("#eTask").value = e.task;
  $("#eProject").value = e.project || "";
  $("#eDate").value = dayKey(e.start);
  $("#eStart").value = hhmm24(e.start);
  $("#eEnd").value = hhmm24(e.end);
  $("#editMsg").textContent = "";
  dlg.showModal();
}
function hhmm24(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
$("#editForm").addEventListener("submit", (ev) => {
  const action = ev.submitter && ev.submitter.value;
  if (action !== "save") return; // cancel just closes
  ev.preventDefault();
  const e = entries.find((x) => x.id === editingId);
  if (!e) return dlg.close();
  const date = $("#eDate").value;
  let start = combine(date, $("#eStart").value);
  let end = combine(date, $("#eEnd").value);
  if (end <= start) end += 86400000;
  const task = $("#eTask").value.trim();
  if (!task || !date) { $("#editMsg").textContent = "Task and date are required."; return; }
  Object.assign(e, { task, project: $("#eProject").value.trim(), start, end });
  save();
  dlg.close();
  renderAll();
});

function deleteEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  if (!confirm(`Delete "${e.task}" (${fmtDur(e.end - e.start)})?`)) return;
  entries = entries.filter((x) => x.id !== id);
  save();
  renderAll();
}
function resumeEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e || running) return;
  $("#taskName").value = e.task;
  $("#projectName").value = e.project || "";
  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- rendering ---------- */
function rangeStart() {
  if (range === "today") return startOfDay(Date.now());
  if (range === "week") return startOfWeek(Date.now());
  return 0;
}
function inRange(e) {
  return e.end > rangeStart();
}
function sum(list) {
  return list.reduce((t, e) => t + (e.end - e.start), 0);
}

function renderStats() {
  const dayCut = startOfDay(Date.now());
  const weekCut = startOfWeek(Date.now());
  $("#statToday").textContent = fmtDur(sum(entries.filter((e) => e.end > dayCut)));
  $("#statWeek").textContent = fmtDur(sum(entries.filter((e) => e.end > weekCut)));
  $("#statEntries").textContent = String(entries.length);
  $("#statDays").textContent = String(new Set(entries.map((e) => dayKey(e.start))).size);
}

function renderProjectList() {
  const names = [...new Set(entries.map((e) => e.project).filter(Boolean))].sort();
  $("#projectList").innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join("");
}

function renderBreakdown() {
  const list = entries.filter(inRange);
  const total = sum(list);
  $("#rangeTotal").innerHTML = list.length
    ? `${range === "today" ? "Today" : range === "week" ? "This week" : "All time"}: <b>${fmtDur(total)}</b> across ${list.length} ${list.length === 1 ? "entry" : "entries"}`
    : "";

  const byProject = new Map();
  for (const e of list) {
    const key = e.project || "(no project)";
    byProject.set(key, (byProject.get(key) || 0) + (e.end - e.start));
  }
  const rows = [...byProject.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  $("#breakdown").innerHTML = rows
    .map(
      ([name, ms]) => `
      <div class="bd-row">
        <span class="bd-name">${esc(name)}</span>
        <span class="bd-bar"><i style="width:${Math.max(3, (ms / max) * 100)}%"></i></span>
        <span class="bd-time">${fmtDur(ms)}</span>
      </div>`
    )
    .join("");
}

function renderLog() {
  const list = entries.filter(inRange).sort((a, b) => b.start - a.start);
  const logEl = $("#log");
  $("#empty").hidden = entries.length > 0;

  const days = new Map();
  for (const e of list) {
    const k = dayKey(e.start);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(e);
  }

  logEl.innerHTML = [...days.entries()]
    .map(([, dayEntries]) => {
      const dTotal = sum(dayEntries);
      const head = `<div class="day-head"><span class="d-label">${esc(dayLabel(dayEntries[0].start))}</span><span class="d-total">${fmtDur(dTotal)}</span></div>`;
      const rows = dayEntries
        .map(
          (e) => `
        <div class="entry" data-id="${e.id}">
          <div class="e-task">${esc(e.task)}</div>
          <div class="e-dur">${fmtDur(e.end - e.start)}</div>
          <div class="e-meta">
            ${e.project ? `<span class="tag">${esc(e.project)}</span>` : ""}
            ${hhmm(e.start)} &ndash; ${hhmm(e.end)}
          </div>
          <div class="e-actions">
            <button class="icon-btn" data-act="resume" title="Start a new timer for this task">Resume</button>
            <button class="icon-btn" data-act="edit">Edit</button>
            <button class="icon-btn del" data-act="delete">Delete</button>
          </div>
        </div>`
        )
        .join("");
      return `<div class="day">${head}${rows}</div>`;
    })
    .join("");
}

function renderAll() {
  renderStats();
  renderProjectList();
  renderBreakdown();
  renderLog();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- CSV ---------- */
function toCsv() {
  const head = ["task", "project", "date", "start", "end", "duration_hours"];
  const lines = [head.join(",")];
  for (const e of [...entries].sort((a, b) => a.start - b.start)) {
    const row = [
      e.task,
      e.project || "",
      dayKey(e.start),
      hhmm24(e.start),
      hhmm24(e.end),
      ((e.end - e.start) / 3600000).toFixed(2),
    ].map((v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(row.join(","));
  }
  return lines.join("\n");
}
function exportCsv() {
  const blob = new Blob([toCsv()], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `webapptimer-${dayKey(Date.now())}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function importCsv(text) {
  const msg = $("#dataMsg");
  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  if (rows.length < 2) { msg.className = "status err"; msg.textContent = "Nothing to import."; return; }
  const header = parseCsvLine(rows[0]).map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  let added = 0;
  for (let i = 1; i < rows.length; i++) {
    const c = parseCsvLine(rows[i]);
    const task = (c[idx("task")] || "").trim();
    const date = (c[idx("date")] || "").trim();
    const startT = (c[idx("start")] || "").trim();
    const endT = (c[idx("end")] || "").trim();
    if (!task || !date || !startT || !endT) continue;
    let start = combine(date, startT);
    let end = combine(date, endT);
    if (isNaN(start) || isNaN(end)) continue;
    if (end <= start) end += 86400000;
    entries.push({ id: uid(), task, project: (c[idx("project")] || "").trim(), start, end });
    added++;
  }
  save();
  msg.className = "status ok";
  msg.textContent = `Imported ${added} ${added === 1 ? "entry" : "entries"}.`;
  renderAll();
}
function clearAll() {
  if (!confirm("Delete every entry and stop any running timer? This cannot be undone.")) return;
  entries = [];
  running = null;
  save();
  renderTimer();
  renderAll();
  $("#dataMsg").className = "status ok";
  $("#dataMsg").textContent = "All data cleared.";
}

/* ---------- wire up ---------- */
$("#startBtn").addEventListener("click", startTimer);
$("#pauseBtn").addEventListener("click", pauseResume);
$("#stopBtn").addEventListener("click", () => stopTimer(true));
$("#discardBtn").addEventListener("click", () => {
  if (confirm("Discard the running timer without saving?")) stopTimer(false);
});
$("#taskName").addEventListener("keydown", (e) => { if (e.key === "Enter") startTimer(); });
$("#projectName").addEventListener("keydown", (e) => { if (e.key === "Enter") startTimer(); });

$("#addManual").addEventListener("click", addManual);

$("#log").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".entry").dataset.id;
  const act = btn.dataset.act;
  if (act === "edit") openEdit(id);
  else if (act === "delete") deleteEntry(id);
  else if (act === "resume") resumeEntry(id);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-on"));
    chip.classList.add("is-on");
    range = chip.dataset.range;
    renderBreakdown();
    renderLog();
  });
});

$("#exportBtn").addEventListener("click", exportCsv);
$("#importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importCsv(String(reader.result));
  reader.readAsText(file);
  e.target.value = "";
});
$("#clearBtn").addEventListener("click", clearAll);

// keep the running clock honest after the tab was asleep
document.addEventListener("visibilitychange", () => { if (!document.hidden) updateClock(); });

// default manual date to today
$("#mDate").value = dayKey(Date.now());

renderTimer();
renderAll();
