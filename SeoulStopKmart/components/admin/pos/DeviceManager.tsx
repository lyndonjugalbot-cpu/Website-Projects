"use client";

import { useCallback, useEffect, useState } from "react";

type Device = {
  id: string;
  name: string;
  approvedByName: string;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const fmt = (iso: string) => dateFormatter.format(new Date(iso));

// Owner-only. "Approve this computer" stores a secret key in this browser, so
// run it on the store machine itself (signed in as the owner).
export function DeviceManager() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pos/devices", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load devices");
      setDevices(data.devices);
      setCurrentId(data.currentDeviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load devices");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pos/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not approve this computer");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this computer");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/pos/devices/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not revoke the device");
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke the device");
    }
  }

  const active = (devices ?? []).filter((d) => !d.revokedAt);
  const revoked = (devices ?? []).filter((d) => d.revokedAt);
  const lockOn = (devices ?? []).length > 0;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-neutral-500">This computer</h2>
        {currentId ? (
          <div className="mt-3 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
            <span aria-hidden>✓</span>
            <p>
              <strong className="font-medium">Approved.</strong> Staff can sign in on this computer
              {active.find((d) => d.id === currentId) ? ` (${active.find((d) => d.id === currentId)?.name})` : ""}.
            </p>
          </div>
        ) : (
          <form onSubmit={approve} className="mt-3">
            <p className="text-lg font-semibold tracking-tight text-neutral-900">Approve this computer</p>
            <p className="mt-0.5 text-sm text-neutral-500">
              Do this on the <strong className="font-medium text-neutral-700">store computer</strong>, signed in as the owner. Staff will then be able to
              sign in here, and nowhere else.
            </p>
            <label className="mt-4 flex flex-col gap-1.5 text-xs">
              <span className="font-medium text-neutral-600">Name for this computer</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front counter"
                maxLength={60}
                required
                className="input rounded-xl py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="mt-4 w-full rounded-2xl bg-brand-red px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-red-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {busy ? "Approving…" : "Approve this computer"}
            </button>
            {!lockOn && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                The device lock turns on as soon as you approve the first computer. Until then staff can sign in from anywhere.
              </p>
            )}
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-neutral-500">Approved computers</h2>
        {devices === null ? (
          <div className="mt-3 h-20 animate-pulse rounded-2xl bg-neutral-100" />
        ) : active.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
            {lockOn ? "No active computers. Staff are locked out until you approve one." : "None yet."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {active.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">
                    {d.name}
                    {d.id === currentId && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">This computer</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-400">
                    Approved {fmt(d.createdAt)} by {d.approvedByName} · {d.lastSeenAt ? `last staff sign-in ${fmt(d.lastSeenAt)}` : "no staff sign-ins yet"}
                  </p>
                </div>
                {confirmId === d.id ? (
                  <button
                    type="button"
                    onClick={() => revoke(d.id)}
                    className="shrink-0 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Confirm revoke
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(d.id)}
                    className="shrink-0 text-xs font-medium text-neutral-400 hover:text-red-600"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {revoked.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">Revoked</p>
            <ul className="mt-1 text-xs text-neutral-400">
              {revoked.map((d) => (
                <li key={d.id} className="py-1">
                  {d.name} · revoked {fmt(d.revokedAt as string)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
