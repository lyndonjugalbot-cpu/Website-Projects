"use client";

import { useEffect, useRef, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { formatPhone, pointsValueCentavos } from "@/lib/loyalty-math";
import { POINTS_MIN_REDEEM } from "@/lib/store-config";

export type PosMember = { id: string; name: string; phone: string; points: number };

type Props = {
  member: PosMember | null;
  onChange: (member: PosMember | null) => void;
  /** Most points this sale can use (0 when under the minimum or no balance). */
  maxRedeem: number;
  redeemInput: string;
  onRedeemInputChange: (value: string) => void;
  /** Points actually being spent after clamping to the limits. */
  redeemPoints: number;
  /** Points the member will earn on this sale. */
  earnPreview: number;
};

// Loyalty member for the sale in progress: find by phone/name, sign up a new
// one, and spend their points as a discount.
export function MemberPanel({ member, onChange, maxRedeem, redeemInput, onRedeemInputChange, redeemPoints, earnPreview }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<"find" | "enroll">("find");
  const [enrollName, setEnrollName] = useState("");
  const [enrollPhone, setEnrollPhone] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<{ name: string; pin: string } | null>(null);
  const latestQuery = useRef("");

  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/pos/customers?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (latestQuery.current === q && res.ok) setResults(data.members);
      } finally {
        if (latestQuery.current === q) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function select(m: PosMember) {
    onChange(m);
    setQuery("");
    setResults([]);
    setError(null);
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnrolling(true);
    try {
      const res = await fetch("/api/admin/pos/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: enrollName, phone: enrollPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign up the member");
      setNewPin({ name: data.member.name, pin: data.pin });
      select(data.member);
      setEnrollName("");
      setEnrollPhone("");
      setMode("find");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up the member");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleResetPin() {
    if (!member) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/pos/customers/${member.id}/reset-pin`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reset the PIN");
      setNewPin({ name: member.name, pin: data.pin });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the PIN");
    }
  }

  const rawRedeem = Number.parseInt(redeemInput, 10) || 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium text-neutral-800">Rewards member</p>
        {member && (
          <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-neutral-400 hover:text-red-600">
            Remove
          </button>
        )}
      </div>

      {newPin && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            PIN for <span className="font-medium">{newPin.name}</span> — tell them now, it can&apos;t be shown again. They use it with their
            mobile number to check points on the website.
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tracking-[0.3em] text-amber-950">{newPin.pin}</p>
          <button type="button" onClick={() => setNewPin(null)} className="mt-1.5 text-xs font-medium text-amber-800 underline">
            Done
          </button>
        </div>
      )}

      {member ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-neutral-900">{member.name}</p>
              <p className="text-xs text-neutral-500">{formatPhone(member.phone)}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold leading-none text-brand-red">{member.points.toLocaleString()}</p>
              <p className="text-[11px] text-neutral-500">points</p>
            </div>
          </div>

          {maxRedeem > 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
              <label className="flex items-center justify-between gap-2">
                <span className="text-neutral-600">
                  Use points
                  <span className="block text-[11px] text-neutral-400">
                    1 point = {formatCentavosAsPHP(pointsValueCentavos(1))} · up to {maxRedeem.toLocaleString()} on this sale
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={redeemInput}
                    onChange={(e) => onRedeemInputChange(e.target.value)}
                    className="input w-20 py-1 text-right"
                    aria-label="Points to use"
                  />
                  <button
                    type="button"
                    onClick={() => onRedeemInputChange(String(maxRedeem))}
                    className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-500"
                  >
                    Max
                  </button>
                </span>
              </label>
              {rawRedeem > 0 && rawRedeem < POINTS_MIN_REDEEM && (
                <p className="mt-1.5 text-xs text-red-600">Use at least {POINTS_MIN_REDEEM} points.</p>
              )}
              {rawRedeem > maxRedeem && (
                <p className="mt-1.5 text-xs text-red-600">Limited to {maxRedeem.toLocaleString()} points on this sale.</p>
              )}
              {redeemPoints > 0 && (
                <p className="mt-1.5 text-xs font-medium text-emerald-700">
                  Taking {formatCentavosAsPHP(pointsValueCentavos(redeemPoints))} off with {redeemPoints.toLocaleString()} points.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              {member.points < POINTS_MIN_REDEEM
                ? `Needs ${POINTS_MIN_REDEEM} points before they can use them.`
                : "Add items to use points on this sale."}
            </p>
          )}

          {earnPreview > 0 && <p className="text-xs text-neutral-500">Earns {earnPreview.toLocaleString()} point{earnPreview === 1 ? "" : "s"} on this sale.</p>}

          <button type="button" onClick={handleResetPin} className="self-start text-xs font-medium text-neutral-400 underline hover:text-neutral-700">
            Forgot PIN? Give a new one
          </button>
        </div>
      ) : mode === "find" ? (
        <div className="mt-2.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find by mobile number or name"
            className="input"
            aria-label="Find a rewards member"
          />
          {results.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => select(m)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-neutral-50"
                  >
                    <span>
                      <span className="font-medium text-neutral-900">{m.name}</span>
                      <span className="ml-2 text-xs text-neutral-500">{formatPhone(m.phone)}</span>
                    </span>
                    <span className="text-xs font-medium text-brand-red">{m.points.toLocaleString()} pts</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="mt-1.5 text-xs text-neutral-500">No member found.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setMode("enroll");
              setError(null);
            }}
            className="mt-2 text-xs font-medium text-brand-red hover:underline"
          >
            + Sign up a new member
          </button>
        </div>
      ) : (
        <form onSubmit={handleEnroll} className="mt-2.5 flex flex-col gap-2">
          <input
            type="text"
            value={enrollName}
            onChange={(e) => setEnrollName(e.target.value)}
            placeholder="Full name"
            className="input"
            aria-label="Member name"
          />
          <input
            type="tel"
            value={enrollPhone}
            onChange={(e) => setEnrollPhone(e.target.value)}
            placeholder="Mobile number, e.g. 0917 123 4567"
            className="input"
            aria-label="Member mobile number"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={enrolling}
              className="rounded-full bg-brand-red px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-red-dark disabled:bg-neutral-300"
            >
              {enrolling ? "Signing up…" : "Sign up member"}
            </button>
            <button type="button" onClick={() => setMode("find")} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
