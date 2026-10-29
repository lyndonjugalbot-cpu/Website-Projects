"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ALL_CATEGORIES, CATEGORY_LABELS, STOCK_MOVEMENT_TYPE_LABELS } from "@/lib/types";
import type { ProductCategory, StockMovementType } from "@/lib/types";
import { ProductPicker } from "@/components/admin/ProductPicker";

type Product = { id: string; name: string; stock: number; category: ProductCategory; status: string };
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

const LOW_STOCK_AT = 5;
const STOCK_PAGE_SIZE = 50;

type StockFilter = "all" | "low" | "out";

export function InventoryManager({ products }: { products: Product[] }) {
  const router = useRouter();

  // --- Stock levels (remaining stock by category) ---
  const [levelCategory, setLevelCategory] = useState("");
  const [levelSearch, setLevelSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<StockFilter>("all");
  const [levelLimit, setLevelLimit] = useState(STOCK_PAGE_SIZE);

  const levelRows = useMemo(() => {
    const words = levelSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return products
      .filter((p) => {
        if (levelCategory && p.category !== levelCategory) return false;
        if (levelFilter === "out" && p.stock > 0) return false;
        if (levelFilter === "low" && !(p.stock > 0 && p.stock <= LOW_STOCK_AT)) return false;
        return words.every((w) => p.name.toLowerCase().includes(w));
      })
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [products, levelCategory, levelSearch, levelFilter]);

  useEffect(() => {
    setLevelLimit(STOCK_PAGE_SIZE);
  }, [levelCategory, levelSearch, levelFilter]);

  const levelTotals = useMemo(() => {
    const inCategory = products.filter((p) => !levelCategory || p.category === levelCategory);
    return {
      total: inCategory.length,
      out: inCategory.filter((p) => p.stock <= 0).length,
      low: inCategory.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_AT).length,
    };
  }, [products, levelCategory]);

  // --- Restock / adjust form ---
  const [mode, setMode] = useState<"restock" | "adjust">("restock");
  const [updateProductId, setUpdateProductId] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === updateProductId);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const quantity = Number.parseInt(quantityInput, 10);
    if (!updateProductId || Number.isNaN(quantity)) {
      setError("Pick a product and enter a valid quantity");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          mode === "restock"
            ? JSON.stringify({ kind: "restock", productId: updateProductId, quantity, note: reason })
            : JSON.stringify({ kind: "adjust", productId: updateProductId, newStock: quantity, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update stock");
      setSuccess(
        mode === "restock"
          ? `Added ${quantity} to ${selectedProduct?.name ?? "the product"}.`
          : `Set ${selectedProduct?.name ?? "the product"} to ${quantity}.`
      );
      setUpdateProductId("");
      setQuantityInput("");
      setReason("");
      router.refresh(); // reload stock levels
      await loadMovements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update stock");
    } finally {
      setIsSaving(false);
    }
  }

  // --- Movement history ---
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterProductId, setFilterProductId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterProductId) params.set("productId", filterProductId);
    if (filterType) params.set("type", filterType);
    if (filterCategory) params.set("category", filterCategory);
    const res = await fetch(`/api/admin/inventory?${params.toString()}`);
    const data = await res.json();
    setMovements(data.movements ?? []);
    setIsLoading(false);
  }, [filterProductId, filterType, filterCategory]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const delta = selectedProduct && quantityInput ? Number.parseInt(quantityInput, 10) - selectedProduct.stock : null;

  return (
    <div className="flex flex-col gap-10">
      {/* Stock levels */}
      <section>
        <h2 className="font-medium text-neutral-900">Remaining stock</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select value={levelCategory} onChange={(e) => setLevelCategory(e.target.value)} className="input sm:w-56" aria-label="Category">
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={levelSearch}
            onChange={(e) => setLevelSearch(e.target.value)}
            placeholder="Search products…"
            className="input sm:w-64"
            aria-label="Search stock"
          />
          <div className="flex gap-1.5" role="group" aria-label="Stock status">
            {(
              [
                ["all", `All (${levelTotals.total})`],
                ["low", `Low ≤${LOW_STOCK_AT} (${levelTotals.low})`],
                ["out", `Out of stock (${levelTotals.out})`],
              ] as [StockFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLevelFilter(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  levelFilter === key ? "border-brand-red bg-brand-red text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {levelRows.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">No products match.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">In stock</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {levelRows.slice(0, levelLimit).map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-4 py-2.5 text-neutral-900">{p.name}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{CATEGORY_LABELS[p.category]}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        p.stock <= 0 ? "text-red-600" : p.stock <= LOW_STOCK_AT ? "text-amber-600" : "text-neutral-900"
                      }`}
                    >
                      {p.stock}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setUpdateProductId(p.id);
                          setMode("restock");
                          setQuantityInput("");
                          window.scrollTo({ top: document.getElementById("stock-update")?.offsetTop ?? 0, behavior: "smooth" });
                        }}
                        className="text-xs font-medium text-brand-red hover:underline"
                      >
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {levelRows.length > levelLimit && (
          <button
            type="button"
            onClick={() => setLevelLimit((n) => n + STOCK_PAGE_SIZE)}
            className="mt-3 w-full rounded-full border border-neutral-200 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400"
          >
            Show more ({levelRows.length - levelLimit} more)
          </button>
        )}
      </section>

      {/* Restock / manual adjustment */}
      <form id="stock-update" onSubmit={handleUpdate} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-neutral-900">Update stock</h2>
          <div className="flex gap-1.5" role="group" aria-label="Type of update">
            {(
              [
                ["restock", "Restock"],
                ["adjust", "Manual adjustment"],
              ] as ["restock" | "adjust", string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setQuantityInput("");
                  setError(null);
                  setSuccess(null);
                }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  mode === key ? "border-brand-red bg-brand-red text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-neutral-500">
          {mode === "restock"
            ? "Stock that just arrived from a supplier. The quantity you enter is added to what's in stock, and it's logged as a Restock."
            : "Fix the count: a recount, damaged goods, returned items. Enter what the stock should be now; it's logged as a Manual adjustment with your reason."}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Product</span>
            <ProductPicker products={products} value={updateProductId} onChange={setUpdateProductId} />
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">{mode === "restock" ? "Quantity received" : "New quantity"}</span>
            <input
              type="number"
              min={mode === "restock" ? 1 : 0}
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className="input"
              required
            />
            {selectedProduct && quantityInput && !Number.isNaN(Number.parseInt(quantityInput, 10)) && (
              <span className="text-xs text-neutral-400">
                {mode === "restock"
                  ? `${selectedProduct.stock} → ${selectedProduct.stock + Number.parseInt(quantityInput, 10)}`
                  : `${delta !== null && delta >= 0 ? "+" : ""}${delta} vs. current (${selectedProduct.stock})`}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">{mode === "restock" ? "Note (optional)" : "Reason (required)"}</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "restock" ? "e.g. supplier, delivery receipt no." : "e.g. stock count correction, damaged, returned"}
              className="input"
              required={mode === "adjust"}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="self-start rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSaving ? "Saving…" : mode === "restock" ? "Add restock" : "Apply adjustment"}
        </button>
      </form>

      {/* History */}
      <section>
        <h2 className="font-medium text-neutral-900">Stock movement history</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="sm:w-72">
            <ProductPicker
              products={products}
              value={filterProductId}
              onChange={setFilterProductId}
              placeholder="All products (search to filter)"
              showStock={false}
            />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input sm:w-52" aria-label="Category">
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input sm:w-56" aria-label="Movement type">
            <option value="">All movement types</option>
            {Object.entries(STOCK_MOVEMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
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
                    <td className="px-4 py-2.5 text-neutral-600">
                      {m.previousStock} &rarr; {m.newStock}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{m.userName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
