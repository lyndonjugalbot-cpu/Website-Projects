"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { formatPhone } from "@/lib/loyalty-math";

type Row = { id: string; name: string; phone: string; points: number; lifetimePoints: number; createdAt: string };

export function CustomerManager({ customers, query }: { customers: Row[]; query: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [openId, setOpenId] = useState<string | null>(null);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdjust(id: string) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: Number.parseInt(points, 10), note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not adjust points");
      setOpenId(null);
      setPoints("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adjust points");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(search.trim() ? `/admin/customers?q=${encodeURIComponent(search.trim())}` : "/admin/customers");
        }}
        className="max-w-md"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or mobile number"
          className="input"
          aria-label="Search members"
        />
      </form>

      {customers.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">{query ? "No members match." : "No members yet. Sign one up from the POS."}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Mobile</th>
                <th className="px-4 py-2.5 text-right font-medium">Points</th>
                <th className="px-4 py-2.5 text-right font-medium">Earned to date</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-neutral-900">{c.name}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{formatPhone(c.phone)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-brand-red">{c.points.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-500">{c.lifetimePoints.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenId(openId === c.id ? null : c.id);
                          setError(null);
                        }}
                        className="text-sm font-medium text-brand-red hover:underline"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                  {openId === c.id && (
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex flex-col gap-1 text-xs text-neutral-500">
                            Points to add (+) or remove (−)
                            <input type="number" step="1" value={points} onChange={(e) => setPoints(e.target.value)} className="input w-40 py-1" />
                          </label>
                          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-neutral-500">
                            Reason
                            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input py-1" />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAdjust(c.id)}
                            disabled={saving}
                            className="rounded-full bg-brand-red px-5 py-1.5 text-sm font-medium text-white hover:bg-brand-red-dark disabled:bg-neutral-300"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
