"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark print:hidden"
    >
      {label}
    </button>
  );
}
