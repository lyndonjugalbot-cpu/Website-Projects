import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Shop — ShopEasePH",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getAllProducts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Shop all products</h1>
      <p className="mt-1 text-sm text-neutral-500">{products.length} products available</p>

      {products.length === 0 ? (
        <p className="mt-10 text-neutral-500">
          No products yet. Run <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run db:seed</code> to add sample data.
        </p>
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
