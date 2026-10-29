"use client";

import { useState } from "react";

type Result = {
  name: string;
  points: number;
  lifetimePoints: number;
  history: { id: string; type: string; points: number; balanceAfter: number; createdAt: string }[];
};

const TYPE_LABELS: Record<string, string> = {
  EARN: "Earned on a purchase",
  REDEEM: "Used on a purchase",
  ADJUST: "Adjustment by the store",
  VOID_EARN: "Purchase cancelled",
  VOID_REDEEM: "Purchase cancelled, points returned",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(iso));
}

export function PointsChecker() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/points/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setResult(data);
      setPin("");
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-3xl bg-brand-black p-7 text-white shadow-xl shadow-brand-black/20 sm:p-9">
        <p className="text-sm text-neutral-400">Hi, {result.name.split(" ")[0]}</p>
        <p className="mt-6 text-xs uppercase tracking-[0.25em] text-brand-gold">Your points</p>
        <p className="mt-1 font-display text-7xl font-semibold tabular-nums leading-none sm:text-8xl">{result.points.toLocaleString()}</p>
        <p className="mt-3 text-sm text-neutral-400">{result.lifetimePoints.toLocaleString()} earned in total</p>

        {result.history.length > 0 && (
          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs uppercase tracking-widest text-neutral-500">Recent activity</p>
            <ul className="mt-3 divide-y divide-white/10">
              {result.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <div>
                    <p className="text-neutral-100">{TYPE_LABELS[h.type] ?? h.type}</p>
                    <p className="text-xs text-neutral-500">{formatDate(h.createdAt)}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${h.points >= 0 ? "text-brand-gold" : "text-neutral-300"}`}>
                    {h.points >= 0 ? "+" : "−"}
                    {Math.abs(h.points).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-8 text-sm font-medium text-neutral-300 underline decoration-white/30 underline-offset-8 transition hover:text-white hover:decoration-brand-gold"
        >
          Check another number
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-7 shadow-xl shadow-brand-black/10 ring-1 ring-brand-black/5 sm:p-9">
      <h2 className="font-display text-2xl font-semibold text-brand-black">Sign in to see your balance</h2>

      <label className="mt-6 block text-sm font-medium text-brand-ink">
        Mobile number
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0917 123 4567"
          required
          className="input mt-1.5 py-3 text-base"
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-brand-ink">
        4-digit PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          pattern="\d{4}"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••"
          required
          className="input mt-1.5 py-3 text-base tracking-[0.5em]"
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || pin.length !== 4}
        className="mt-6 w-full rounded-full bg-brand-red px-6 py-3.5 text-sm font-medium text-white shadow-lg shadow-brand-red/25 transition hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none"
      >
        {loading ? "Checking…" : "Check my points"}
      </button>
      <p className="mt-4 text-center text-xs text-brand-ink/50">Forgot your PIN? Ask the cashier at the store for a new one.</p>
    </form>
  );
}
