export default function LoadingProducts() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="h-7 w-48 animate-pulse rounded bg-neutral-200" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-neutral-200">
            <div className="aspect-square animate-pulse bg-neutral-100" />
            <div className="flex flex-col gap-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
              <div className="mt-2 h-9 w-full animate-pulse rounded-full bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
