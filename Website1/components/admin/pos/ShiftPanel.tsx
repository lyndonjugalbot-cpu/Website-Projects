"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";

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
 * "My shift" strip at the top of the register: time in/out, and the
 * start-of-shift and end-of-shift cash + GCash counts. Everything is
 * recorded server-side against the signed-in user.
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

  // Tick once a minute so the "timed in for …" label stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!state) return <div className="h-28 animate-pulse rounded-2xl border border-neutral-200 bg-white" />;

  const { timeEntry, cashSession } = state;
  const cashValid = cash !== "" && gcash !== "" && toCentavos(cash) >= 0 && toCentavos(gcash) >= 0;

  return (
    <section aria-label="My shift" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Time clock */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-neutral-900">Time clock</h2>
            {timeEntry ? (
              <p className="mt-1 text-sm text-neutral-600">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Timed in at <strong>{fmtTime(timeEntry.clockIn)}</strong> · {formatElapsed(timeEntry.clockIn, now)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">You&apos;re not timed in.</p>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              Today so far: {state.todayHours.toFixed(2)} hrs
              {state.todayEntries.some((e) => e.clockOut) && ` (${state.todayEntries.filter((e) => e.clockOut).length} completed)`}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => post("/api/admin/pos/time", { action: timeEntry ? "out" : "in" }))}
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300 ${
              timeEntry ? "bg-neutral-800 hover:bg-neutral-900" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {timeEntry ? "Time out" : "Time in"}
          </button>
        </div>
        {state.todayEntries.some((e) => e.clockOut) && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            {state.todayEntries
              .filter((e) => e.clockOut)
              .map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>
                    {fmtTime(e.clockIn)} – {fmtTime(e.clockOut as string)}
                  </span>
                  <span className="font-medium text-neutral-700">{(e.hoursWorked ?? 0).toFixed(2)} hrs</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Cash drawer */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Cash drawer</h2>

        {!cashSession ? (
          <form
            className="mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => post("/api/admin/pos/cash", { action: "open", cashCentavos: toCentavos(cash), gcashCentavos: toCentavos(gcash) }));
            }}
          >
            <p className="text-sm text-neutral-500">Start of shift — count the drawer and check your GCash balance.</p>
            {state.lastClose && (
              <p className="mt-1 text-xs text-neutral-400">
                Last shift closed with {formatCentavosAsPHP(state.lastClose.closingCashCentavos ?? 0)} cash and{" "}
                {formatCentavosAsPHP(state.lastClose.closingGcashCentavos ?? 0)} GCash.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyField label="Cash in drawer (₱)" value={cash} onChange={setCash} />
              <MoneyField label="GCash balance (₱)" value={gcash} onChange={setGcash} />
            </div>
            <button
              type="submit"
              disabled={busy || !cashValid}
              className="mt-3 rounded-full bg-brand-red px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              Record start of shift
            </button>
          </form>
        ) : (
          <form
            className="mt-2"
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
            <p className="text-sm text-neutral-600">
              Started at <strong>{fmtTime(cashSession.openedAt)}</strong> with {formatCentavosAsPHP(cashSession.openingCashCentavos)} cash
              and {formatCentavosAsPHP(cashSession.openingGcashCentavos)} GCash.
            </p>
            <p className="mt-1 text-xs text-neutral-400">End of shift — count what you actually have now.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyField label="Cash counted (₱)" value={cash} onChange={(v) => { setCash(v); setConfirmingClose(false); }} />
              <MoneyField label="GCash balance (₱)" value={gcash} onChange={(v) => { setGcash(v); setConfirmingClose(false); }} />
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional) — e.g. paid supplier ₱200 from drawer"
              className="input mt-3"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={busy || !cashValid}
              className="mt-3 rounded-full bg-neutral-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {confirmingClose
                ? `Confirm: ${formatCentavosAsPHP(toCentavos(cash))} cash, ${formatCentavosAsPHP(toCentavos(gcash))} GCash`
                : "Record end of shift"}
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
    </section>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-neutral-700">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder="0.00"
      />
    </label>
  );
}
