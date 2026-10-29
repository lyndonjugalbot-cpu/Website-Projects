"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { SHIFT_CHANGED_EVENT } from "./ShiftStatus";

type TimeEntry = { id: string; clockIn: string; clockOut: string | null; hoursWorked: number | null };
type CashSession = { id: string; openedAt: string; openingCashCentavos: number; openingGcashCentavos: number };
type ShiftState = {
  timeEntry: TimeEntry | null;
  todayHours: number;
  todayEntries: TimeEntry[];
  cashSession: CashSession | null;
  lastClose: { closedAt: string; closingCashCentavos: number; closingGcashCentavos: number } | null;
};

const timeFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", timeStyle: "short" });
const clockFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" });
const fmtTime = (iso: string) => timeFormatter.format(new Date(iso));

function formatElapsed(fromIso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

const toCentavos = (v: string) => Math.round((Number.parseFloat(v) || 0) * 100);

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

/**
 * The Shift tab's left column: time in/out, and the start-of-shift and
 * end-of-shift cash + GCash counts. Everything is recorded server-side
 * against the signed-in user.
 */
export function ShiftPanel() {
  const [state, setState] = useState<ShiftState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cash, setCash] = useState("");
  const [gcash, setGcash] = useState("");
  const [note, setNote] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pos/shift", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your shift");
      setState(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your shift");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tick every second so the big clock and the "timed in for …" label stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      setCash("");
      setGcash("");
      setNote("");
      setConfirmingClose(false);
      await load();
      // Lets the Cash out card know the drawer just opened or closed.
      window.dispatchEvent(new Event(SHIFT_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!state)
    return (
      <div className="flex flex-col gap-5">
        <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );

  const { timeEntry, cashSession } = state;
  const cashValid = cash !== "" && gcash !== "" && toCentavos(cash) >= 0 && toCentavos(gcash) >= 0;
  const completed = state.todayEntries.filter((e) => e.clockOut);

  return (
    <section aria-label="My shift" className="flex flex-col gap-5">
      {/* Time clock */}
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className={`px-6 pb-6 pt-5 transition-colors ${timeEntry ? "bg-brand-black text-white" : "bg-white text-neutral-900"}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={`text-sm font-medium ${timeEntry ? "text-white/70" : "text-neutral-500"}`}>Time clock</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                timeEntry ? "bg-emerald-400/15 text-emerald-300" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${timeEntry ? "animate-pulse bg-emerald-400" : "bg-neutral-400"}`} />
              {timeEntry ? "On the clock" : "Off the clock"}
            </span>
          </div>

          <p className="mt-4 text-5xl font-semibold tabular-nums tracking-tight">{clockFormatter.format(new Date(now))}</p>
          <p className={`mt-2 text-sm ${timeEntry ? "text-white/60" : "text-neutral-500"}`}>
            {timeEntry ? (
              <>
                Timed in at <strong className="font-medium text-white">{fmtTime(timeEntry.clockIn)}</strong> · {formatElapsed(timeEntry.clockIn, now)} so far
              </>
            ) : (
              "You're not timed in."
            )}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => post("/api/admin/pos/time", { action: timeEntry ? "out" : "in" }))}
            className={`mt-5 w-full rounded-2xl px-5 py-3.5 text-base font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
              timeEntry ? "bg-white text-neutral-900 hover:bg-neutral-100" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {timeEntry ? "Time out" : "Time in"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-6 py-3.5 text-sm">
          <span className="text-neutral-500">Today so far</span>
          <span className="font-semibold tabular-nums text-neutral-900">{state.todayHours.toFixed(2)} hrs</span>
        </div>
        {completed.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-neutral-100 bg-neutral-50/60 px-6 py-3.5 text-xs text-neutral-500">
            {completed.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>
                  {fmtTime(e.clockIn)} – {fmtTime(e.clockOut as string)}
                </span>
                <span className="font-medium tabular-nums text-neutral-700">{(e.hoursWorked ?? 0).toFixed(2)} hrs</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cash drawer */}
      <div id="cash-drawer" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-neutral-500">Cash drawer</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              cashSession ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cashSession ? "bg-emerald-500" : "bg-neutral-400"}`} />
            {cashSession ? "Drawer open" : "Not counted yet"}
          </span>
        </div>

        {!cashSession ? (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => post("/api/admin/pos/cash", { action: "open", cashCentavos: toCentavos(cash), gcashCentavos: toCentavos(gcash) }));
            }}
          >
            <p className="text-lg font-semibold tracking-tight text-neutral-900">Start of shift</p>
            <p className="mt-0.5 text-sm text-neutral-500">Count the drawer and check your GCash balance.</p>
            {state.lastClose && (
              <p className="mt-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-500">
                Last shift closed with <strong className="text-neutral-700">{formatCentavosAsPHP(state.lastClose.closingCashCentavos ?? 0)}</strong>{" "}
                cash and <strong className="text-neutral-700">{formatCentavosAsPHP(state.lastClose.closingGcashCentavos ?? 0)}</strong> GCash.
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MoneyField label="Cash in drawer" value={cash} onChange={setCash} />
              <MoneyField label="GCash balance" value={gcash} onChange={setGcash} />
            </div>
            <button
              type="submit"
              disabled={busy || !cashValid}
              className="mt-5 w-full rounded-2xl bg-brand-red px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-red-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              Record start of shift
            </button>
          </form>
        ) : (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirmingClose) {
                setConfirmingClose(true);
                return;
              }
              run(() =>
                post("/api/admin/pos/cash", { action: "close", cashCentavos: toCentavos(cash), gcashCentavos: toCentavos(gcash), note })
              );
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Opening cash" value={formatCentavosAsPHP(cashSession.openingCashCentavos)} />
              <Stat label="Opening GCash" value={formatCentavosAsPHP(cashSession.openingGcashCentavos)} />
            </div>
            <p className="mt-2 text-xs text-neutral-400">Started at {fmtTime(cashSession.openedAt)}</p>

            <div className="mt-5 border-t border-neutral-100 pt-5">
              <p className="text-lg font-semibold tracking-tight text-neutral-900">End of shift</p>
              <p className="mt-0.5 text-sm text-neutral-500">Count what you actually have now.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MoneyField
                  label="Cash counted"
                  value={cash}
                  onChange={(v) => {
                    setCash(v);
                    setConfirmingClose(false);
                  }}
                />
                <MoneyField
                  label="GCash balance"
                  value={gcash}
                  onChange={(v) => {
                    setGcash(v);
                    setConfirmingClose(false);
                  }}
                />
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional), e.g. paid supplier ₱200 from drawer"
                className="input mt-3 rounded-xl py-2.5"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={busy || !cashValid}
                className="mt-4 w-full rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                {confirmingClose
                  ? `Confirm: ${formatCentavosAsPHP(toCentavos(cash))} cash, ${formatCentavosAsPHP(toCentavos(gcash))} GCash`
                  : "Record end of shift"}
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs">
      <span className="font-medium text-neutral-600">{label}</span>
      <span className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">₱</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input rounded-xl py-2.5 pl-8 text-base tabular-nums"
          placeholder="0.00"
        />
      </span>
    </label>
  );
}
