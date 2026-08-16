import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProductForm } from "@/components/admin/ProductForm";
import type { ProductCategory, ProductStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-neutral-500 hover:text-neutral-800">
        &larr; All products
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Edit product</h1>

      <div className="mt-8">
        <ProductForm
          initial={{
            id: product.id,
            name: product.name,
            description: product.description,
            priceCentavos: product.priceCentavos,
            salePriceCentavos: product.salePriceCentavos,
            imageUrl: product.imageUrl,
            stock: product.stock,
            category: product.category as ProductCategory,
            status: product.status as ProductStatus,
            isFeatured: product.isFeatured,
            isBestSeller: product.isBestSeller,
          }}
        />
      </div>
    </div>
  );
}
