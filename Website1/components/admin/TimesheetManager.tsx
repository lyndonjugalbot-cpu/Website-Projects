"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  userId: string;
  userName: string;
  clockIn: string;
  clockOut: string | null;
  hoursWorked: number | null;
  note: string | null;
  editedByName: string | null;
  missedTimeOut: boolean;
  stillClockedIn: boolean;
};
type UserOption = { id: string; name: string };

const timeFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", timeStyle: "short" });
const dayFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Manila time, for <input type="datetime-local">. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
/** "YYYY-MM-DDTHH:mm" entered as Manila time -> ISO instant. */
const fromLocalInput = (v: string) => new Date(`${v}:00+08:00`).toISOString();

const pad = (n: number) => String(n).padStart(2, "0");
function lastDayOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}
function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export function TimesheetManager({ today }: { today: string }) {
  const month = today.slice(0, 7);
  const [range, setRange] = useState({ start: `${month}-01`, end: today });
  const [userFilter, setUserFilter] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ userId: "", clockIn: "", clockOut: "", note: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ start: range.start, end: range.end, ...(userFilter ? { userId: userFilter } : {}) });
      const res = await fetch(`/api/admin/timesheets?${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load timesheets");
      setEntries(data.entries);
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load timesheets");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, userFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; shifts: number; problems: number }>();
    for (const e of entries) {
      const row = map.get(e.userId) ?? { name: e.userName, hours: 0, shifts: 0, problems: 0 };
      if (e.clockOut) {
        row.hours += e.hoursWorked ?? 0;
        row.shifts += 1;
      }
      if (e.missedTimeOut) row.problems += 1;
      map.set(e.userId, row);
    }
    return Array.from(map.entries())
      .map(([userId, v]) => ({ userId, ...v, hours: Math.round(v.hours * 100) / 100 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const problemCount = entries.filter((e) => e.missedTimeOut).length;

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setForm({ userId: e.userId, clockIn: toLocalInput(e.clockIn), clockOut: toLocalInput(e.clockOut), note: e.note ?? "" });
    setFormError(null);
    document.getElementById("shift-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ userId: "", clockIn: "", clockOut: "", note: "" });
    setFormError(null);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!form.clockIn || !form.clockOut) {
      setFormError("Enter both a time in and a time out");
      return;
    }
    setSaving(true);
    try {
      const body = { clockIn: fromLocalInput(form.clockIn), clockOut: fromLocalInput(form.clockOut), note: form.note || null };
      const res = await fetch(editingId ? `/api/admin/timesheets/${editingId}` : "/api/admin/timesheets", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? body : { ...body, userId: form.userId, note: form.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save shift");
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save shift");
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: Entry) {
    if (!confirm(`Delete ${e.userName}'s shift on ${dayFmt.format(new Date(e.clockIn))}?`)) return;
    const res = await fetch(`/api/admin/timesheets/${e.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Could not delete shift");
      return;
    }
    await load();
  }

  const presets = [
    { label: "1st – 15th", start: `${month}-01`, end: `${month}-15` },
    { label: "16th – end", start: `${month}-16`, end: lastDayOf(month) },
    { label: "This month", start: `${month}-01`, end: today },
    { label: "Last month", start: `${prevMonth(month)}-01`, end: lastDayOf(prevMonth(month)) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setRange({ start: p.start, end: p.end })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                range.start === p.start && range.end === p.end ? "bg-brand-red text-white" : "border border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" aria-label="Start date" value={range.start} max={range.end} onChange={(e) => setRange({ ...range, start: e.target.value })} className="input w-auto" />
          <span className="text-neutral-400">to</span>
          <input type="date" aria-label="End date" value={range.end} min={range.start} onChange={(e) => setRange({ ...range, end: e.target.value })} className="input w-auto" />
        </div>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="input w-auto" aria-label="Staff member">
          <option value="">Everyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {problemCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{problemCount} shift{problemCount === 1 ? "" : "s"} with no time-out.</strong> They aren&apos;t counted in the hours below until you
          fix them — click <em>Fix</em> on the row and enter the time out.
        </div>
      )}

      {/* Totals */}
      <section className={`overflow-x-auto rounded-2xl border border-neutral-200 bg-white ${loading ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 text-right font-medium">Completed shifts</th>
              <th className="px-4 py-3 text-right font-medium">Total hours</th>
            </tr>
          </thead>
          <tbody>
            {totals.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-neutral-400">
                  {loading ? "Loading…" : "No time entries in this range."}
                </td>
              </tr>
            )}
            {totals.map((t) => (
              <tr key={t.userId} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-4 py-3 text-neutral-900">{t.name}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{t.shifts}</td>
                <td className="px-4 py-3 text-right text-base font-semibold text-neutral-900">{t.hours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Entries */}
      <section className={`overflow-x-auto rounded-2xl border border-neutral-200 bg-white ${loading ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Day</th>
              <th className="px-4 py-3 font-medium">Time in</th>
              <th className="px-4 py-3 font-medium">Time out</th>
              <th className="px-4 py-3 text-right font-medium">Hours</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-4 py-3 text-neutral-900">{e.userName}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{dayFmt.format(new Date(e.clockIn))}</td>
                <td className="px-4 py-3 text-neutral-700">{timeFmt.format(new Date(e.clockIn))}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {e.clockOut ? (
                    timeFmt.format(new Date(e.clockOut))
                  ) : e.missedTimeOut ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">Missed time-out</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">On shift now</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900">{e.hoursWorked !== null ? e.hoursWorked.toFixed(2) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" onClick={() => startEdit(e)} className="mr-3 text-xs font-medium text-neutral-600 hover:text-neutral-900">
                    {e.missedTimeOut ? "Fix" : "Edit"}
                  </button>
                  <button type="button" onClick={() => remove(e)} className="text-xs font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                  {e.editedByName && <span className="ml-3 text-[11px] text-neutral-400">edited by {e.editedByName}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Add / fix a shift */}
      <form id="shift-form" onSubmit={save} className="max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">{editingId ? "Fix a shift" : "Add a missed shift"}</h2>
        <p className="mt-1 text-xs text-neutral-500">Times are Philippine time. Hours are worked out automatically.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!editingId && (
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-neutral-700">Who worked</span>
              <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input">
                <option value="">Choose…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Time in</span>
            <input required type="datetime-local" value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} className="input" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Time out</span>
            <input required type="datetime-local" value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} className="input" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium text-neutral-700">Note (optional)</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. forgot to time out" className="input" />
          </label>
        </div>
        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Add shift"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
