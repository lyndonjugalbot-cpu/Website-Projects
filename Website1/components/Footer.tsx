import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>&copy; {new Date().getFullYear()} ShopEasePH. A demo store — no real purchases are made.</p>
        <div className="flex gap-5">
          <Link href="/about" className="hover:text-neutral-800">About</Link>
          <Link href="/contact" className="hover:text-neutral-800">Contact</Link>
          <Link href="/admin/orders" className="hover:text-neutral-800">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
