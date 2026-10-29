"use client";

import { useMemo, useRef, useState } from "react";

type PickerProduct = { id: string; name: string; stock: number };

// Type-to-search product picker (replaces a long drop-down of every product).
// Every word typed must appear in the name, so "sempio soy" finds
// "SEMPIO SOY SAUCE 500ML".
export function ProductPicker({
  products,
  value,
  onChange,
  placeholder = "Search for a product…",
  showStock = true,
}: {
  products: PickerProduct[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  showStock?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = products.find((p) => p.id === value);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return products.filter((p) => words.every((w) => p.name.toLowerCase().includes(w))).slice(0, 8);
  }, [products, query]);

  function pick(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
        <span className="min-w-0 truncate text-neutral-900">
          {selected.name}
          {showStock && <span className="ml-2 text-xs text-neutral-400">in stock: {selected.stock}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="shrink-0 text-xs font-medium text-brand-red hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            pick(matches[0].id);
          }
        }}
        placeholder={placeholder}
        className="input"
        autoComplete="off"
        aria-label="Search for a product"
      />
      {open && query.trim() && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-500">No product found.</li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <span className="min-w-0 truncate text-neutral-900">{p.name}</span>
                  {showStock && <span className="shrink-0 text-xs text-neutral-400">{p.stock} in stock</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
