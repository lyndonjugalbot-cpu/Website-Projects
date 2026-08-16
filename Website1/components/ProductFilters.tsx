"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import type { ProductSort } from "@/lib/products";

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc": "Name: A to Z",
};

export function ProductFilters({
  search,
  category,
  sort,
}: {
  search?: string;
  category?: string;
  sort?: string;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search ?? "");

  function apply(next: { search?: string; category?: string; sort?: string }) {
    const merged = { search, category, sort, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set("search", merged.search);
    if (merged.category) params.set("category", merged.category);
    if (merged.sort) params.set("sort", merged.sort);
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ search: searchInput });
        }}
        className="flex-1"
      >
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search products…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input pl-9"
            aria-label="Search products"
          />
        </div>
      </form>

      <select
        value={category ?? ""}
        onChange={(e) => apply({ category: e.target.value || undefined })}
        className="input sm:w-56"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {ALL_CATEGORIES.map((c) => (
          <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
        ))}
      </select>

      <select
        value={sort ?? "newest"}
        onChange={(e) => apply({ sort: e.target.value === "newest" ? undefined : e.target.value })}
        className="input sm:w-52"
        aria-label="Sort products"
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
