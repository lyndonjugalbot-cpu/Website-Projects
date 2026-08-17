"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import type { ProductCategory, ProductStatus } from "@/lib/types";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  priceCentavos: number;
  salePriceCentavos: number | null;
  costCentavos: number | null;
  supplier: string;
  barcode: string;
  imageUrl: string;
  stock: number;
  lowStockThreshold: number;
  allowOversell: boolean;
  category: ProductCategory;
  status: ProductStatus;
  isFeatured: boolean;
  isBestSeller: boolean;
};

const EMPTY: ProductFormValues = {
  name: "",
  description: "",
  priceCentavos: 0,
  salePriceCentavos: null,
  costCentavos: null,
  supplier: "",
  barcode: "",
  imageUrl: "",
  stock: 0,
  lowStockThreshold: 5,
  allowOversell: false,
  category: "OTHER",
  status: "ACTIVE",
  isFeatured: false,
  isBestSeller: false,
};

function pesosToCentavos(pesos: string): number {
  const n = Number.parseFloat(pesos);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function centavosToPesos(centavos: number): string {
  return centavos > 0 ? (centavos / 100).toFixed(2) : "";
}

export function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [values, setValues] = useState<ProductFormValues>(initial ?? EMPTY);
  const [priceInput, setPriceInput] = useState(centavosToPesos(values.priceCentavos));
  const [saleInput, setSaleInput] = useState(values.salePriceCentavos ? centavosToPesos(values.salePriceCentavos) : "");
  const [costInput, setCostInput] = useState(values.costCentavos ? centavosToPesos(values.costCentavos) : "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/products/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not upload image");
      setValues((v) => ({ ...v, imageUrl: data.imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceCentavos = pesosToCentavos(priceInput);
    const salePriceCentavos = saleInput.trim() ? pesosToCentavos(saleInput) : null;
    const costCentavos = costInput.trim() ? pesosToCentavos(costInput) : null;

    if (!values.imageUrl) {
      setError("Upload a product image first");
      return;
    }
    if (priceCentavos <= 0) {
      setError("Enter a valid price");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...values,
        priceCentavos,
        salePriceCentavos,
        costCentavos,
        supplier: values.supplier || null,
        barcode: values.barcode || null,
      };
      const res = await fetch(isEdit ? `/api/admin/products/${values.id}` : "/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save product");
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-5">
      <Field label="Product name" required>
        <input
          type="text"
          required
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Description" required>
        <textarea
          required
          rows={4}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          className="input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (₱)" required>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Sale price (₱, optional)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={saleInput}
            onChange={(e) => setSaleInput(e.target.value)}
            className="input"
            placeholder="Leave blank for no sale"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Cost / COGS (₱, optional)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            className="input"
            placeholder="Used for profit reports"
          />
        </Field>
        <Field label="Supplier (optional)">
          <input
            type="text"
            value={values.supplier}
            onChange={(e) => setValues({ ...values, supplier: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {isEdit ? (
          <Field label="Stock quantity">
            <div className="input flex items-center justify-between bg-neutral-50 text-neutral-500">
              <span>{values.stock}</span>
              <a href="/admin/inventory" className="text-xs font-medium text-brand-red hover:underline">Adjust in Inventory</a>
            </div>
          </Field>
        ) : (
          <Field label="Initial stock quantity" required>
            <input
              type="number"
              min="0"
              required
              value={values.stock}
              onChange={(e) => setValues({ ...values, stock: Number.parseInt(e.target.value, 10) || 0 })}
              className="input"
            />
          </Field>
        )}
        <Field label="Category" required>
          <select
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value as ProductCategory })}
            className="input"
          >
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Barcode (optional)">
          <input
            type="text"
            value={values.barcode}
            onChange={(e) => setValues({ ...values, barcode: e.target.value })}
            placeholder="Scan or type — used by the POS"
            className="input"
          />
        </Field>
        <Field label="Low stock threshold" required>
          <input
            type="number"
            min="0"
            required
            value={values.lowStockThreshold}
            onChange={(e) => setValues({ ...values, lowStockThreshold: Number.parseInt(e.target.value, 10) || 0 })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Status" required>
        <select
          value={values.status}
          onChange={(e) => setValues({ ...values, status: e.target.value as ProductStatus })}
          className="input"
        >
          <option value="ACTIVE">Active — visible &amp; purchasable</option>
          <option value="OUT_OF_STOCK">Out of stock — visible, not purchasable</option>
          <option value="INACTIVE">Inactive — hidden from storefront</option>
        </select>
      </Field>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={values.isFeatured}
            onChange={(e) => setValues({ ...values, isFeatured: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-brand-red focus:ring-brand-red"
          />
          Featured on homepage
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={values.isBestSeller}
            onChange={(e) => setValues({ ...values, isBestSeller: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-brand-red focus:ring-brand-red"
          />
          Best seller
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={values.allowOversell}
            onChange={(e) => setValues({ ...values, allowOversell: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-brand-red focus:ring-brand-red"
          />
          Allow overselling (stock can go negative)
        </label>
      </div>

      <Field label="Product image" required>
        <div className="flex items-center gap-4">
          {values.imageUrl && (
            <img src={values.imageUrl} alt="" className="h-20 w-20 rounded-xl border border-neutral-200 object-cover" />
          )}
          <div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="text-sm" />
            {isUploading && <p className="mt-1 text-xs text-neutral-500">Uploading&hellip;</p>}
          </div>
        </div>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-700">
        {label}
        {required && <span className="text-neutral-400"> *</span>}
      </span>
      {children}
    </label>
  );
}
