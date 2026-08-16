import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Page not found</h1>
      <p className="mt-2 text-neutral-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Back to home
      </Link>
    </div>
  );
}
