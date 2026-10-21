"use client";

import { useEffect, useState, useCallback } from "react";
import { STOCK_MOVEMENT_TYPE_LABELS } from "@/lib/types";
import type { StockMovementType } from "@/lib/types";

type Product = { id: string; name: string; stock: number };
type Movement = {
  id: string;
  productId: string;
  previousStock: number;
  quantityChange: number;
  newStock: number;
  type: StockMovementType;
  userName: string | null;
  note: string | null;
  createdAt: string;
  product: { name: string; imageUrl: string };
};

export function InventoryManager({ products }: { products: Product[] }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterProductId, setFilterProductId] = useState("");
  const [filterType, setFilterType] = useState("");

  const [adjustProductId, setAdjustProductId] = useState("");
  const [newStockInput, setNewStockInput] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterProductId) params.set("productId", filterProductId);
    if (filterType) params.set("type", filterType);
    const res = await fetch(`/api/admin/inventory?${params.toString()}`);
    const data = await res.json();
    setMovements(data.movements ?? []);
    setIsLoading(false);
  }, [filterProductId, filterType]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const selectedProduct = products.find((p) => p.id === adjustProductId);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const newStock = Number.parseInt(newStockInput, 10);
    if (!adjustProductId || Number.isNaN(newStock)) {
      setError("Pick a product and enter a valid quantity");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: adjustProductId, newStock, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not adjust stock");
      setAdjustProductId("");
      setNewStockInput("");
      setReason("");
      await loadMovements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adjust stock");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleAdjust} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Manual stock adjustment</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Product</span>
            <select value={adjustProductId} onChange={(e) => setAdjustProductId(e.target.value)} className="input" required>
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (current: {p.stock})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">New quantity</span>
            <input
              type="number"
              min="0"
              value={newStockInput}
              onChange={(e) => setNewStockInput(e.target.value)}
              className="input"
              required
            />
            {selectedProduct && newStockInput && (
              <span className="text-xs text-neutral-400">
                {Number.parseInt(newStockInput, 10) - selectedProduct.stock >= 0 ? "+" : ""}
                {Number.parseInt(newStockInput, 10) - selectedProduct.stock} vs. current
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
            <span className="font-medium text-neutral-700">Reason (required)</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. stock count correction, damaged goods"
              className="input"
              required
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="self-start rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSaving ? "Saving…" : "Apply adjustment"}
        </button>
      </form>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900">Stock movement history</h2>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <select value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)} className="input sm:w-64">
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input sm:w-56">
            <option value="">All movement types</option>
            {Object.entries(STOCK_MOVEMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-neutral-400">Loading&hellip;</p>
        ) : movements.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">No stock movements match these filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Change</th>
                  <th className="px-4 py-2.5 font-medium">New stock</th>
                  <th className="px-4 py-2.5 font-medium">By</th>
                  <th className="px-4 py-2.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
                      {new Date(m.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-900">{m.product.name}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{STOCK_MOVEMENT_TYPE_LABELS[m.type]}</td>
                    <td className={`px-4 py-2.5 font-medium ${m.quantityChange < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {m.quantityChange > 0 ? "+" : ""}
                      {m.quantityChange}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{m.previousStock} &rarr; {m.newStock}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{m.userName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
