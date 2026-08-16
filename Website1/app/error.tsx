"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-500">{error.message || "An unexpected error occurred."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  );
}
