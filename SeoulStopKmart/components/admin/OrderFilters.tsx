"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";

export function OrderFilters({
  search,
  orderStatus,
  paymentStatus,
}: {
  search?: string;
  orderStatus?: string;
  paymentStatus?: string;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search ?? "");

  function applyFilters(next: { search?: string; orderStatus?: string; paymentStatus?: string }) {
    const params = new URLSearchParams();
    const merged = { search, orderStatus, paymentStatus, ...next };
    if (merged.search) params.set("search", merged.search);
    if (merged.orderStatus) params.set("orderStatus", merged.orderStatus);
    if (merged.paymentStatus) params.set("paymentStatus", merged.paymentStatus);
    router.push(`/admin/orders?${params.toString()}`);
  }

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters({ search: searchInput });
        }}
        className="flex-1"
      >
        <input
          type="search"
          placeholder="Search by customer, email, phone, or order ID"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input"
        />
      </form>

      <select
        value={orderStatus ?? ""}
        onChange={(e) => applyFilters({ orderStatus: e.target.value || undefined })}
        className="input sm:w-56"
      >
        <option value="">All order statuses</option>
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <select
        value={paymentStatus ?? ""}
        onChange={(e) => applyFilters({ paymentStatus: e.target.value || undefined })}
        className="input sm:w-48"
      >
        <option value="">All payment statuses</option>
        {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
