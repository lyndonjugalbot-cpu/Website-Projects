"use client";

export function QuantityStepper({
  quantity,
  max,
  onChange,
}: {
  quantity: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-neutral-300">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        disabled={quantity <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30"
      >
        &minus;
      </button>
      <span className="w-8 text-center text-sm font-medium tabular-nums">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
