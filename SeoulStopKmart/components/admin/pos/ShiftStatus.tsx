"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export const SHIFT_CHANGED_EVENT = "pos-shift-changed";

type Status = { clockedIn: boolean; drawerOpen: boolean };

// Compact "On the clock · Drawer open" chip on the register that links to the
// Shift tab, so a cashier notices if they forgot to time in or count the drawer.
export function ShiftStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pos/shift", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStatus({ clockedIn: Boolean(data.timeEntry), drawerOpen: Boolean(data.cashSession) });
    } catch {
      // Offline blip — keep the last known status.
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    window.addEventListener(SHIFT_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener(SHIFT_CHANGED_EVENT, load);
    };
  }, [load]);

  if (!status) return null;
  const ready = status.clockedIn && status.drawerOpen;

  return (
    <Link
      href="/admin/pos/shift"
      className={`inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
        ready
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span>{status.clockedIn ? "On the clock" : "Not timed in"}</span>
      <span className="opacity-30">|</span>
      <span>{status.drawerOpen ? "Drawer open" : "Drawer not counted"}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}
