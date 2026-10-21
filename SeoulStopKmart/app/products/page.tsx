import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@/lib/products";
import type { ProductSort } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters } from "@/components/ProductFilters";
import { CATEGORY_LABELS } from "@/lib/types";
import type { ProductCategory, ProductView } from "@/lib/types";

export const metadata: Metadata = { title: "Shop" };

export const dynamic = "force-dynamic";

const VALID_SORTS = new Set(["newest", "price-asc", "price-desc", "name-asc"]);

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; sort?: string };
}) {
  const category =
    searchParams.category && searchParams.category in CATEGORY_LABELS
      ? (searchParams.category as ProductCategory)
      : undefined;
  const sort = searchParams.sort && VALID_SORTS.has(searchParams.sort) ? (searchParams.sort as ProductSort) : "newest";

  let products: ProductView[];
  let loadError = false;
  try {
    products = await getAllProducts({ search: searchParams.search, category, sort });
  } catch (err) {
    console.error("Failed to load products", err);
    products = [];
    loadError = true;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Shop all products</h1>
      <p className="mt-1 text-sm text-neutral-500">{products.length} products available</p>

      <div className="mt-6">
        <ProductFilters search={searchParams.search} category={searchParams.category} sort={searchParams.sort} />
      </div>

      {loadError ? (
        <div className="mt-16 text-center">
          <p className="text-neutral-900">Something went wrong loading products.</p>
          <p className="mt-1 text-sm text-neutral-500">Please try refreshing the page.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-16 text-center">
          {searchParams.search || category ? (
            <>
              <p className="text-neutral-900">No products match your search.</p>
              <Link href="/products" className="mt-3 inline-block text-sm font-medium text-brand-red hover:underline">
                Clear filters
              </Link>
            </>
          ) : (
            <p className="text-neutral-500">
              No products yet. Run <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run db:seed</code> to add sample data.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
