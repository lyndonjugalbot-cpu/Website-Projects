"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCentavosAsPHP } from "@/lib/money";
import { STAFF_MAX_DISCOUNT_PERCENT } from "@/lib/store-config";
import type { PaymentMethodType, ProductStatus } from "@/lib/types";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import type { UserRole } from "@/generated/prisma/enums";

type PosProduct = {
  id: string;
  name: string;
  barcode: string | null;
  altBarcodes: string[];
  groupName: string | null;
  allowOversell: boolean;
  priceCentavos: number;
  salePriceCentavos: number | null;
  imageUrl: string;
  stock: number;
  status: ProductStatus;
};

type CartLine = { productId: string; name: string; unitPriceCentavos: number; quantity: number; stock: number };

const POS_METHODS: PaymentMethodType[] = ["cash", "gcash", "paymaya", "bank_transfer"];

function effective(p: Pick<PosProduct, "priceCentavos" | "salePriceCentavos">) {
  return p.salePriceCentavos ?? p.priceCentavos;
}

// Services and supplies (cooking charge, cups…) have no stock count and are
// flagged allowOversell, so they can always be rung up.
function isSellable(p: PosProduct) {
  return p.status === "ACTIVE" && (p.stock > 0 || p.allowOversell);
}

function hasBarcode(p: PosProduct, code: string) {
  return p.barcode === code || p.altBarcodes.includes(code);
}

// The catalog is ~1,000 items — render a page at a time instead of every tile.
const PAGE_SIZE = 60;

// The sale in progress is saved in the browser so moving to another admin
// page (or reloading) doesn't lose it. It's cleared only when the sale is
// completed or cancelled with "Clear". Keyed by user so cashiers sharing a
// computer don't see each other's sale; a draft older than this is dropped.
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type SaleDraft = {
  savedAt: number;
  cart: CartLine[];
  discountInput: string;
  paymentMethod: PaymentMethodType;
  cashReceivedInput: string;
  customerName: string;
};

function readDraft(key: string): SaleDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SaleDraft;
    if (!draft || !Array.isArray(draft.cart) || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode etc.) — the sale just won't persist.
  }
}

export function POSTerminal({ userId, cashierName, role }: { userId: string; cashierName: string; role: UserRole }) {
  const draftKey = `pos-sale-draft:${userId}`;
  const router = useRouter();
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  // True once the saved draft (if any) has been loaded — the save effect must not run before this,
  // or the empty initial state would overwrite the draft.
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftReconciled = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<string>("");
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [notice, setNotice] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/pos/products");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load products");
      setProducts(data.products);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load products");
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  // Restore an unfinished sale when the register is opened again.
  useEffect(() => {
    const draft = readDraft(draftKey);
    if (draft) {
      setCart(draft.cart);
      setDiscountInput(draft.discountInput ?? "");
      setPaymentMethod(draft.paymentMethod ?? "cash");
      setCashReceivedInput(draft.cashReceivedInput ?? "");
      setCustomerName(draft.customerName ?? "");
    }
    setDraftLoaded(true);
  }, [draftKey]);

  // Save the sale in progress on every change; remove the draft when nothing is in progress.
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      if (cart.length === 0) {
        localStorage.removeItem(draftKey);
        return;
      }
      const draft: SaleDraft = { savedAt: Date.now(), cart, discountInput, paymentMethod, cashReceivedInput, customerName };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Storage unavailable — carry on without persistence.
    }
  }, [draftLoaded, draftKey, cart, discountInput, paymentMethod, cashReceivedInput, customerName]);

  // Once, after the restored sale and the product list are both loaded, bring the lines up to
  // date: prices, stock caps, and drop anything that is no longer for sale.
  useEffect(() => {
    if (!draftLoaded || isLoadingProducts || products.length === 0 || draftReconciled.current) return;
    draftReconciled.current = true;
    setCart((prev) => {
      const byId = new Map(products.map((p) => [p.id, p]));
      const removed: string[] = [];
      const next: CartLine[] = [];
      for (const line of prev) {
        const p = byId.get(line.productId);
        if (!p || !isSellable(p)) {
          removed.push(line.name);
          continue;
        }
        const cap = p.allowOversell ? 999 : p.stock;
        next.push({ ...line, unitPriceCentavos: effective(p), stock: cap, quantity: Math.min(line.quantity, cap) });
      }
      if (removed.length > 0) setNotice(`Removed from the sale (no longer available): ${removed.join(", ")}.`);
      return next;
    });
  }, [draftLoaded, isLoadingProducts, products]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const g = p.groupName ?? "Other";
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (group && (p.groupName ?? "Other") !== group) return false;
      // While searching, show every match so an out-of-stock item is still findable.
      if (!q && !showOutOfStock && !isSellable(p)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || hasBarcode(p, search.trim());
    });
  }, [products, search, group, showOutOfStock]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, group, showOutOfStock]);

  function addToCart(product: PosProduct) {
    if (!isSellable(product)) {
      setNotice(`"${product.name}" is out of stock.`);
      return;
    }
    setNotice(null);
    // No stock cap for oversell items.
    const cap = product.allowOversell ? 999 : product.stock;
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= cap) return prev;
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, unitPriceCentavos: effective(product), quantity: 1, stock: cap }];
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = search.trim();
    if (!trimmed) return;
    const barcodeMatch = products.find((p) => hasBarcode(p, trimmed));
    if (barcodeMatch) {
      addToCart(barcodeMatch);
      setSearch("");
      return;
    }
    if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]);
      setSearch("");
    }
  }

  function updateQty(productId: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, l.stock) } : l));
    });
  }

  function clearCart() {
    setCart([]);
    setDiscountInput("");
    setCashReceivedInput("");
    setCustomerName("");
    setPaymentMethod("cash");
    setError(null);
  }

  const subtotalCentavos = cart.reduce((sum, l) => sum + l.unitPriceCentavos * l.quantity, 0);
  const rawDiscount = Math.round((Number.parseFloat(discountInput) || 0) * 100);
  const maxStaffDiscountCentavos = Math.floor(subtotalCentavos * (STAFF_MAX_DISCOUNT_PERCENT / 100));
  const discountCapCentavos = role === "STAFF" ? Math.min(subtotalCentavos, maxStaffDiscountCentavos) : subtotalCentavos;
  const discountCentavos = Math.max(0, Math.min(rawDiscount, discountCapCentavos));
  const discountExceedsCap = rawDiscount > discountCapCentavos;
  const totalCentavos = subtotalCentavos - discountCentavos;

  const cashReceivedCentavos = Math.round((Number.parseFloat(cashReceivedInput) || 0) * 100);
  const changeDueCentavos = paymentMethod === "cash" ? cashReceivedCentavos - totalCentavos : null;

  const canComplete =
    cart.length > 0 &&
    !discountExceedsCap &&
    (paymentMethod !== "cash" || cashReceivedCentavos >= totalCentavos) &&
    !isSubmitting;

  async function handleCompleteSale() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          discountCentavos,
          paymentMethod,
          cashReceivedCentavos: paymentMethod === "cash" ? cashReceivedCentavos : undefined,
          customerName: customerName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not complete sale");
      clearDraft(draftKey);
      router.push(`/admin/pos/${data.order.id}/receipt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete sale");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search products, or scan a barcode…"
          className="input"
          autoFocus
        />

        {notice && <p className="mt-2 text-sm font-medium text-red-600">{notice}</p>}

        <div className="mt-3 flex items-center gap-2">
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="input max-w-[220px]" aria-label="Product group">
            <option value="">All groups ({products.length})</option>
            {groups.map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            <input type="checkbox" checked={showOutOfStock} onChange={(e) => setShowOutOfStock(e.target.checked)} />
            Show out of stock
          </label>
        </div>

        {loadError ? (
          <p className="mt-6 text-sm text-red-600">{loadError}</p>
        ) : isLoadingProducts ? (
          <p className="mt-6 text-sm text-neutral-400">Loading products&hellip;</p>
        ) : filteredProducts.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">No products match.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filteredProducts.slice(0, visibleCount).map((p) => {
              const outOfStock = !isSellable(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={outOfStock}
                  className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 text-left transition hover:border-brand-red disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="aspect-square bg-neutral-100">
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-xs font-medium text-neutral-900">{p.name}</p>
                    <p className="mt-1 text-xs font-semibold text-neutral-900">{formatCentavosAsPHP(effective(p))}</p>
                    <p className="text-[11px] text-neutral-400">
                      {outOfStock ? "Out of stock" : p.allowOversell ? "Service / supply" : `${p.stock} in stock`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {filteredProducts.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="mt-4 w-full rounded-full border border-neutral-200 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400"
          >
            Show more ({filteredProducts.length - visibleCount} more)
          </button>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900">Current sale</h2>
            {cart.length > 0 && (
              <button type="button" onClick={clearCart} className="text-xs font-medium text-neutral-400 hover:text-red-600">
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-neutral-400">Cart is empty — add products from the left.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.map((line) => (
                <li key={line.productId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-neutral-900">{line.name}</p>
                    <p className="text-xs text-neutral-400">{formatCentavosAsPHP(line.unitPriceCentavos)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQty(line.productId, line.quantity - 1)} className="h-7 w-7 rounded-full border border-neutral-200 text-neutral-600 hover:border-neutral-400">
                      &minus;
                    </button>
                    <span className="w-6 text-center">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.productId, line.quantity + 1)}
                      disabled={line.quantity >= line.stock}
                      className="h-7 w-7 rounded-full border border-neutral-200 text-neutral-600 hover:border-neutral-400 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-16 shrink-0 text-right font-medium text-neutral-900">
                    {formatCentavosAsPHP(line.unitPriceCentavos * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>{formatCentavosAsPHP(subtotalCentavos)}</span>
            </div>
            <label className="flex items-center justify-between gap-2">
              <span className="text-neutral-600">
                Discount (₱)
                {role === "STAFF" && <span className="text-neutral-400"> — up to {STAFF_MAX_DISCOUNT_PERCENT}%</span>}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="input w-28 py-1 text-right"
              />
            </label>
            {discountExceedsCap && (
              <p className="text-xs text-red-600">Max discount is {formatCentavosAsPHP(discountCapCentavos)} for your role.</p>
            )}
            <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold text-neutral-900">
              <span>Total</span>
              <span>{formatCentavosAsPHP(totalCentavos)}</span>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Customer name (optional)</span>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" />
          </label>

          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">Payment method</p>
            <div className="grid grid-cols-2 gap-2">
              {POS_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    paymentMethod === m ? "border-brand-red bg-brand-red text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-neutral-600">Cash received (₱)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceivedInput}
                  onChange={(e) => setCashReceivedInput(e.target.value)}
                  className="input w-28 py-1 text-right"
                />
              </label>
              {changeDueCentavos !== null && cashReceivedInput && (
                <div className={`flex justify-between text-sm font-medium ${changeDueCentavos < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>{changeDueCentavos < 0 ? "Still due" : "Change"}</span>
                  <span>{formatCentavosAsPHP(Math.abs(changeDueCentavos))}</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleCompleteSale}
            disabled={!canComplete}
            className="w-full rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSubmitting ? "Completing…" : `Complete sale — ${formatCentavosAsPHP(totalCentavos)}`}
          </button>
          <p className="text-center text-xs text-neutral-400">Cashier: {cashierName}</p>
        </div>
      </div>
    </div>
  );
}
