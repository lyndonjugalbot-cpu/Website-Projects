export function Forbidden() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold text-neutral-900">You don&apos;t have permission to view this page</h1>
      <p className="mt-2 text-sm text-neutral-500">Ask an owner to grant your account manager access.</p>
    </div>
  );
}
