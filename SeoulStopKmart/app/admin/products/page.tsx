import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCentavosAsPHP } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/types";
import type { ProductCategory, ProductStatus } from "@/lib/types";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProductDeleteButton } from "@/components/admin/ProductDeleteButton";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ProductStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-neutral-200 text-neutral-500",
  OUT_OF_STOCK: "bg-amber-100 text-amber-700",
};

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Products</h1>
          <p className="mt-1 text-sm text-neutral-500">{products.length} products</p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center rounded-full bg-brand-red px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark"
        >
          Add product
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="font-medium text-neutral-900">{product.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">{CATEGORY_LABELS[product.category as ProductCategory]}</td>
                <td className="px-4 py-3 text-neutral-900">
                  {product.salePriceCentavos ? (
                    <>
                      <span className="text-brand-red">{formatCentavosAsPHP(product.salePriceCentavos)}</span>{" "}
                      <span className="text-xs text-neutral-400 line-through">
                        {formatCentavosAsPHP(product.priceCentavos)}
                      </span>
                    </>
                  ) : (
                    formatCentavosAsPHP(product.priceCentavos)
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">{product.stock}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[product.status as ProductStatus]}`}>
                    {product.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {[product.isFeatured && "Featured", product.isBestSeller && "Best seller"].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/admin/products/${product.id}/edit`} className="text-sm font-medium text-brand-red hover:underline">
                      Edit
                    </Link>
                    <ProductDeleteButton productId={product.id} productName={product.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
